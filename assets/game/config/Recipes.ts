/** 配方与原料的稳定标识。资源和规则共用这一份定义。 */
export type Ingredient = 'tea' | 'milk' | 'pearl' | 'jelly';
export type RecipeId = 'milk-tea' | 'pearl-milk-tea' | 'jelly-milk-tea' | 'mixed-milk-tea';

export interface Recipe {
    id: RecipeId;
    name: string;
    ingredients: Ingredient[];
    price: number;
    color: string;
}

export const INGREDIENT_NAMES: Record<Ingredient, string> = {
    tea: '红茶', milk: '鲜奶', pearl: '珍珠', jelly: '椰果',
};

/** 顾客状态仍保存此数组的索引；店铺配置用稳定的 id 引用配方。 */
export const RECIPES: Recipe[] = [
    { id: 'milk-tea', name: '原味奶茶', ingredients: ['tea', 'milk'], price: 18, color: '#CB9569' },
    { id: 'pearl-milk-tea', name: '珍珠奶茶', ingredients: ['tea', 'milk', 'pearl'], price: 24, color: '#BD875B' },
    { id: 'jelly-milk-tea', name: '椰果奶茶', ingredients: ['tea', 'milk', 'jelly'], price: 24, color: '#DEB68A' },
    { id: 'mixed-milk-tea', name: '双拼奶茶', ingredients: ['tea', 'milk', 'pearl', 'jelly'], price: 30, color: '#C89C70' },
];
