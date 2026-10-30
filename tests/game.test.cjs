// Compile the engine-independent rules in a temporary directory, then test with Node.
const { execFileSync } = require('node:child_process');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const assert = require('node:assert/strict');
const out = mkdtempSync(join(tmpdir(), 'boba-test-'));
try {
    execFileSync('tsc', [resolve(__dirname, '../assets/scripts/TeaGame.ts'), resolve(__dirname, '../assets/scripts/TeaDropTargets.ts'), '--target', 'es2015', '--module', 'commonjs', '--strict', '--skipLibCheck', '--outDir', out], { stdio: 'inherit', cwd: out });
    const { TeaGame, RECIPES } = require(join(out, 'TeaGame.js'));
    let count = 0;
    function test(name, run) { run(); count++; console.log(`✓ ${name}`); }
    function take(game, index = game.selected) { assert.equal(game.takeCup(index), true); game.tick(0.45); }
    function accept(game, slot = 0) { game.tick(2.5); assert.equal(game.acceptOrder(slot), true); }
    function make(game, recipe = 0) { take(game); RECIPES[recipe].ingredients.forEach(i => game.add(i)); game.seal(); game.tick(1); }
    test('First customer and tea-first constraint', () => {
        const g = new TeaGame(); assert.equal(g.customers[0].recipe, 0); take(g);
        g.add('milk'); assert.equal(g.cups[0].ingredients.length, 0);
        g.add('tea'); g.add('tea'); assert.deepEqual(g.cups[0].ingredients, ['tea']);
        g.seal(); assert.equal(g.cups[0].state, 'making');
    });
    test('Sealing takes time and locks ingredients', () => {
        const g = new TeaGame(); take(g); g.add('tea'); g.add('milk'); g.seal();
        g.add('pearl'); assert.equal(g.cups[0].ingredients.length, 2);
        g.tick(0.5); assert.equal(g.cups[0].state, 'sealing');
        assert.equal(g.deliver(0), false); g.tick(0.5); assert.equal(g.cups[0].state, 'ready');
    });
    test('Single station remains occupied throughout sealing and until delivery or discard', () => {
        const g = new TeaGame(); take(g); g.add('tea'); g.add('milk'); g.seal();
        assert.equal(g.cups.length, 1); assert.equal(g.takeFromSupply(), -1);
        g.discard(); assert.equal(g.cups[0].state, 'sealing');
        g.tick(1); assert.equal(g.cups[0].state, 'ready');
        assert.equal(g.takeFromSupply(), -1);
        g.discard(); assert.equal(g.takeFromSupply(), 0);
    });
    test('Correct deliveries grant money and combo bonus', () => {
        const g = new TeaGame(() => 0); accept(g); make(g); assert.equal(g.deliver(0), true);
        assert.equal(g.money, 18); assert.equal(g.cups[0].state, 'stored');
        g.tick(4); const slot = g.customers.findIndex(Boolean); accept(g, slot); make(g); g.deliver(slot); assert.equal(g.money, 38); assert.equal(g.bestCombo, 2);
    });
    test('Wrong order retains cup, costs patience, resets combo', () => {
        const g = new TeaGame(); accept(g); make(g, 1); const before = g.customers[0].patience;
        g.combo = 3; assert.equal(g.deliver(0), false);
        assert.equal(g.customers[0].patience, before - 5); assert.equal(g.combo, 0);
        assert.equal(g.cups[0].state, 'ready'); assert.equal(g.money, 0);
    });
    test('Every recipe is accepted with exact ingredients', () => {
        RECIPES.forEach((r, index) => {
            const g = new TeaGame(); g.customers[0].recipe = index; accept(g); make(g, index);
            assert.equal(g.deliver(0), true); assert.equal(g.money, r.price);
        });
    });
    test('Pause freezes time, preparation and input', () => {
        const g = new TeaGame(); take(g); g.add('tea'); g.add('milk'); g.seal(); g.paused = true;
        g.tick(10); g.discard(); g.select(1);
        assert.equal(g.time, 89.55); assert.equal(g.cups[0].remaining, 1); assert.equal(g.selected, 0);
    });
    test('Impatient customers leave and break combo', () => {
        const g = new TeaGame(); g.combo = 3; g.tick(41);
        assert.equal(g.lost, 1); assert.equal(g.combo, 0);
    });
    test('Discard clears cup; closing locks all actions', () => {
        const g = new TeaGame(); make(g); g.discard(); assert.equal(g.cups[0].state, 'stored');
        g.tick(100); assert.equal(g.time, 0); assert.equal(g.ended, true);
        g.add('tea'); assert.equal(g.cups[0].state, 'stored'); assert.equal(g.deliver(0), false);
    });
    test('Ingredients require a cup to finish moving onto the counter', () => {
        const g = new TeaGame(); g.add('tea'); g.seal();
        assert.equal(g.cups[0].state, 'stored'); assert.equal(g.cups[0].ingredients.length, 0);
        assert.equal(g.takeCup(0), true); assert.equal(g.takeCup(0), false);
        g.add('tea'); assert.equal(g.cups[0].ingredients.length, 0);
        g.tick(0.2); assert.equal(g.cups[0].state, 'placing');
        g.tick(0.25); assert.equal(g.cups[0].state, 'empty');
        g.add('tea'); assert.equal(g.cups[0].state, 'making');
    });
    test('Customer thinks before revealing an order; acceptance is explicit', () => {
        const g = new TeaGame(), customer = g.customers[0];
        assert.equal(customer.state, 'thinking'); assert.equal(g.acceptOrder(0), false);
        g.tick(2); assert.equal(customer.patience, customer.maxPatience);
        g.tick(1); assert.equal(customer.state, 'ordering');
        assert.equal(customer.patience, customer.maxPatience - 0.5);
        assert.equal(g.acceptOrder(0), true); assert.equal(customer.state, 'accepted');
        assert.equal(customer.patience, customer.maxPatience);
        g.tick(3);
        assert.equal(g.acceptOrder(0), false);
        assert.equal(customer.patience, customer.maxPatience - 3);
    });
    test('Ready drinks cannot bypass order acceptance; accepting does not deliver', () => {
        const g = new TeaGame(); make(g); g.tick(2.5);
        assert.equal(g.customers[0].state, 'ordering');
        assert.equal(g.deliver(0), false); assert.equal(g.cups[0].state, 'ready');
        assert.equal(g.acceptOrder(0), true); assert.equal(g.money, 0);
        assert.equal(g.deliver(0), true); assert.equal(g.cups[0].state, 'stored');
        g.add('tea'); assert.equal(g.cups[0].ingredients.length, 0);
    });
    test('Pause freezes cup movement and thinking, and blocks taking and accepting', () => {
        const g = new TeaGame(); g.takeCup(0); g.paused = true;
        g.tick(4); assert.equal(g.cups[0].remaining, 0.45);
        assert.equal(g.customers[0].thinkRemaining, 2.5); assert.equal(g.takeCup(1), false);
        g.paused = false; g.tick(3); g.paused = true;
        assert.equal(g.acceptOrder(0), false); assert.equal(g.customers[0].state, 'ordering');
    });
    test('Shared stack cannot overwrite the single moving cup', () => {
        const g = new TeaGame();
        assert.equal(g.takeFromSupply(), 0); assert.equal(g.cups[0].size, 'M');
        const before = JSON.stringify(g.cups);
        assert.equal(g.takeFromSupply(), -1); assert.equal(JSON.stringify(g.cups), before);
        assert.equal(g.takeCup(1), false);
        g.tick(0.45); g.discard(); assert.equal(g.takeFromSupply(), 0);
    });
    test('Supply respects pause, closing and unavailable sizes', () => {
        const g = new TeaGame(); g.select(1); assert.equal(g.selected, 0);
        assert.equal(g.takeFromSupply('S'), -1);
        g.paused = true; assert.equal(g.takeFromSupply(), -1);
        g.paused = false; g.tick(100); assert.equal(g.takeFromSupply(), -1);
    });
    test('Empty and unfinished cups cannot seal or deliver; bin removes the entire cup', () => {
        const g = new TeaGame(); accept(g); take(g); g.seal();
        assert.equal(g.cups[0].state, 'empty'); g.add('tea'); g.seal();
        assert.equal(g.cups[0].state, 'making'); assert.equal(g.deliver(0), false);
        g.combo = 4; g.discard(); assert.equal(g.combo, 0);
        assert.equal(g.cups[0].state, 'stored'); assert.deepEqual(g.cups[0].ingredients, []);
    });
    test('Drag zones match machine, bin, occupied customers and reject empty space', () => {
        const { findDropTarget, findSnapTarget, dropZones } = require(join(out, 'TeaDropTargets.js'));
        const occupied = [true, false, true];
        assert.equal(findDropTarget(125, -116, occupied).kind, 'machine');
        assert.equal(findDropTarget(-420, -249, occupied).kind, 'trash');
        assert.equal(findDropTarget(-390, 140, occupied).slot, 0);
        assert.equal(findDropTarget(390, 200, occupied).slot, 2);
        assert.equal(findDropTarget(0, 140, occupied), null);
        assert.equal(findDropTarget(-115, -88, occupied), null);
        assert.equal(findDropTarget(0, 310, occupied), null);
        assert.equal(findDropTarget(-420, -320, occupied), null);
        // Forgiving release: equipment accepts a near miss, customers never do.
        assert.equal(findSnapTarget(238, -190, occupied, 52).kind, 'machine');
        assert.equal(findSnapTarget(-538, -250, occupied, 52).kind, 'trash');
        assert.equal(findSnapTarget(-115, -88, occupied, 52), null);
        assert.equal(findSnapTarget(-390, 30, occupied, 52), null);
        assert.equal(dropZones([true, false, false]).length, 3);
    });
    test('Grabbing a sliding cup finishes the placement immediately', () => {
        const g = new TeaGame(); g.takeCup(0); g.tick(0.1);
        assert.equal(g.cups[0].state, 'placing'); assert.equal(g.settlePlacement(), true);
        assert.equal(g.cups[0].state, 'empty'); g.add('tea'); assert.equal(g.cups[0].state, 'making');
        assert.equal(g.settlePlacement(), false);
        g.paused = true; g.takeCup(0); assert.equal(g.settlePlacement(), false);
    });
    test('Departing customers reserve their slot until exit animation finishes', () => {
        const g = new TeaGame(() => 0);
        g.tick(4); g.tick(6); // All three slots occupied.
        g.customers.forEach(c => { c.state = 'accepted'; c.patience = 30; });
        g.customers[0].patience = 0.01;
        g.tick(6); // Spawn timer also expires, but the leaving slot is reserved.
        assert.equal(g.customers[0], null);
        g.paused = true; g.tick(10); assert.equal(g.customers[0], null);
        g.paused = false; g.tick(0.5); assert.equal(g.customers[0], null);
        g.tick(0.5); assert.ok(g.customers[0]); assert.equal(g.customers[0].state, 'thinking');
    });
    test('Successful delivery also reserves the departing customer slot', () => {
        const g = new TeaGame(() => 0); accept(g); make(g);
        assert.equal(g.deliver(0), true); g.tick(0.5);
        assert.equal(g.customers[0], null);
    });
    console.log(`${count} tests passed.`);
} finally { rmSync(out, { recursive: true, force: true }); }
