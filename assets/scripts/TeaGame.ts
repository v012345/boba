/** Engine-independent game rules. All durations are in seconds. */
export type Ingredient = 'tea' | 'milk' | 'pearl' | 'jelly';
export type CupSize = 'S' | 'M' | 'L';
// One shared supply today. Later each entry can own its stack art and price rules.
export const CUP_SUPPLIES: { size: CupSize; label: string; shelfX: number }[] = [
    { size: 'M', label: '空杯', shelfX: 0 },
];
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
export interface Customer { id: number; recipe: number; patience: number; maxPatience: number; state: 'thinking' | 'ordering' | 'accepted'; thinkRemaining: number }
export interface Cup { ingredients: Ingredient[]; state: 'stored' | 'placing' | 'empty' | 'making' | 'sealing' | 'ready'; remaining: number; size?: CupSize }
export class TeaGame {
    readonly duration = 90;
    readonly target = 150;
    readonly sealDuration = 1;
    readonly departureDuration = 1;
    private departureRemaining = [0, 0, 0];
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
    cups: Cup[] = [this.emptyCup()];
    message = '客人正在想喝什么。先点击桌下杯子，把空杯放上桌。';
    private nextId = 1;
    private spawnIn = 4;
    constructor(private random: () => number = Math.random) { this.spawn(0); }
    private emptyCup(): Cup { return { ingredients: [], state: 'stored', remaining: 0 }; }
    private spawn(slot: number) {
        const unlocked = this.served < 2 ? 2 : this.served < 5 ? 3 : 4;
        const recipe = this.nextId === 1 ? 0 : Math.floor(this.random() * unlocked);
        const maxPatience = Math.max(22, 38 - this.served * 0.8);
        this.customers[slot] = { id: this.nextId++, recipe, patience: maxPatience, maxPatience, state: 'thinking', thinkRemaining: 2.5 };
    }
    get active(): boolean { return !this.paused && !this.ended; }
    select(index: number) { if (this.active && Number.isInteger(index) && index >= 0 && index < this.cups.length) this.selected = index; }
    takeFromSupply(size: CupSize = 'M'): number {
        if (!this.active || !CUP_SUPPLIES.some(supply => supply.size === size)) return -1;
        const slot = this.cups[this.selected].state === 'stored'
            ? this.selected : this.cups.findIndex(cup => cup.state === 'stored');
        if (slot < 0) { this.message = '正在制作一杯，请先交付或拖进垃圾桶。'; return -1; }
        if (!this.takeCup(slot)) return -1;
        this.cups[slot].size = size;
        return slot;
    }
    takeCup(index: number): boolean {
        if (!this.active || !Number.isInteger(index) || index < 0 || index >= this.cups.length) return false;
        const cup = this.cups[index];
        if (cup.state !== 'stored') { this.message = '这个杯位正在使用，请先交付或倒掉。'; return false; }
        this.selected = index; cup.state = 'placing'; cup.remaining = 0.45;
        this.message = '正在把空杯放上桌…'; return true;
    }
    /** Grabbing the cup while it is still sliding onto the counter finishes the move and skips the wait. */
    settlePlacement(index: number = this.selected): boolean {
        if (!this.active) return false;
        const cup = this.cups[index];
        if (!cup || cup.state !== 'placing') return false;
        cup.state = 'empty'; cup.remaining = 0;
        this.message = '杯子放好了，点击桌面材料加料，或直接按住拖到封盖机。';
        return true;
    }
    acceptOrder(slot: number): boolean {
        if (!this.active) return false;
        const customer = this.customers[slot];
        if (!customer) return false;
        if (customer.state === 'thinking') { this.message = '客人还在想喝什么，稍等一下。'; return false; }
        if (customer.state === 'accepted') { this.message = '已经接单，封盖后把杯子拖给这位客人。'; return false; }
        customer.state = 'accepted';
        customer.patience = customer.maxPatience;
        this.message = `已接单：${RECIPES[customer.recipe].name}。取杯后按气泡配方制作。`;
        return true;
    }
    add(ingredient: Ingredient) {
        if (!this.active) return;
        const cup = this.cups[this.selected];
        if (cup.state === 'stored' || cup.state === 'placing') { this.message = '请先点击桌下杯子，等它放到桌面上。'; return; }
        if (cup.state === 'sealing' || cup.state === 'ready') { this.message = '杯子已进入封盖流程，完成后拖给客人或丢进垃圾桶。'; return; }
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
        cup.state = 'sealing'; cup.remaining = this.sealDuration;
        this.message = '机器正在封盖，1 秒后可拖给已接单的客人。';
    }
    discard() {
        if (!this.active) return;
        if (this.cups[this.selected].state === 'stored' || this.cups[this.selected].state === 'placing' || this.cups[this.selected].state === 'sealing') return;
        this.cups[this.selected] = this.emptyCup();
        this.combo = 0;
        this.message = '整杯已丢弃，连击重置。请从杯摞重新取杯。';
    }
    deliver(slot: number): boolean {
        if (!this.active) return false;
        const customer = this.customers[slot];
        const cup = this.cups[this.selected];
        if (!customer) { this.message = '这个位置还没有顾客。'; return false; }
        if (customer.state !== 'accepted') { this.message = '先等客人想好，再点击客人接单。'; return false; }
        if (cup.state !== 'ready') { this.message = '先拖到机器封盖，再拖给顾客。'; return false; }
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
        this.departureRemaining[slot] = this.departureDuration;
        this.cups[this.selected] = this.emptyCup();
        this.message = `交付${recipe.name}！+¥${recipe.price}${bonus ? `，连击奖励 +¥${bonus}` : ''}`;
        return true;
    }
    tick(dt: number) {
        if (!this.active || !Number.isFinite(dt) || dt <= 0) return;
        dt = Math.min(dt, this.time);
        this.time = Math.max(0, this.time - dt);
        this.departureRemaining = this.departureRemaining.map(time => Math.max(0, time - dt));
        for (const cup of this.cups) {
            if (cup.state === 'placing') {
                cup.remaining = Math.max(0, cup.remaining - dt);
                if (cup.remaining === 0) { cup.state = 'empty'; this.message = '杯子放好了，点击桌面材料加料。'; }
            } else if (cup.state === 'sealing') {
                cup.remaining = Math.max(0, cup.remaining - dt);
                if (cup.remaining === 0) { cup.state = 'ready'; this.message = '奶茶封好啦！把杯子从机器拖给对应顾客。'; }
            }
        }
        this.customers.forEach((customer, slot) => {
            if (!customer) return;
            let waitingTime = dt;
            if (customer.state === 'thinking') {
                waitingTime = Math.max(0, dt - customer.thinkRemaining);
                customer.thinkRemaining = Math.max(0, customer.thinkRemaining - dt);
                if (customer.thinkRemaining === 0) customer.state = 'ordering';
            }
            customer.patience -= waitingTime;
            if (customer.patience <= 0) {
                this.customers[slot] = null; this.lost++; this.combo = 0;
                this.departureRemaining[slot] = this.departureDuration;
                this.message = '顾客等不及离开了，优先照顾耐心快耗尽的人。';
            }
        });
        this.spawnIn -= dt;
        if (this.spawnIn <= 0 && this.time > 5) {
            const slot = this.customers.findIndex((c, index) => !c && this.departureRemaining[index] === 0);
            if (slot >= 0) { this.spawn(slot); this.spawnIn = Math.max(3, 6 - this.served * 0.15); }
            else this.spawnIn = 0;
        }
        if (this.time === 0) { this.ended = true; this.message = '营业结束'; }
    }
}
