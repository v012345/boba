import { _decorator, Component, Node, UITransform } from 'cc';
import { DropCandidate, pickDrop } from './DropPick';

const { ccclass, property } = _decorator;

/**
 * 放置区：拖动的东西可以放到这里。范围就是所在节点的矩形。
 * 它只负责「有没有命中」和提示的显示，命中后做什么由游戏决定。
 */
@ccclass('DropZone')
export class DropZone extends Component {
    @property({ tooltip: '松手点在范围外多远以内仍算命中。0 表示必须落在范围内' })
    snapRadius = 0;
    @property({ type: Node, tooltip: '拖动进行中显示的提示（比如描边），可以不填' })
    idleHint: Node | null = null;
    @property({ type: Node, tooltip: '拖动物悬在本区域上方时显示的提示，可以不填' })
    hoverHint: Node | null = null;

    /** 当前是否接受放置。不接受时不参与命中，也不显示提示。 */
    accepting = true;

    onLoad() {
        this.showHint(false, false);
    }

    /**
     * 在一组放置区里找出世界坐标 (x, y) 命中的那个。
     * 直接落在范围内的优先（靠前的优先），否则按各自的 snapRadius 就近吸附。
     */
    static pick(zones: readonly DropZone[], x: number, y: number): DropZone | null {
        const candidates: DropCandidate<DropZone>[] = [];
        for (const zone of zones) {
            if (!zone.accepting || !zone.node.activeInHierarchy) continue;
            candidates.push({ rect: zone.getComponent(UITransform)!.getBoundingBoxToWorld(), snapRadius: zone.snapRadius, value: zone });
        }
        return pickDrop(candidates, x, y);
    }

    /** 刷新一组放置区的提示：dragging 表示是否正在拖动，hovered 是当前悬停的区域。 */
    static showHints(zones: readonly DropZone[], dragging: boolean, hovered: DropZone | null): void {
        for (const zone of zones) zone.showHint(dragging && zone.accepting, zone === hovered);
    }

    private showHint(dragging: boolean, hovered: boolean): void {
        if (this.idleHint) this.idleHint.active = dragging && !hovered;
        if (this.hoverHint) this.hoverHint.active = dragging && hovered;
    }
}
