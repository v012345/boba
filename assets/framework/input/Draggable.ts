import { _decorator, Component, EventTouch, Node, Size, UITransform, Vec3 } from 'cc';

const { ccclass, property } = _decorator;

/** 拖动结束时附带的信息。 */
export interface DragEndInfo {
    /** 手指几乎没动就松开了，应当视为点击而不是拖放。 */
    tap: boolean;
}

/**
 * 拖拽：按住本节点（抓取区）拖动，target 节点跟着手指走。
 * 抓取区可以比被拖的东西大，方便手指按中；它一般是 target 的子节点。
 *
 * 本组件只负责「跟手」和把过程通知出去，放到哪里、放下后发生什么由游戏决定。
 * 在本节点上监听这些事件：
 * - Draggable.EventType.BEGIN：开始拖动
 * - Draggable.EventType.MOVE：拖动中
 * - Draggable.EventType.END：松手，参数是 DragEndInfo
 * - Draggable.EventType.CANCEL：被打断（来电、切后台，或代码调用了 cancel）
 */
@ccclass('Draggable')
export class Draggable extends Component {
    static readonly EventType = {
        BEGIN: 'drag-begin',
        MOVE: 'drag-move',
        END: 'drag-end',
        CANCEL: 'drag-cancel',
    } as const;

    @property({ type: Node, tooltip: '被拖动的节点。不填则拖动本节点' })
    target: Node | null = null;
    @property({ tooltip: '手指移动不超过这个距离就松开，算作点击' })
    tapDistance = 8;

    /** 每次按下时询问是否允许开始拖动，返回 false 则这次按下无效。不设置则总是允许。 */
    canBegin: (() => boolean) | null = null;

    private touchId: number | null = null;
    private offset = new Vec3();
    private startPoint = new Vec3();
    private moved = 0;
    private restSize = new Size();

    /** 是否正在拖动。 */
    get dragging(): boolean { return this.touchId !== null; }

    onEnable() {
        this.node.on(Node.EventType.TOUCH_START, this.onTouchStart, this);
        this.node.on(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
        this.node.on(Node.EventType.TOUCH_END, this.onTouchEnd, this);
        this.node.on(Node.EventType.TOUCH_CANCEL, this.onTouchCancel, this);
    }

    onDisable() {
        this.node.off(Node.EventType.TOUCH_START, this.onTouchStart, this);
        this.node.off(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
        this.node.off(Node.EventType.TOUCH_END, this.onTouchEnd, this);
        this.node.off(Node.EventType.TOUCH_CANCEL, this.onTouchCancel, this);
        this.cancel();
    }

    /** 中止当前拖动。target 停在原地，由游戏决定把它放回哪里。 */
    cancel(): void {
        if (!this.finish()) return;
        this.node.emit(Draggable.EventType.CANCEL);
    }

    private get moving(): Node { return this.target || this.node; }

    private onTouchStart(event: EventTouch) {
        if (this.dragging || (this.canBegin && !this.canBegin())) return;
        const point = this.touchPoint(event);
        this.touchId = event.getID();
        Vec3.subtract(this.offset, this.moving.worldPosition, point);
        this.startPoint.set(point);
        this.moved = 0;
        // 引擎规定：手指在节点范围外松开算「取消」而不是「松手」。
        // 所以拖动期间把抓取区撑到盖住整个屏幕，松手就一定落在范围内。
        const transform = this.getComponent(UITransform)!;
        this.restSize.set(transform.contentSize);
        transform.setContentSize(100000, 100000);
        event.propagationStopped = true;
        this.node.emit(Draggable.EventType.BEGIN);
    }

    private onTouchMove(event: EventTouch) {
        if (event.getID() !== this.touchId) return;
        event.propagationStopped = true;
        const point = this.touchPoint(event);
        this.moved = Math.max(this.moved, Vec3.distance(point, this.startPoint));
        this.moving.setWorldPosition(point.add(this.offset));
        this.node.emit(Draggable.EventType.MOVE);
    }

    private onTouchEnd(event: EventTouch) {
        if (event.getID() !== this.touchId) return;
        event.propagationStopped = true;
        const info: DragEndInfo = { tap: this.moved < this.tapDistance };
        this.finish();
        this.node.emit(Draggable.EventType.END, info);
    }

    private onTouchCancel(event: EventTouch) {
        if (event.getID() !== this.touchId) return;
        event.propagationStopped = true;
        this.cancel();
    }

    /** 结束拖动状态并恢复抓取区大小。返回之前是否在拖动。 */
    private finish(): boolean {
        if (!this.dragging) return false;
        this.touchId = null;
        this.getComponent(UITransform)!.setContentSize(this.restSize);
        return true;
    }

    /** 触点的世界坐标。 */
    private touchPoint(event: EventTouch): Vec3 {
        const location = event.getUILocation();
        return new Vec3(location.x, location.y, 0);
    }
}
