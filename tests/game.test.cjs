// Compile the engine-independent rules in a temporary directory, then test with Node.
const { execFileSync } = require('node:child_process');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const assert = require('node:assert/strict');
const out = mkdtempSync(join(tmpdir(), 'boba-test-'));
try {
    execFileSync('tsc', [resolve(__dirname, '../assets/scripts/TeaGame.ts'), '--target', 'es2015', '--module', 'commonjs', '--strict', '--skipLibCheck', '--outDir', out], { stdio: 'inherit', cwd: out });
    const { TeaGame, RECIPES } = require(join(out, 'TeaGame.js'));
    let count = 0;
    function test(name, run) { run(); count++; console.log(`✓ ${name}`); }
    function make(game, recipe = 0) { RECIPES[recipe].ingredients.forEach(i => game.add(i)); game.seal(); game.tick(2.5); }
    test('First customer and tea-first constraint', () => {
        const g = new TeaGame(); assert.equal(g.customers[0].recipe, 0);
        g.add('milk'); assert.equal(g.cups[0].ingredients.length, 0);
        g.add('tea'); g.add('tea'); assert.deepEqual(g.cups[0].ingredients, ['tea']);
        g.seal(); assert.equal(g.cups[0].state, 'making');
    });
    test('Sealing takes time and locks ingredients', () => {
        const g = new TeaGame(); g.add('tea'); g.add('milk'); g.seal();
        g.add('pearl'); assert.equal(g.cups[0].ingredients.length, 2);
        g.tick(2); assert.equal(g.cups[0].state, 'sealing');
        assert.equal(g.deliver(0), false); g.tick(0.5); assert.equal(g.cups[0].state, 'ready');
    });
    test('Two cups progress independently', () => {
        const g = new TeaGame(); g.add('tea'); g.add('milk'); g.seal();
        g.select(1); g.add('tea'); g.tick(2.5);
        assert.equal(g.cups[0].state, 'ready'); assert.equal(g.cups[1].state, 'making');
    });
    test('Correct deliveries grant money and combo bonus', () => {
        const g = new TeaGame(() => 0); make(g); assert.equal(g.deliver(0), true);
        assert.equal(g.money, 18); assert.equal(g.cups[0].state, 'empty');
        g.tick(4); make(g); g.deliver(0); assert.equal(g.money, 38); assert.equal(g.bestCombo, 2);
    });
    test('Wrong order retains cup, costs patience, resets combo', () => {
        const g = new TeaGame(); make(g, 1); const before = g.customers[0].patience;
        g.combo = 3; assert.equal(g.deliver(0), false);
        assert.equal(g.customers[0].patience, before - 5); assert.equal(g.combo, 0);
        assert.equal(g.cups[0].state, 'ready'); assert.equal(g.money, 0);
    });
    test('Every recipe is accepted with exact ingredients', () => {
        RECIPES.forEach((r, index) => {
            const g = new TeaGame(); g.customers[0].recipe = index; make(g, index);
            assert.equal(g.deliver(0), true); assert.equal(g.money, r.price);
        });
    });
    test('Pause freezes time, preparation and input', () => {
        const g = new TeaGame(); g.add('tea'); g.add('milk'); g.seal(); g.paused = true;
        g.tick(10); g.discard(); g.select(1);
        assert.equal(g.time, 90); assert.equal(g.cups[0].remaining, 2.5); assert.equal(g.selected, 0);
    });
    test('Impatient customers leave and break combo', () => {
        const g = new TeaGame(); g.combo = 3; g.tick(38);
        assert.equal(g.lost, 1); assert.equal(g.combo, 0);
    });
    test('Discard clears cup; closing locks all actions', () => {
        const g = new TeaGame(); make(g); g.discard(); assert.equal(g.cups[0].state, 'empty');
        g.tick(100); assert.equal(g.time, 0); assert.equal(g.ended, true);
        g.add('tea'); assert.equal(g.cups[0].state, 'empty'); assert.equal(g.deliver(0), false);
    });
    console.log(`${count} tests passed.`);
} finally { rmSync(out, { recursive: true, force: true }); }
