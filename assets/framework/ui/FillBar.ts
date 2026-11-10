import { _decorator, Color, Component, UITransform } from 'cc';
import { RoundRect } from './RoundRect';

const { ccclass, property } = _decorator;

/**
 * 进度条：按比例改变「填充条」的宽度。本节点的宽度就是满格时的长度。
 * 填充条是本节点下的一个子节点，锚点 X 设为 0、贴在本节点左边缘，上面挂 RoundRect。
 */
@ccclass('FillBar')
export class FillBar extends Component {
    @property({ type: RoundRect, tooltip: '填充条' })
    fill: RoundRect = null!;
    @property({ tooltip: '进度大于 0 时填充条的最小宽度，避免圆角挤成一团' })
    minLength = 8;

    /** 设置进度（0–1），可以同时换颜色。进度为 0 时隐藏填充条。 */
    set(ratio: number, color?: Color): void {
        const clamped = Math.max(0, Math.min(1, ratio));
        const fillNode = this.fill.node;
        fillNode.active = clamped > 0;
        if (clamped <= 0) return;
        const total = this.getComponent(UITransform)!.width;
        const transform = fillNode.getComponent(UITransform)!;
        const width = Math.max(this.minLength, total * clamped);
        if (transform.width !== width) transform.width = width;
        if (color && !this.fill.color.equals(color)) this.fill.color = color;
    }
}
