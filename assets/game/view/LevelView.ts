import { _decorator, Color, Label, Node, UITransform } from 'cc';
import { UIPanel } from '../../framework/ui/UIPanel';
import { RoundRect } from '../../framework/ui/RoundRect';
import type { LevelConfig } from '../config/Levels';

const { ccclass } = _decorator;

export interface LevelParams {
    level: LevelConfig;
    /** 通关后传 true；直接返回或失败时不传参数。 */
    onBack: (completed?: boolean) => void;
}

/** 所有关卡共用的页面入口；后续可根据 level.Id 加载各关的内容配置。 */
@ccclass('LevelView')
export class LevelView extends UIPanel<LevelParams> {
    static prefab = 'prefabs/view/LevelView';

    onOpen(params: LevelParams): void {
        // 临时展示关卡 ID 和返回入口，方便验证页面切换和参数传递。
        const background = new Node('Background');
        background.layer = this.node.layer;
        this.node.addChild(background);
        background.addComponent(UITransform).setContentSize(1280, 720);
        background.addComponent(RoundRect).color = new Color(29, 25, 31, 255);

        const titleNode = new Node('LevelTitle');
        titleNode.layer = this.node.layer;
        this.node.addChild(titleNode);
        titleNode.addComponent(UITransform).setContentSize(600, 80);
        const title = titleNode.addComponent(Label);
        title.fontSize = 36;
        title.lineHeight = 44;
        title.string = `关卡 ${params.level.Id}`;

        const back = new Node('Back');
        back.layer = this.node.layer;
        back.setPosition(-500, 290);
        this.node.addChild(back);
        back.addComponent(UITransform).setContentSize(160, 60);
        back.addComponent(RoundRect).color = new Color(111, 49, 49, 255);
        const backLabel = new Node('Label');
        backLabel.layer = this.node.layer;
        back.addChild(backLabel);
        backLabel.addComponent(UITransform).setContentSize(160, 60);
        const label = backLabel.addComponent(Label);
        label.fontSize = 24;
        label.lineHeight = 30;
        label.string = '返回选关';
        back.on(Node.EventType.TOUCH_END, () => params.onBack());
    }
}
