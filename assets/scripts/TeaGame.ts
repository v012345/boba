/** Engine-independent game rules. All durations are in seconds. */
export type Ingredient = 'tea' | 'milk' | 'pearl' | 'jelly';
export interface Recipe { name: string; ingredients: Ingredient[]; price: number; color: string }
export const INGREDIENT_NAMES: Record<Ingredient, string> = {
    tea: '红茶', milk: '鲜奶', pearl: '珍珠', jelly: '椰果',
};
export const RECIPES: Recipe[] = [
    { name: '原味奶茶', ingredients: ['tea', 'milk'], price: 18, color: '#CB9569' },
    { name: '珍珠奶茶', ingredients: ['tea', 'milk', 'pearl'], price: 24, color: '#BD875B' },
    { name: '椰果奶茶', ingredients: ['tea', 'milk', 'jelly'], price: 24, color: '#DEB68A' },
    { name: '双拼奶茶', ingredients: ['tea', 'milk', 'pearl', 'jelly'], price: 30, color: '#C89C70' },
];
export interface Customer { id: number; recipe: number; patience: number; maxPatience: number }
export interface Cup { ingredients: Ingredient[]; state: 'empty' | 'making' | 'sealing' | 'ready'; remaining: number }
export class TeaGame {
    readonly duration = 90;
    readonly target = 150;
    time = this.duration;
    money = 0;
    served = 0;
    lost = 0;
    combo = 0;
    bestCombo = 0;
    selected = 0;
    paused = false;
    ended = false;
    customers: (Customer | null)[] = [null, null, null];
    cups: Cup[] = [this.emptyCup(), this.emptyCup()];
    message = '开店啦！先做一杯原味奶茶：红茶 → 鲜奶 → 封杯。';
    private nextId = 1;
    private spawnIn = 4;
    constructor(private random: () => number = Math.random) { this.spawn(0); }
    private emptyCup(): Cup { return { ingredients: [], state: 'empty', remaining: 0 }; }
    private spawn(slot: number) {
        const unlocked = this.served < 2 ? 2 : this.served < 5 ? 3 : 4;
        const recipe = this.nextId === 1 ? 0 : Math.floor(this.random() * unlocked);
        const maxPatience = Math.max(22, 38 - this.served * 0.8);
        this.customers[slot] = { id: this.nextId++, recipe, patience: maxPatience, maxPatience };
    }
    get active(): boolean { return !this.paused && !this.ended; }
    select(index: number) { if (this.active && index >= 0 && index < this.cups.length) this.selected = index; }
    add(ingredient: Ingredient) {
        if (!this.active) return;
        const cup = this.cups[this.selected];
        if (cup.state === 'sealing' || cup.state === 'ready') { this.message = '这杯已经封口，请交付或倒掉后重做。'; return; }
        if (cup.ingredients.indexOf(ingredient) >= 0) { this.message = '这份配料已经加过啦。'; return; }
        if (!cup.ingredients.length && ingredient !== 'tea') { this.message = '先加入红茶作为茶底。'; return; }
        cup.ingredients.push(ingredient);
        cup.state = 'making';
        this.message = `${this.selected + 1} 号杯已加入${INGREDIENT_NAMES[ingredient]}。`;
    }
    seal() {
        if (!this.active) return;
        const cup = this.cups[this.selected];
        if (cup.state !== 'making') { this.message = '请选择一杯制作中的奶茶。'; return; }
        if (cup.ingredients.indexOf('milk') < 0) { this.message = '奶茶还缺鲜奶哦。'; return; }
        cup.state = 'sealing'; cup.remaining = 2.5;
        this.message = '封杯中，可以切换另一个杯位继续制作。';
    }
    discard() {
        if (!this.active) return;
        if (this.cups[this.selected].state === 'empty') return;
        this.cups[this.selected] = this.emptyCup();
        this.combo = 0;
        this.message = '已倒掉重做，连击重置。';
    }
    deliver(slot: number): boolean {
        if (!this.active) return false;
        const customer = this.customers[slot];
        const cup = this.cups[this.selected];
        if (!customer) { this.message = '这个位置还没有顾客。'; return false; }
        if (cup.state !== 'ready') { this.message = '先完成封杯，再点击顾客交付。'; return false; }
        const recipe = RECIPES[customer.recipe];
        if (cup.ingredients.length !== recipe.ingredients.length || !recipe.ingredients.every(i => cup.ingredients.indexOf(i) >= 0)) {
            customer.patience = Math.max(0, customer.patience - 5); this.combo = 0;
            this.message = '配方不对！顾客耐心 -5 秒，奶茶保留，可交给其他顾客。'; return false;
        }
        this.combo++;
        this.bestCombo = Math.max(this.bestCombo, this.combo);
        const bonus = Math.min(10, (this.combo - 1) * 2);
        this.money += recipe.price + bonus;
        this.served++;
        this.customers[slot] = null;
        this.cups[this.selected] = this.emptyCup();
        this.message = `交付${recipe.name}！+¥${recipe.price}${bonus ? `，连击奖励 +¥${bonus}` : ''}`;
        return true;
    }
    tick(dt: number) {
        if (!this.active || !Number.isFinite(dt) || dt <= 0) return;
        dt = Math.min(dt, this.time);
        this.time = Math.max(0, this.time - dt);
        for (const cup of this.cups) {
            if (cup.state === 'sealing') {
                cup.remaining = Math.max(0, cup.remaining - dt);
                if (cup.remaining === 0) { cup.state = 'ready'; this.message = '奶茶封好啦！选中杯子，点击对应顾客交付。'; }
            }
        }
        this.customers.forEach((customer, slot) => {
            if (!customer) return;
            customer.patience -= dt;
            if (customer.patience <= 0) {
                this.customers[slot] = null; this.lost++; this.combo = 0;
                this.message = '顾客等不及离开了，优先照顾耐心快耗尽的人。';
            }
        });
        this.spawnIn -= dt;
        if (this.spawnIn <= 0 && this.time > 5) {
            const slot = this.customers.findIndex(c => !c);
            if (slot >= 0) { this.spawn(slot); this.spawnIn = Math.max(3, 6 - this.served * 0.15); }
            else this.spawnIn = 0;
        }
        if (this.time === 0) { this.ended = true; this.message = '营业结束'; }
    }
}
