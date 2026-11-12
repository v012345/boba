import { _decorator, instantiate, Node, Prefab } from 'cc';
import { UIPanel } from '../../framework/ui/UIPanel';
import { Levels } from '../config/Levels';
import { LevelItem } from './LevelItem';

const { ccclass, property } = _decorator;

@ccclass('LevelSelectView')
export class LevelSelectView extends UIPanel {
    static prefab = 'prefabs/view/LevelSelect';

    @property(Node)
    content: Node = null!;

    @property(Prefab)
    levelItemPrefab: Prefab = null!;

    onOpen(): void {
        const configs = Levels.getCfgs();

        for (let i = 0; i < 3; i++) {
            const node = instantiate(this.levelItemPrefab);
            this.content.addChild(node);

            node.setPosition(configs[i].X, configs[i].Y, 0);

            const item = node.getComponent(LevelItem);
            if (!item) {
                console.error('LevelItem.prefab 根节点缺少 LevelItem 组件');
                node.destroy();
                continue;
            }

            void item.setData(configs[i]);
        }
    }
}
