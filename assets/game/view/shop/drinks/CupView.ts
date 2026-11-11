import { _decorator, Component, Node, Vec3 } from 'cc';
import { easeOutCubic, easeOutQuad } from '../../../../framework/fx/Animator';
import { Draggable } from '../../../../framework/input/Draggable';
import { DrinkView } from './DrinkView';

const { ccclass, property } = _decorator;

/**
 * 制作台上那只可以拖动的杯子。
 * 本节点是杯子的位置；子节点「图案」负责缩放和拖动时的上抬；子节点「抓取区」比杯子大，方便手指按中。
 * 杯子该停在哪里由 ShopView 每帧通过 setRest 告诉它；这里只管怎么移动过去。
 * 不自己跑 update，由 ShopView 调用 tick，这样暂停时会一起冻结。
 */
@ccclass('CupView')
export class CupView extends Component {
    @property({ type: DrinkView, tooltip: '杯子图案' })
    drink: DrinkView = null!;
    @property({ type: Draggable, tooltip: '抓取区' })
    grab: Draggable = null!;
    @property({ tooltip: '拖动时杯子上抬多少，避免被手指挡住' })
    dragLift = 26;
    @property({ tooltip: '拖动时杯子放大到多少倍' })
    dragScale = 1.08;
    @property({ tooltip: '加料或封好时杯子弹一下的幅度' })
    pulseAmount = 0.08;
    @property({ tooltip: '弹一下的时长（秒）' })
    pulseDuration = 0.3;

    private restX = 0;
    private restY = 0;
    private restScale = 1;
    private grip = 0;
    private pulseLeft = 0;
    private returning: { fromX: number; fromY: number; fromScale: number; time: number; duration: number } | null = null;

    get dragging(): boolean { return this.grab.dragging; }

    /** 落点判定用的位置（世界坐标）：杯子图案的中心，包含拖动时的上抬，和看到的画面一致。 */
    get dropPoint(): Readonly<Vec3> { return this.art.worldPosition; }

    private get art(): Node { return this.drink.node; }

    onLoad() {
        this.grab.node.on(Draggable.EventType.BEGIN, this.onDragBegin, this);
        this.grab.node.on(Draggable.EventType.CANCEL, this.snap, this);
    }

    /** 设置杯子不被拖动时应该停留的位置和大小（父节点坐标）。 */
    setRest(x: number, y: number, scale: number): void {
        this.restX = x;
        this.restY = y;
        this.restScale = scale;
    }

    /** 弹一下，提示杯子有变化。 */
    pulse(): void {
        this.pulseLeft = this.pulseDuration;
    }

    /** 松手后调用：在 duration 秒内飞回停留位置，而不是瞬间跳回去。 */
    release(duration: number): void {
        // 把图案的上抬并入本节点，飞回过程中图案就不用再单独处理位移。
        const releasedPosition = this.art.worldPosition.clone();
        this.node.setWorldPosition(releasedPosition);
        this.art.setPosition(0, 0);
        if (duration <= 0) { this.snap(); return; }
        this.returning = { fromX: this.node.position.x, fromY: this.node.position.y, fromScale: this.art.scale.x, time: 0, duration };
    }

    /** 立即回到停留位置。 */
    snap(): void {
        this.returning = null;
        this.node.setPosition(this.restX, this.restY);
        this.art.setPosition(0, 0);
        this.art.setScale(this.restScale, this.restScale, 1);
    }

    tick(dt: number): void {
        this.pulseLeft = Math.max(0, this.pulseLeft - dt);
        const art = this.art;
        if (this.dragging) {
            // 上抬和放大渐入，抓起的瞬间杯子不会跳一下。
            this.grip = Math.min(1, this.grip + dt * 13);
            const ease = easeOutQuad(this.grip);
            const scale = this.restScale + (this.dragScale - this.restScale) * ease;
            art.setPosition(0, this.dragLift * ease);
            art.setScale(scale, scale, 1);
        } else if (this.returning) {
            const r = this.returning;
            r.time = Math.min(r.duration, r.time + dt);
            const ease = easeOutCubic(r.time / r.duration);
            const scale = r.fromScale + (this.restScale - r.fromScale) * ease;
            this.node.setPosition(r.fromX + (this.restX - r.fromX) * ease, r.fromY + (this.restY - r.fromY) * ease);
            art.setScale(scale, scale, 1);
            if (r.time >= r.duration) this.returning = null;
        } else {
            const squash = 1 + Math.sin(this.pulseLeft / this.pulseDuration * Math.PI) * this.pulseAmount;
            this.node.setPosition(this.restX, this.restY);
            art.setPosition(0, 0);
            art.setScale(this.restScale * squash, this.restScale, 1);
        }
    }

    private onDragBegin() {
        this.grip = 0;
        this.returning = null;
    }
}
