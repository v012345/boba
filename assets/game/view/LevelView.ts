import { _decorator, Color, instantiate, Label, Node, Prefab, UITransform } from 'cc';
import { UIPanel } from '../../framework/ui/UIPanel';
import { RoundRect } from '../../framework/ui/RoundRect';
import { app } from '../GameApp';
import { LevelContent } from '../config/LevelContent';
import { Containers } from '../config/Containers';
import { Materials } from '../config/Materials';
import { Workbenches } from '../config/Workbenches';
import { Bins } from '../config/Bins';

const { ccclass } = _decorator;

export interface LevelParams {
    levelId: string;
    /** 通关后传 true；直接返回或失败时不传参数。 */
    onBack: (completed?: boolean) => void;
}

/** 根据关卡 ID 加载材料配置并创建关卡。 */
@ccclass('LevelView')
export class LevelView extends UIPanel<LevelParams> {
    static prefab = 'prefabs/view/LevelView';

    private loadVersion = 0;

    onOpen(params: LevelParams): void {
        // 临时展示关卡 ID 和返回入口，方便验证页面切换和参数传递。
        const background = new Node('Background');
        background.layer = this.node.layer;
        this.node.addChild(background);
        background.addComponent(UITransform).setContentSize(1280, 720);
        background.addComponent(RoundRect).color = new Color(29, 25, 31, 255);

        const titleNode = new Node('LevelTitle');
        titleNode.layer = this.node.layer;
        titleNode.setPosition(0, 290);
        this.node.addChild(titleNode);
        titleNode.addComponent(UITransform).setContentSize(600, 80);
        const title = titleNode.addComponent(Label);
        title.fontSize = 36;
        title.lineHeight = 44;
        title.string = `关卡 ${params.levelId}`;

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
        void this.createLevelContent(params.levelId, ++this.loadVersion);
    }

    private async createLevelContent(levelId: string, version: number): Promise<void> {
        const config = LevelContent.getCfg(levelId);
        if (!config) {
            console.warn(`没有找到关卡内容配置：${levelId}`);
            return;
        }
        try {
            const workbenchConfig = Workbenches.getCfg(config.Workbench.Id);
            if (!workbenchConfig) throw new Error(`找不到工作台配置：${config.Workbench.Id}`);
            const binConfig = Bins.getCfg(config.Bin.Id);
            if (!binConfig) throw new Error(`找不到垃圾桶配置：${config.Bin.Id}`);
            const workbenchPrefab = app.res.load(workbenchConfig.Prefab, Prefab);
            const binPrefab = app.res.load(binConfig.Prefab, Prefab);
            const materialPrefabs = config.Materials.map(material => {
                const materialConfig = Materials.getCfg(material.Id);
                if (!materialConfig) throw new Error(`找不到材料配置：${material.Id}`);
                return app.res.load(materialConfig.Prefab, Prefab);
            });
            const containerPrefabs = config.Containers.map(container => {
                const containerConfig = Containers.getCfg(container.Id);
                if (!containerConfig) throw new Error(`找不到容器配置：${container.Id}`);
                return app.res.load(containerConfig.Prefab, Prefab);
            });
            const [workbench, bin, ...prefabs] = await Promise.all([workbenchPrefab, binPrefab, ...materialPrefabs, ...containerPrefabs]);
            if (!this.isValid || version !== this.loadVersion) return;
            const workbenchNode = instantiate(workbench);
            workbenchNode.name = config.Workbench.Id;
            workbenchNode.setPosition(config.Workbench.X, config.Workbench.Y, 0);
            this.node.addChild(workbenchNode);
            workbenchNode.setSiblingIndex(1); // 工作台位于背景之上、其他内容之下。
            const binNode = instantiate(bin);
            binNode.name = config.Bin.Id;
            binNode.setPosition(config.Bin.X, config.Bin.Y, 0);
            this.node.addChild(binNode);
            config.Materials.forEach((material, index) => {
                const node = instantiate(prefabs[index]);
                node.name = material.Id;
                node.setPosition(material.X, material.Y, 0);
                this.node.addChild(node);
            });
            config.Containers.forEach((container, index) => {
                const node = instantiate(prefabs[config.Materials.length + index]);
                node.name = container.Id;
                node.setPosition(container.X, container.Y, 0);
                this.node.addChild(node);
            });
        } catch (error) {
            if (this.isValid && version === this.loadVersion) console.error(`加载关卡内容失败：${levelId}`, error);
        }
    }

    onClose(): void {
        this.loadVersion++;
    }
}
