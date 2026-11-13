import { _decorator, Component, Node, UITransform, Vec3 } from 'cc';

const { ccclass } = _decorator;

/** 容器暂存区，每个槽位最多放一个容器。 */
@ccclass('HoldingArea')
export class HoldingArea extends Component {
    capacity = 1;
    private slots: (Node | null)[] = [];

    store(container: Node): Vec3 | null {
        let index = -1;
        for (let i = 0; i < this.capacity; i++) {
            if (!this.slots[i]?.isValid) { index = i; break; }
        }
        if (index < 0) return null;
        this.slots[index] = container;
        return this.slotPosition(index);
    }

    remove(container: Node): void {
        const index = this.slots.indexOf(container);
        if (index >= 0) this.slots[index] = null;
    }

    private slotPosition(index: number): Vec3 {
        const transform = this.node.getComponent(UITransform)!;
        const width = transform.contentSize.width;
        const local = new Vec3(-width / 2 + width * (index + 0.5) / this.capacity, 0, 0);
        return transform.convertToWorldSpaceAR(local);
    }
}
