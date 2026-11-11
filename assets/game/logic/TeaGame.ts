import type { EventBus } from '../../framework/core/EventBus';
import type { GameEvents } from '../GameEvents';
import { INGREDIENT_NAMES, RECIPES } from '../config/Recipes';
import type { Ingredient } from '../config/Recipes';
import { SHOP_PROFILES, validateShopProfile } from '../config/ShopProfiles';
import type { ShopProfile } from '../config/ShopProfiles';

// 保留旧导入路径，视图可以逐步改用 config/Recipes。
export { INGREDIENT_NAMES, RECIPES } from '../config/Recipes';
export type { Ingredient, Recipe, RecipeId } from '../config/Recipes';

/** Engine-independent game rules. All durations are in seconds. */
export type CupSize = 'S' | 'M' | 'L';
// One shared supply today. Later each entry can own its stack art and price rules.
export const CUP_SUPPLIES: { size: CupSize; label: string }[] = [
    { size: 'M', label: '空杯' },
];
export interface Customer { id: number; recipe: number; patience: number; maxPatience: number }
export interface Cup { ingredients: Ingredient[]; state: 'stored' | 'placing' | 'empty' | 'making' | 'sealing' | 'ready'; remaining: number; size?: CupSize }
export class TeaGame {
    readonly profile: ShopProfile;
    readonly duration: number;
    readonly target: number;
    readonly sealDuration: number;
    /** How long an empty cup takes to slide from the stack onto the counter. */
    readonly placeDuration: number;
    readonly departureDuration: number;
    private departureRemaining: number[];
    time: number;
    money = 0;
    served = 0;
    lost = 0;
    combo = 0;
    bestCombo = 0;
    selected = 0;
    paused = false;
    ended = false;
    customers: (Customer | null)[];
    cups: Cup[] = [this.emptyCup()];
    message = '客人已经点单，直接取杯制作。先点击桌下杯子，把空杯放上桌。';
    private nextId = 1;
    private spawnIn: number;
    private random: () => number;
    private events: EventBus<GameEvents> | undefined;
    /**
     * events is optional: pass the game's event bus to be told about arrivals, departures,
     * sealing and closing time. The first customer arrives inside the constructor, so a view
     * created afterwards has to read `customers` once instead of waiting for that event.
     */
    constructor(random: () => number = Math.random, events?: EventBus<GameEvents>, profile: ShopProfile = SHOP_PROFILES.standard) {
        validateShopProfile(profile);
        // 独立快照，避免编辑共享配置时改变已开始的一局。
        this.profile = Object.freeze({
            ...profile,
            ingredients: Object.freeze([...profile.ingredients]),
            recipes: Object.freeze(profile.recipes.map(entry => Object.freeze({ ...entry }))),
        });
        this.duration = profile.duration;
        this.target = profile.target;
        this.sealDuration = profile.sealDuration;
        this.placeDuration = profile.placeDuration;
        this.departureDuration = profile.departureDuration;
        this.time = this.duration;
        this.customers = Array.from({ length: profile.customerSlots }, () => null);
        this.departureRemaining = Array.from({ length: profile.customerSlots }, () => 0);
        this.spawnIn = profile.spawnInitialDelay;
        this.random = random;
        this.events = events;
        this.spawn(0);
    }
    private emptyCup(): Cup { return { ingredients: [], state: 'stored', remaining: 0 }; }
    // Customers order the moment they walk in: the bubble shows the recipe and the
    // patience bar starts ticking right away, so there is no accept step.
    private spawn(slot: number) {
        const unlocked = this.profile.recipes.filter(entry => this.served >= entry.afterServed);
        const entry = this.nextId === 1 ? unlocked[0] : unlocked[Math.floor(this.random() * unlocked.length)];
        const recipe = RECIPES.findIndex(item => item.id === entry.recipeId);
        const maxPatience = Math.max(26, 40 - this.served * 0.8);
        this.customers[slot] = { id: this.nextId++, recipe, patience: maxPatience, maxPatience };
        this.events?.emit('customer:arrived', { slot });
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
        this.selected = index; cup.state = 'placing'; cup.remaining = this.placeDuration;
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
    /** Returns whether the ingredient went into the cup. */
    add(ingredient: Ingredient): boolean {
        if (!this.active) return false;
        if (this.profile.ingredients.indexOf(ingredient) < 0) { this.message = '这家店没有提供这种原料。'; return false; }
        const cup = this.cups[this.selected];
        if (cup.state === 'stored' || cup.state === 'placing') { this.message = '请先点击桌下杯子，等它放到桌面上。'; return false; }
        if (cup.state === 'sealing' || cup.state === 'ready') { this.message = '杯子已进入封盖流程，完成后拖给客人或丢进垃圾桶。'; return false; }
        if (cup.ingredients.indexOf(ingredient) >= 0) { this.message = '这份配料已经加过啦。'; return false; }
        if (!cup.ingredients.length && ingredient !== 'tea') { this.message = '先加入红茶作为茶底。'; return false; }
        cup.ingredients.push(ingredient);
        cup.state = 'making';
        this.message = `${this.selected + 1} 号杯已加入${INGREDIENT_NAMES[ingredient]}。`;
        return true;
    }
    /** Returns whether the machine started sealing. */
    seal(): boolean {
        if (!this.active) return false;
        const cup = this.cups[this.selected];
        if (cup.state !== 'making') { this.message = '请选择一杯制作中的奶茶。'; return false; }
        if (cup.ingredients.indexOf('milk') < 0) { this.message = '奶茶还缺鲜奶哦。'; return false; }
        cup.state = 'sealing'; cup.remaining = this.sealDuration;
        this.message = `机器正在封盖，${this.sealDuration} 秒后拖给对应客人即可。`;
        return true;
    }
    /** Returns whether the cup was thrown away. */
    discard(): boolean {
        if (!this.active) return false;
        if (this.cups[this.selected].state === 'stored' || this.cups[this.selected].state === 'placing' || this.cups[this.selected].state === 'sealing') return false;
        this.cups[this.selected] = this.emptyCup();
        this.combo = 0;
        this.message = '整杯已丢弃，连击重置。请从杯摞重新取杯。';
        return true;
    }
    deliver(slot: number): boolean {
        if (!this.active) return false;
        const customer = this.customers[slot];
        const cup = this.cups[this.selected];
        if (!customer) { this.message = '这个位置还没有顾客。'; return false; }
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
        this.events?.emit('customer:left', { slot, served: true });
        return true;
    }
    tick(dt: number) {
        if (!this.active || !Number.isFinite(dt) || dt <= 0) return;
        dt = Math.min(dt, this.time);
        this.time = Math.max(0, this.time - dt);
        this.departureRemaining = this.departureRemaining.map(time => Math.max(0, time - dt));
        this.cups.forEach((cup, index) => {
            if (cup.state === 'placing') {
                cup.remaining = Math.max(0, cup.remaining - dt);
                if (cup.remaining === 0) { cup.state = 'empty'; this.message = '杯子放好了，点击桌面材料加料。'; }
            } else if (cup.state === 'sealing') {
                cup.remaining = Math.max(0, cup.remaining - dt);
                if (cup.remaining === 0) {
                    cup.state = 'ready'; this.message = '奶茶封好啦！把杯子从机器拖给对应顾客。';
                    this.events?.emit('cup:sealed', { cup: index });
                }
            }
        });
        this.customers.forEach((customer, slot) => {
            if (!customer) return;
            customer.patience -= dt;
            if (customer.patience <= 0) {
                this.customers[slot] = null; this.lost++; this.combo = 0;
                this.departureRemaining[slot] = this.departureDuration;
                this.message = '顾客等不及离开了，优先照顾耐心快耗尽的人。';
                this.events?.emit('customer:left', { slot, served: false });
            }
        });
        this.spawnIn -= dt;
        if (this.spawnIn <= 0 && this.time > 5) {
            const slot = this.customers.findIndex((c, index) => !c && this.departureRemaining[index] === 0);
            if (slot >= 0) {
                this.spawn(slot);
                this.spawnIn = Math.max(this.profile.spawnMinInterval, this.profile.spawnInterval - this.served * this.profile.spawnAcceleration);
            }
            else this.spawnIn = 0;
        }
        if (this.time === 0) {
            this.ended = true; this.message = '营业结束';
            this.events?.emit('session:ended', { money: this.money, target: this.target, served: this.served, lost: this.lost, bestCombo: this.bestCombo });
        }
    }
}
