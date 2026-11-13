import { _decorator, Component, Node, Sprite, UITransform } from 'cc';
import type { MaterialId } from '../../../config/Materials';

const { ccclass } = _decorator;

@ccclass('Container')
export class Container extends Component {
    private ingredientIds: MaterialId[] = [];

    /** 按点击顺序记录材料，同一种材料可以出现多次。 */
    get ingredients(): readonly MaterialId[] {
        return this.ingredientIds.slice();
    }

    addIngredient(id: MaterialId): number {
        return this.ingredientIds.push(id) - 1;
    }

    /** 将飞入的材料作为容器的子节点显示，随容器一起移动。 */
    showIngredient(item: Node, index: number): void {
        this.node.addChild(item);
        const visual = item.getComponentInChildren(Sprite)?.getComponent(UITransform);
        const size = visual ? Math.max(visual.contentSize.width, visual.contentSize.height) : 0;
        const factor = size > 0 ? Math.min(1, 48 / size) : 0.35;
        item.setScale(item.scale.x * factor, item.scale.y * factor, item.scale.z);
        // 前三列向两侧排开，更多材料向上堆叠，重复材料也能看见。
        item.setPosition((index % 3 - 1) * 32, 12 + Math.floor(index / 3) * 18, 0);
    }
}
