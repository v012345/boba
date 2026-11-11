// 店铺档次、配方可达性与客流的规则测试，不启动 Cocos。
// 运行：node tests/shop-config.test.mjs
import './ts-loader.mjs';
import assert from 'node:assert/strict';

const { TeaGame, RECIPES } = await import('../assets/game/logic/TeaGame.ts');
const { SHOP_PROFILES, validateShopProfile } = await import('../assets/game/config/ShopProfiles.ts');
const { SHOP_IDS, DEFAULT_SHOP_ID, getShopDefinition } = await import('../assets/game/config/Shops.ts');
const { SHOP_THEMES } = await import('../assets/game/config/ShopThemes.ts');
let count = 0;
function test(name, run) { run(); count++; console.log(`✓ ${name}`); }
function nextCustomer(game) {
    game.customers.fill(null);
    game.tick(game.profile.spawnInterval + game.profile.spawnInitialDelay);
    return game.customers.find(Boolean);
}

test('Default shop preserves the existing standard rules', () => {
    const shop = getShopDefinition();
    const game = new TeaGame(() => 0);
    assert.equal(DEFAULT_SHOP_ID, 'standard');
    assert.equal(shop.profile.id, game.profile.id);
    assert.equal(shop.layoutPath, 'prefabs/shop/layouts/StandardShop');
    assert.equal(game.customers.length, 3);
    assert.equal(game.cups.length, 1);
    assert.equal(game.duration, 90);
    assert.equal(game.target, 150);
    assert.equal(game.sealDuration, 1);
    assert.equal(game.customers[0].recipe, 0);
});

test('Every shop resolves a matching layout, valid profile and existing-art tint theme', () => {
    const expected = { basic: ['SmallShop', 2], standard: ['StandardShop', 3], premium: ['LargeShop', 4] };
    for (const id of SHOP_IDS) {
        const shop = getShopDefinition(id);
        assert.equal(shop.layoutPath, `prefabs/shop/layouts/${expected[id][0]}`);
        validateShopProfile(shop.profile);
        const game = new TeaGame(() => 0, undefined, shop.profile);
        assert.equal(game.customers.length, expected[id][1]);
        assert.equal(game.cups.length, 1);
        assert.equal(shop.theme, SHOP_THEMES[shop.theme.id]);
        for (const field of ['backgroundColor', 'counterColor', 'accentColor']) assert.match(shop.theme[field], /^#[0-9A-F]{6}$/);
    }
    assert.throws(() => getShopDefinition('missing'), /未知店铺/);
    assert.throws(() => getShopDefinition('__proto__'), /未知店铺/);
});

test('Two-slot and four-slot shops fill exactly their configured capacity', () => {
    for (const profile of [SHOP_PROFILES.basic, SHOP_PROFILES.premium]) {
        const game = new TeaGame(() => 0, undefined, profile);
        game.tick(profile.spawnInitialDelay);
        for (let slot = 2; slot < profile.customerSlots; slot++) game.tick(profile.spawnInterval);
        assert.equal(game.customers.filter(Boolean).length, profile.customerSlots);
        game.tick(profile.spawnInterval);
        assert.equal(game.customers.length, profile.customerSlots);
        assert.equal(game.customers.filter(Boolean).length, profile.customerSlots);
    }
});

test('Basic shop never orders recipes requiring unavailable jelly, even after many deliveries', () => {
    for (const random of [() => 0, () => 0.999]) {
        const game = new TeaGame(random, undefined, SHOP_PROFILES.basic);
        game.served = 100;
        for (let i = 0; i < 5; i++) {
            const customer = nextCustomer(game);
            assert.ok(customer);
            const recipe = RECIPES[customer.recipe];
            assert.ok(['milk-tea', 'pearl-milk-tea'].includes(recipe.id));
            assert.ok(recipe.ingredients.every(ingredient => game.profile.ingredients.includes(ingredient)));
        }
    }
});

test('Unavailable ingredients are rejected by rules, regardless of view input', () => {
    const game = new TeaGame(() => 0, undefined, SHOP_PROFILES.basic);
    game.takeCup(0); game.tick(game.placeDuration);
    assert.equal(game.add('tea'), true);
    assert.equal(game.add('milk'), true);
    assert.equal(game.add('jelly'), false);
    assert.equal(game.add('unknown'), false);
    assert.deepEqual(game.cups[0].ingredients, ['tea', 'milk']);
    assert.equal(game.add('pearl'), true);
});

test('Standard shop unlocks the third recipe at two orders and fourth at five', () => {
    for (const [served, expectedId] of [[0, 'pearl-milk-tea'], [1, 'pearl-milk-tea'], [2, 'jelly-milk-tea'], [4, 'jelly-milk-tea'], [5, 'mixed-milk-tea']]) {
        const game = new TeaGame(() => 0.999);
        game.served = served;
        assert.equal(RECIPES[nextCustomer(game).recipe].id, expectedId);
    }
});

test('Premium shop exposes all recipes immediately and receives customers sooner', () => {
    const standard = new TeaGame(() => 0.999);
    const premium = new TeaGame(() => 0.999, undefined, SHOP_PROFILES.premium);
    standard.tick(3); premium.tick(3);
    assert.equal(standard.customers.filter(Boolean).length, 1);
    assert.equal(premium.customers.filter(Boolean).length, 2);
    assert.equal(RECIPES[premium.customers[1].recipe].id, 'mixed-milk-tea');
    premium.tick(premium.profile.spawnInterval);
    assert.equal(premium.customers.filter(Boolean).length, 3);
});

test('First order comes from the selected shop menu, not a hard-coded recipe index', () => {
    const profile = { ...SHOP_PROFILES.standard, recipes: [{ recipeId: 'jelly-milk-tea', afterServed: 0 }] };
    const game = new TeaGame(() => 0, undefined, profile);
    const recipe = RECIPES[game.customers[0].recipe];
    assert.equal(recipe.id, 'jelly-milk-tea');
    game.takeCup(0); game.tick(game.placeDuration);
    recipe.ingredients.forEach(ingredient => assert.equal(game.add(ingredient), true));
    game.seal(); game.tick(game.sealDuration);
    assert.equal(game.deliver(0), true);
    assert.equal(game.money, recipe.price);
});

test('Invalid slot counts, impossible menus and invalid timing fail before opening', () => {
    const invalid = [
        [{ customerSlots: 0 }, /customerSlots/],
        [{ customerSlots: 2.5 }, /customerSlots/],
        [{ customerSlots: NaN }, /customerSlots/],
        [{ ingredients: ['tea', 'milk'], recipes: [{ recipeId: 'pearl-milk-tea', afterServed: 0 }] }, /缺少原料 pearl/],
        [{ recipes: [] }, /recipes/],
        [{ recipes: [{ recipeId: 'missing', afterServed: 0 }] }, /未知配方/],
        [{ recipes: [{ recipeId: 'milk-tea', afterServed: 1 }] }, /开店/],
        [{ recipes: [{ recipeId: 'milk-tea', afterServed: -1 }] }, /afterServed/],
        [{ recipes: [{ recipeId: 'milk-tea', afterServed: 0 }, { recipeId: 'milk-tea', afterServed: 1 }] }, /配方重复/],
        [{ ingredients: ['tea', 'milk', 'unknown'] }, /未知原料/],
        [{ ingredients: ['tea', 'milk', 'tea'] }, /原料重复/],
        [{ duration: 0 }, /duration/],
        [{ sealDuration: NaN }, /sealDuration/],
        [{ spawnMinInterval: 20 }, /spawnMinInterval/],
        [{ spawnAcceleration: -1 }, /spawnAcceleration/],
    ];
    for (const [override, error] of invalid) assert.throws(() => new TeaGame(() => 0, undefined, { ...SHOP_PROFILES.standard, ...override }), error);
});

test('An active session retains its own validated profile snapshot', () => {
    const profile = {
        ...SHOP_PROFILES.basic,
        ingredients: [...SHOP_PROFILES.basic.ingredients],
        recipes: SHOP_PROFILES.basic.recipes.map(entry => ({ ...entry })),
    };
    const game = new TeaGame(() => 0, undefined, profile);
    profile.customerSlots = 10;
    profile.ingredients.push('jelly');
    profile.recipes[0].afterServed = 999;
    assert.equal(game.profile.customerSlots, 2);
    assert.equal(game.profile.ingredients.includes('jelly'), false);
    assert.equal(game.profile.recipes[0].afterServed, 0);
});

console.log(`${count} shop configuration tests passed.`);
