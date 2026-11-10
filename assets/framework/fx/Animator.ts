/**
 * 简易动画驱动：登记「在一段时间内每帧做点什么」，由外部每帧调用 update(dt) 推进。
 * 时间由调用方给：游戏暂停时不调用 update，所有动画就自然冻结。
 */
interface Item { age: number; duration: number; step: (t: number) => void; done: (() => void) | undefined }

export class Animator {
    private items: Item[] = [];
    private epoch = 0;

    /** 正在进行的动画数量。 */
    get running(): number { return this.items.length; }

    /**
     * 在 duration 秒内每帧调用 step(t)，t 从 0 匀速走到 1。
     * 结束时保证以 t = 1 调用一次 step，然后调用 done。
     */
    run(duration: number, step: (t: number) => void, done?: () => void): void {
        if (duration <= 0) { step(1); done?.(); return; }
        this.items.push({ age: 0, duration, step, done });
    }

    update(dt: number): void {
        const epoch = this.epoch;
        const current = this.items;
        // 回调里新登记的动画进入新数组，下一帧才开始推进。
        this.items = [];
        const alive: Item[] = [];
        for (const item of current) {
            item.age += dt;
            const t = Math.min(1, item.age / item.duration);
            item.step(t);
            if (this.epoch !== epoch) return;
            if (t < 1) { alive.push(item); continue; }
            item.done?.();
            if (this.epoch !== epoch) return;
        }
        this.items = alive.concat(this.items);
    }

    /** 丢弃所有动画，不再调用它们的 step 和 done。 */
    clear(): void {
        this.items = [];
        this.epoch++;
    }
}

/** 先快后慢。 */
export function easeOutCubic(t: number): number { return 1 - Math.pow(1 - t, 3); }
/** 先快后慢，比 easeOutCubic 柔和。 */
export function easeOutQuad(t: number): number { return t * (2 - t); }
