import { _decorator, Color, Component, Node, Prefab, Sprite } from 'cc';
import type { ShopDefinition } from '../../config/Shops';
import { BinView } from './equipment/BinView';
import { SealerView } from './equipment/SealerView';
import { CupSupplyView } from './equipment/CupSupplyView';
import { WorkstationView } from './equipment/WorkstationView';
import { CupView } from './drinks/CupView';
import { CustomerView } from './customers/CustomerView';
import { IngredientTray } from './ingredients/IngredientTray';

const { ccclass, property } = _decorator;

/** 布局只保存摆放和共享 Prefab 引用；规则与主题由同一份店铺配置驱动。 */
@ccclass('ShopLayout')
export class ShopLayout extends Component {
    @property({ type: Node, tooltip: '杯子交付、配料颗粒、飘字的显示层' })
    effects: Node = null!;
    @property(Prefab)
    dropletPrefab: Prefab = null!;
    @property(Prefab)
    floatTextPrefab: Prefab = null!;

    /** 按层级顺序分配顾客 slot，避免依赖 Customer0/1/2 之类的固定名字。 */
    configure(shop: ShopDefinition) {
        const customers = this.getComponentsInChildren(CustomerView);
        if (customers.length < shop.profile.customerSlots) {
            throw new Error(`${shop.name} 需要 ${shop.profile.customerSlots} 个客位，布局只有 ${customers.length} 个`);
        }
        const allTrays = this.getComponentsInChildren(IngredientTray);
        for (const ingredient of shop.profile.ingredients) {
            if (!allTrays.some(tray => tray.ingredient === ingredient)) {
                throw new Error(`${shop.name} 的布局缺少原料：${ingredient}`);
            }
        }
        if (!this.effects || !this.dropletPrefab || !this.floatTextPrefab) {
            throw new Error(`${this.node.name} 未绑定特效层或特效 Prefab`);
        }

        customers.forEach((customer, index) => {
            customer.node.active = index < shop.profile.customerSlots;
            customer.calmColor = new Color(shop.theme.accentColor);
        });
        const trays = allTrays.filter(tray => {
            const enabled = shop.profile.ingredients.some(ingredient => ingredient === tray.ingredient);
            tray.node.active = enabled;
            return enabled;
        });
        this.tint('Background', shop.theme.backgroundColor);
        this.tint('Counter', shop.theme.counterColor);

        return {
            customers: customers.slice(0, shop.profile.customerSlots),
            trays,
            bin: this.single(BinView),
            sealer: this.single(SealerView),
            supply: this.single(CupSupplyView),
            station: this.single(WorkstationView),
            cup: this.single(CupView),
        };
    }

    private single<T extends Component>(type: new (...args: any[]) => T): T {
        const components = this.getComponentsInChildren(type);
        if (components.length !== 1) {
            throw new Error(`${this.node.name} 需要恰好一个 ${type.name}，实际为 ${components.length} 个`);
        }
        return components[0];
    }

    private tint(nodeName: string, color: string): void {
        const sprite = this.node.getChildByName(nodeName)?.getComponent(Sprite);
        if (sprite) sprite.color = new Color(color);
    }
}
