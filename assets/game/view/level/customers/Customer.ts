import { _decorator, Color, Component, Label, Node, UITransform, tween, Vec3 } from 'cc';
import { RoundRect } from '../../../../framework/ui/RoundRect';
import { Materials } from '../../../config/Materials';
import { Texts } from '../../../config/Texts';
import type { MaterialId } from '../../../config/Materials';
import type { LevelOrderConfig } from '../../../config/LevelOrders';

const { ccclass } = _decorator;
type CustomerState = 'waiting' | 'leaving';

/** 一位顾客的订单和交付状态。 */
@ccclass('Customer')
export class Customer extends Component {
    private state: CustomerState = 'waiting';
    private order: LevelOrderConfig | null = null;
    private orderLabel: Label | null = null;

    get waiting(): boolean { return this.state === 'waiting'; }

    setOrder(order: LevelOrderConfig): void {
        this.order = order;
        const bubble = new Node('Order');
        bubble.layer = this.node.layer;
        bubble.setPosition(125, 105, 0);
        this.node.addChild(bubble);
        bubble.addComponent(UITransform).setContentSize(190, 65);
        bubble.addComponent(RoundRect).color = new Color(239, 229, 210, 255);
        const text = new Node('OrderText');
        text.layer = bubble.layer;
        bubble.addChild(text);
        text.addComponent(UITransform).setContentSize(180, 60);
        const label = text.addComponent(Label);
        label.fontSize = 20;
        label.lineHeight = 25;
        label.color = new Color(49, 35, 30, 255);
        label.string = `${Texts.get('customer.wants')}\n${this.orderNames(order)}`;
        this.orderLabel = label;
    }

    private orderNames(order: LevelOrderConfig): string {
        return order.Materials.map(id => {
            const material = Materials.getCfg(id);
            if (!material) throw new Error(`找不到材料配置：${id}`);
            return Texts.get(material.NameTextId);
        }).join(' + ');
    }

    /** 不依赖加料顺序，按种类和数量准确匹配。 */
    matches(ingredients: readonly MaterialId[]): boolean {
        if (this.state !== 'waiting' || !this.order || ingredients.length !== this.order.Materials.length) return false;
        const remaining = [...ingredients];
        return this.order.Materials.every(id => {
            const index = remaining.indexOf(id);
            if (index < 0) return false;
            remaining.splice(index, 1);
            return true;
        });
    }

    showMismatch(): void {
        if (!this.order || !this.orderLabel) return;
        this.orderLabel.string = `${Texts.get('customer.mismatch')}\n${this.orderNames(this.order)}`;
    }

    leave(): void {
        this.state = 'leaving';
        if (this.orderLabel) this.orderLabel.string = Texts.get('customer.thanks');
        tween(this.node).to(0.45, { position: this.node.position.clone().add(new Vec3(0, -160, 0)) }, { easing: 'quadIn' })
            .call(() => { if (this.isValid) this.node.destroy(); }).start();
    }
}
