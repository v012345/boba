/**
 * 事件总线：让模块之间不用互相认识。
 * 发出方只管 emit「发生了什么」，关心这件事的模块各自 on 监听。
 *
 * Events 是「事件名 → 携带数据」的对照表，事件名或数据写错时编译器会报错。
 * 不带数据的事件把类型写成 void，emit 时就不用传第二个参数。
 */
type Handler<T> = (payload: T) => void;
interface Listener { handler: Handler<any>; target: unknown; once: boolean; removed: boolean }

export class EventBus<Events extends object> {
    // 数组只整体替换、不原地修改，所以 emit 遍历途中增删监听是安全的。
    private listeners = new Map<keyof Events, Listener[]>();

    /** 监听事件。target 一般传 this：回调里的 this 就是它，之后可用 offTarget(this) 一次取消。 */
    on<K extends keyof Events>(event: K, handler: Handler<Events[K]>, target?: unknown): void {
        this.add(event, handler, target, false);
    }

    /** 只响应一次，触发后自动取消。 */
    once<K extends keyof Events>(event: K, handler: Handler<Events[K]>, target?: unknown): void {
        this.add(event, handler, target, true);
    }

    /** 取消监听，handler 和 target 要与 on 时传的一致。 */
    off<K extends keyof Events>(event: K, handler: Handler<Events[K]>, target?: unknown): void {
        this.remove(event, listener => listener.handler === handler && listener.target === target);
    }

    /** 取消某个对象注册的全部监听，通常在它销毁或退出时调用。 */
    offTarget(target: unknown): void {
        if (target === undefined || target === null) return;
        for (const event of Array.from(this.listeners.keys())) {
            this.remove(event, listener => listener.target === target);
        }
    }

    emit<K extends keyof Events>(event: K, ...payload: Events[K] extends void ? [] : [Events[K]]): void {
        const list = this.listeners.get(event);
        if (!list) return;
        for (const listener of list) {
            // 同一轮里被前面的回调取消掉的监听不再触发。
            if (listener.removed) continue;
            if (listener.once) this.remove(event, item => item === listener);
            listener.handler.call(listener.target, payload[0] as Events[K]);
        }
    }

    private add(event: keyof Events, handler: Handler<any>, target: unknown, once: boolean): void {
        const list = this.listeners.get(event) || [];
        this.listeners.set(event, [...list, { handler, target, once, removed: false }]);
    }

    private remove(event: keyof Events, match: (listener: Listener) => boolean): void {
        const list = this.listeners.get(event);
        if (!list) return;
        const kept = list.filter(listener => {
            if (!match(listener)) return true;
            listener.removed = true;
            return false;
        });
        if (kept.length) this.listeners.set(event, kept);
        else this.listeners.delete(event);
    }
}
