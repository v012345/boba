import { _decorator, Color, instantiate, Label, Node, Prefab, tween, Tween, UITransform, Vec3 } from 'cc';
import { UIPanel } from '../../framework/ui/UIPanel';
import { RoundRect } from '../../framework/ui/RoundRect';
import { app } from '../GameApp';
import { LevelContent } from '../config/LevelContent';
import { Containers } from '../config/Containers';
import { Materials } from '../config/Materials';
import { Workbenches } from '../config/Workbenches';
import { Bins } from '../config/Bins';
import { HoldingAreas } from '../config/HoldingAreas';
import { HoldingArea } from './level/holding-area/HoldingArea';
import { Container } from './level/containers/Container';

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
    private activeContainer: Node | null = null;
    private flyingIngredients = new Set<Node>();

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
            const prefabs = new Map<string, Prefab>();
            const paths = new Set<string>();
            paths.add(workbenchConfig.Prefab);
            paths.add(binConfig.Prefab);
            const holdingAreaConfig = config.HoldingArea ? HoldingAreas.getCfg(config.HoldingArea.Id) : undefined;
            if (config.HoldingArea && !holdingAreaConfig) throw new Error(`找不到暂存区配置：${config.HoldingArea.Id}`);
            if (holdingAreaConfig) paths.add(holdingAreaConfig.Prefab);
            config.Materials.forEach(material => {
                const materialConfig = Materials.getCfg(material.Id);
                if (!materialConfig) throw new Error(`找不到材料配置：${material.Id}`);
                paths.add(materialConfig.Prefab);
                paths.add(materialConfig.ItemPrefab);
            });
            config.Containers.forEach(container => {
                const containerConfig = Containers.getCfg(container.Id);
                if (!containerConfig) throw new Error(`找不到容器配置：${container.Id}`);
                paths.add(containerConfig.Prefab);
                paths.add(containerConfig.ItemPrefab);
            });
            await Promise.all(Array.from(paths, async path => {
                prefabs.set(path, await app.res.load(path, Prefab));
            }));
            const getPrefab = (path: string): Prefab => {
                const prefab = prefabs.get(path);
                if (!prefab) throw new Error(`找不到已加载的 Prefab：${path}`);
                return prefab;
            };
            if (!this.isValid || version !== this.loadVersion) return;
            const workbenchNode = instantiate(getPrefab(workbenchConfig.Prefab));
            workbenchNode.name = config.Workbench.Id;
            workbenchNode.setPosition(config.Workbench.X, config.Workbench.Y, 0);
            this.node.addChild(workbenchNode);
            workbenchNode.setSiblingIndex(1); // 工作台位于背景之上、其他内容之下。
            if (config.HoldingArea && holdingAreaConfig) {
                const area = instantiate(getPrefab(holdingAreaConfig.Prefab));
                const component = area.getComponent(HoldingArea);
                if (!component) throw new Error('暂存区 Prefab 缺少 HoldingArea 组件');
                component.capacity = config.HoldingArea.Capacity;
                area.name = config.HoldingArea.Id;
                area.setPosition(config.HoldingArea.X, config.HoldingArea.Y, 0);
                this.node.addChild(area);
                area.setSiblingIndex(2);
            }
            const binNode = instantiate(getPrefab(binConfig.Prefab));
            binNode.name = config.Bin.Id;
            binNode.setPosition(config.Bin.X, config.Bin.Y, 0);
            this.node.addChild(binNode);
            config.Materials.forEach(material => {
                const materialConfig = Materials.getCfg(material.Id)!;
                const node = instantiate(getPrefab(materialConfig.Prefab));
                node.name = material.Id;
                node.setPosition(material.X, material.Y, 0);
                this.node.addChild(node);
                const itemPrefab = getPrefab(materialConfig.ItemPrefab);
                node.on(Node.EventType.TOUCH_END, () => {
                    const container = this.activeContainer;
                    if (!container?.isValid) return;
                    const containerComponent = container.getComponent(Container);
                    if (!containerComponent) {
                        console.error('容器 Prefab 缺少 Container 组件');
                        return;
                    }
                    const ingredientIndex = containerComponent.addIngredient(material.Id);
                    const item = instantiate(itemPrefab);
                    this.node.addChild(item);
                    item.setPosition(node.position);
                    this.flyingIngredients.add(item);
                    tween(item)
                        .to(0.35, { position: new Vec3(config.Workbench.X, config.Workbench.Y, 0) }, { easing: 'quadIn' })
                        .call(() => {
                            this.flyingIngredients.delete(item);
                            if (!item.isValid) return;
                            if (!container.isValid || this.activeContainer !== container) {
                                item.destroy();
                                return;
                            }
                            containerComponent.showIngredient(item, ingredientIndex);
                        })
                        .start();
                });
            });
            config.Containers.forEach(container => {
                const containerConfig = Containers.getCfg(container.Id)!;
                const node = instantiate(getPrefab(containerConfig.Prefab));
                node.name = container.Id;
                node.setPosition(container.X, container.Y, 0);
                this.node.addChild(node);
                const itemPrefab = getPrefab(containerConfig.ItemPrefab);
                node.on(Node.EventType.TOUCH_END, () => {
                    if (this.activeContainer?.isValid) return;
                    const item = instantiate(itemPrefab);
                    this.activeContainer = item;
                    this.node.addChild(item);
                    item.setPosition(node.position);
                    tween(item)
                        .to(0.35, { position: new Vec3(config.Workbench.X, config.Workbench.Y, 0) }, { easing: 'quadOut' })
                        .start();
                });
            });
        } catch (error) {
            if (this.isValid && version === this.loadVersion) console.error(`加载关卡内容失败：${levelId}`, error);
        }
    }

    onClose(): void {
        this.loadVersion++;
        if (this.activeContainer?.isValid) Tween.stopAllByTarget(this.activeContainer);
        this.activeContainer = null;
        for (const item of this.flyingIngredients) {
            if (item.isValid) Tween.stopAllByTarget(item);
        }
        this.flyingIngredients.clear();
    }
}
