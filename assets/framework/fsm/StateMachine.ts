/**
 * 状态机：同一时刻只处于一个状态，切换时先退出旧状态、再进入新状态。
 * 既可以管整个游戏的流程（菜单 → 游戏中 → 结算），也可以管单个对象（杯子：空 → 制作中 → 完成）。
 *
 * Ctx 是状态要操作的对象（上下文），每个回调都会收到它，
 * 所以状态本身可以不存数据，多个对象能共用同一份状态定义。
 */
export interface State<Ctx> {
    /** 进入时调用。from 是上一个状态名，首次进入时为 null。 */
    enter?(ctx: Ctx, from: string | null): void;
    /** 处于该状态时每帧调用。 */
    update?(ctx: Ctx, dt: number): void;
    /** 离开时调用。to 是即将进入的状态名。 */
    exit?(ctx: Ctx, to: string): void;
}

export class StateMachine<Ctx> {
    private ctx: Ctx;
    private states = new Map<string, State<Ctx>>();
    private currentName: string | null = null;
    private changing = false;
    private pending: string | null = null;

    constructor(ctx: Ctx) { this.ctx = ctx; }

    /** 注册状态，返回自身以便连着写。同名重复注册视为写错，直接报错。 */
    add(name: string, state: State<Ctx>): this {
        if (this.states.has(name)) throw new Error(`状态重复注册：${name}`);
        this.states.set(name, state);
        return this;
    }

    /** 当前状态名，还没进入任何状态时为 null。 */
    get current(): string | null { return this.currentName; }

    is(name: string): boolean { return this.currentName === name; }

    /**
     * 切换状态。切到当前状态会重新走一遍 exit 和 enter，可用于「再来一局」。
     * 在 enter 或 exit 里再次调用 change 时，会等本次切换完成后再接着切。
     */
    change(name: string): void {
        if (!this.states.has(name)) throw new Error(`状态未注册：${name}`);
        if (this.changing) { this.pending = name; return; }
        this.changing = true;
        try {
            let to: string | null = name;
            while (to !== null) {
                this.pending = null;
                const from = this.currentName;
                if (from !== null) this.states.get(from)!.exit?.(this.ctx, to);
                this.currentName = to;
                this.states.get(to)!.enter?.(this.ctx, from);
                to = this.pending;
            }
        } finally {
            this.changing = false;
            this.pending = null;
        }
    }

    /** 每帧调用一次，驱动当前状态的 update。 */
    update(dt: number): void {
        if (this.currentName === null) return;
        this.states.get(this.currentName)!.update?.(this.ctx, dt);
    }
}
