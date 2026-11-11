import { _decorator, Component, Node, sp } from 'cc';
import { DropZone } from '../../../../framework/input/DropZone';

const { ccclass, property } = _decorator;

/**
 * 垃圾桶：杯子拖到上方时开盖，丢进去后弹一下再合上。
 * 用 Spine 动画，需要有 open、close、bounce 三个动作。
 * 不自己跑 update，由 ShopView 调用 tick，这样暂停时会一起冻结。
 */
@ccclass('BinView')
export class BinView extends Component {
    @property(sp.Skeleton)
    skeleton: sp.Skeleton = null!;
    @property({ type: Node, tooltip: '桶口的位置，丢弃的杯子会飞向这里' })
    mouth: Node = null!;
    @property({ type: DropZone, tooltip: '随垃圾桶一起移动的放置区' })
    dropZone: DropZone = null!;
    @property({ tooltip: '杯子掉进去的这段时间里保持开盖（秒）' })
    swallowTime = 0.25;

    private ready = false;
    private open = false;
    private swallowing = 0;

    start() {
        this.prepare();
    }

    /** 暂停或恢复动画。 */
    set paused(value: boolean) {
        if (this.skeleton.paused !== value) this.skeleton.paused = value;
    }

    /** 开盖或合盖。吞杯子的过程中会保持开着。 */
    setOpen(open: boolean): void {
        this.prepare();
        if (this.swallowing > 0) open = true;
        if (open === this.open) return;
        this.open = open;
        this.skeleton.setAnimation(0, open ? 'open' : 'close', false);
    }

    /** 有杯子丢进来：保持开盖一小会儿，然后弹一下。 */
    swallow(): void {
        this.swallowing = this.swallowTime;
        this.setOpen(true);
    }

    /** hovered 表示此刻是否还有杯子悬在桶上方，决定吞完后盖子合不合。 */
    tick(dt: number, hovered: boolean): void {
        if (this.swallowing <= 0) return;
        this.swallowing = Math.max(0, this.swallowing - dt);
        if (this.swallowing > 0) return;
        this.skeleton.setAnimation(1, 'bounce', false);
        this.setOpen(hovered);
    }

    private prepare(): void {
        if (this.ready) return;
        this.ready = true;
        this.skeleton.setToSetupPose();
        // open 动作的第一帧就是合盖的样子：停在这一帧不播放。
        const entry = this.skeleton.setAnimation(0, 'open', false);
        if (entry) entry.timeScale = 0;
    }
}
