import { INGREDIENT_NAMES, RECIPES } from './Recipes';
import type { Ingredient, RecipeId } from './Recipes';

export interface ShopRecipe {
    readonly recipeId: RecipeId;
    /** 完成多少单后开始出现；0 表示开店即可点单。 */
    readonly afterServed: number;
}

/** 经营能力与客流，不包含布局坐标或贴图。当前各店共用一个制作杯位。 */
export interface ShopProfile {
    readonly id: string;
    readonly name: string;
    readonly customerSlots: number;
    readonly ingredients: readonly Ingredient[];
    readonly recipes: readonly ShopRecipe[];
    readonly duration: number;
    readonly target: number;
    readonly sealDuration: number;
    readonly placeDuration: number;
    readonly departureDuration: number;
    readonly spawnInitialDelay: number;
    readonly spawnInterval: number;
    readonly spawnMinInterval: number;
    /** 每完成一单，下一位顾客的间隔缩短多少秒。 */
    readonly spawnAcceleration: number;
}

const common = {
    duration: 90, sealDuration: 1, placeDuration: 0.45, departureDuration: 1,
    spawnAcceleration: 0.15,
};

export const SHOP_PROFILES: Readonly<Record<'basic' | 'standard' | 'premium', ShopProfile>> = {
    basic: {
        ...common, id: 'basic', name: '小店', customerSlots: 2, target: 100,
        ingredients: ['tea', 'milk', 'pearl'],
        recipes: [{ recipeId: 'milk-tea', afterServed: 0 }, { recipeId: 'pearl-milk-tea', afterServed: 0 }],
        spawnInitialDelay: 5, spawnInterval: 7, spawnMinInterval: 4,
    },
    standard: {
        ...common, id: 'standard', name: '标准店', customerSlots: 3, target: 150,
        ingredients: ['tea', 'milk', 'pearl', 'jelly'],
        recipes: [
            { recipeId: 'milk-tea', afterServed: 0 }, { recipeId: 'pearl-milk-tea', afterServed: 0 },
            { recipeId: 'jelly-milk-tea', afterServed: 2 }, { recipeId: 'mixed-milk-tea', afterServed: 5 },
        ],
        spawnInitialDelay: 4, spawnInterval: 6, spawnMinInterval: 3,
    },
    premium: {
        ...common, id: 'premium', name: '高档店', customerSlots: 4, target: 200,
        ingredients: ['tea', 'milk', 'pearl', 'jelly'],
        recipes: [
            { recipeId: 'milk-tea', afterServed: 0 }, { recipeId: 'pearl-milk-tea', afterServed: 0 },
            { recipeId: 'jelly-milk-tea', afterServed: 0 }, { recipeId: 'mixed-milk-tea', afterServed: 0 },
        ],
        spawnInitialDelay: 3, spawnInterval: 4.5, spawnMinInterval: 2.5,
    },
};

/** 先拒绝无法经营的配置，避免营业后生成玩家做不出的订单。 */
export function validateShopProfile(profile: ShopProfile): void {
    const fail = (message: string): never => { throw new Error(`店铺配置 ${profile.id || '(未命名)'}：${message}`); };
    if (!profile.id || !profile.name) fail('id 和 name 不能为空');
    if (!Number.isInteger(profile.customerSlots) || profile.customerSlots < 1) fail('customerSlots 必须是正整数');
    if (!Array.isArray(profile.ingredients) || !profile.ingredients.length) fail('ingredients 不能为空');
    const ingredients = new Set<Ingredient>();
    for (const ingredient of profile.ingredients) {
        if (!Object.prototype.hasOwnProperty.call(INGREDIENT_NAMES, ingredient)) fail(`未知原料 ${ingredient}`);
        if (ingredients.has(ingredient)) fail(`原料重复 ${ingredient}`);
        ingredients.add(ingredient);
    }
    if (!Array.isArray(profile.recipes) || !profile.recipes.length) fail('recipes 不能为空');
    const recipes = new Set<RecipeId>();
    for (const entry of profile.recipes) {
        const recipe = RECIPES.find(item => item.id === entry.recipeId);
        if (!recipe) fail(`未知配方 ${entry.recipeId}`);
        if (recipes.has(entry.recipeId)) fail(`配方重复 ${entry.recipeId}`);
        recipes.add(entry.recipeId);
        if (!Number.isInteger(entry.afterServed) || entry.afterServed < 0) fail(`配方 ${entry.recipeId} 的 afterServed 必须是非负整数`);
        const missing = recipe!.ingredients.filter(ingredient => !ingredients.has(ingredient));
        if (missing.length) fail(`配方 ${entry.recipeId} 缺少原料 ${missing.join(', ')}`);
    }
    if (!profile.recipes.some(entry => entry.afterServed === 0)) fail('至少需要一个开店即可制作的配方');
    for (const field of ['duration', 'sealDuration', 'placeDuration', 'departureDuration', 'spawnInitialDelay', 'spawnInterval', 'spawnMinInterval'] as const) {
        if (!Number.isFinite(profile[field]) || profile[field] <= 0) fail(`${field} 必须是正数`);
    }
    if (!Number.isFinite(profile.target) || profile.target < 0) fail('target 必须是非负数');
    if (!Number.isFinite(profile.spawnAcceleration) || profile.spawnAcceleration < 0) fail('spawnAcceleration 必须是非负数');
    if (profile.spawnMinInterval > profile.spawnInterval) fail('spawnMinInterval 不能超过 spawnInterval');
}
