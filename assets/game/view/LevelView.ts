import { _decorator, Color, instantiate, Label, Mask, Node, Prefab, Sprite, SpriteFrame, tween, Tween, UITransform, Vec2, Vec3 } from 'cc';
import { UIPanel } from '../../framework/ui/UIPanel';
import { RoundRect } from '../../framework/ui/RoundRect';
import { app } from '../GameApp';
import { LevelContent } from '../config/LevelContent';
import { LevelBackgrounds } from '../config/LevelBackgrounds';
import { LevelCustomers } from '../config/LevelCustomers';
import { LevelOrders } from '../config/LevelOrders';
import { Customer } from './level/customers/Customer';
import { Containers } from '../config/Containers';
import { Materials } from '../config/Materials';
import { Workbenches } from '../config/Workbenches';
import { Bins } from '../config/Bins';
import { HoldingAreas } from '../config/HoldingAreas';
import { HoldingArea } from './level/holding-area/HoldingArea';
import { Container } from './level/containers/Container';
import { Draggable } from '../../framework/input/Draggable';
import { DropZone } from '../../framework/input/DropZone';
import { BinView } from './level/equipment/BinView';

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

    /** 顾客在背景和柜台前景之间显示。 */
    customerLayer: Node = null!;

    private loadVersion = 0;
    private activeContainer: Node | null = null;
    private flyingIngredients = new Set<Node>();
    private draggingContainer: Node | null = null;
    private bin: BinView | null = null;
    private binHovered = false;

    onOpen(params: LevelParams): void {
        // 临时展示关卡 ID 和返回入口，方便验证页面切换和参数传递。
        const background = new Node('Background');
        background.layer = this.node.layer;
        this.node.addChild(background);
        background.addComponent(UITransform).setContentSize(1280, 720);
        background.addComponent(RoundRect).color = new Color(29, 25, 31, 255);

        this.customerLayer = new Node('CustomerLayer');
        this.customerLayer.layer = this.node.layer;
        this.node.addChild(this.customerLayer);
        this.customerLayer.addComponent(UITransform).setContentSize(1280, 720);

        const foreground = new Node('CounterForeground');
        foreground.layer = this.node.layer;
        this.node.addChild(foreground);

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
        void this.createLevelContent(params.levelId, ++this.loadVersion, background, foreground);
    }

    private async createLevelContent(levelId: string, version: number, background: Node, foreground: Node): Promise<void> {
        const config = LevelContent.getCfg(levelId);
        if (!config) {
            console.warn(`没有找到关卡内容配置：${levelId}`);
            return;
        }
        try {
            const backgroundConfig = LevelBackgrounds.getCfg(config.Background);
            if (!backgroundConfig) throw new Error(`找不到背景配置：${config.Background}`);
            const backgroundFrame = await app.res.load(backgroundConfig.SpriteFrame, SpriteFrame);
            if (!this.isValid || version !== this.loadVersion) return;
            const backgroundImage = new Node('BackgroundImage');
            backgroundImage.layer = background.layer;
            background.addChild(backgroundImage);
            backgroundImage.addComponent(UITransform).setContentSize(1280, 720);
            const sprite = backgroundImage.addComponent(Sprite);
            sprite.sizeMode = Sprite.SizeMode.CUSTOM;
            sprite.spriteFrame = backgroundFrame;

            // 同一张背景图按柜台顶部裁出前景，避免分图造成接缝；顾客层位于两者之间。
            const foregroundHeight = backgroundConfig.ForegroundTopY + 360;
            if (foregroundHeight <= 0 || foregroundHeight > 720) throw new Error('背景前景顶部坐标超出画面范围');
            foreground.setPosition(0, (backgroundConfig.ForegroundTopY - 360) / 2);
            foreground.addComponent(UITransform).setContentSize(1280, foregroundHeight);
            foreground.addComponent(Mask).type = Mask.Type.GRAPHICS_RECT;
            const foregroundImage = new Node('ForegroundImage');
            foregroundImage.layer = foreground.layer;
            foreground.addChild(foregroundImage);
            foregroundImage.setPosition(0, -foreground.position.y);
            foregroundImage.addComponent(UITransform).setContentSize(1280, 720);
            const foregroundSprite = foregroundImage.addComponent(Sprite);
            foregroundSprite.sizeMode = Sprite.SizeMode.CUSTOM;
            foregroundSprite.spriteFrame = backgroundFrame;

            const workbenchConfig = Workbenches.getCfg(config.Workbench.Id);
            if (!workbenchConfig) throw new Error(`找不到工作台配置：${config.Workbench.Id}`);
            const binConfig = Bins.getCfg(config.Bin.Id);
            if (!binConfig) throw new Error(`找不到垃圾桶配置：${config.Bin.Id}`);
            const prefabs = new Map<string, Prefab>();
            const customerFrames = new Map<string, SpriteFrame>();
            const customerFramePaths = new Set<string>();
            const paths = new Set<string>();
            config.Customers.forEach(customer => {
                const customerConfig = LevelCustomers.getCfg(customer.Id);
                if (!customerConfig) throw new Error(`找不到顾客配置：${customer.Id}`);
                paths.add(customerConfig.Prefab);
                customerFramePaths.add(customerConfig.SpriteFrame);
            });
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
            await Promise.all([
                ...Array.from(paths, async path => { prefabs.set(path, await app.res.load(path, Prefab)); }),
                ...Array.from(customerFramePaths, async path => { customerFrames.set(path, await app.res.load(path, SpriteFrame)); }),
            ]);
            const getPrefab = (path: string): Prefab => {
                const prefab = prefabs.get(path);
                if (!prefab) throw new Error(`找不到已加载的 Prefab：${path}`);
                return prefab;
            };
            if (!this.isValid || version !== this.loadVersion) return;
            config.Customers.forEach(customer => {
                const customerConfig = LevelCustomers.getCfg(customer.Id)!;
                const frame = customerFrames.get(customerConfig.SpriteFrame);
                if (!frame) throw new Error(`找不到顾客图片：${customer.Id}`);
                const node = instantiate(getPrefab(customerConfig.Prefab));
                const portrait = node.getComponentInChildren(Sprite);
                if (!portrait) throw new Error(`顾客 Prefab 缺少 Sprite：${customer.Id}`);
                portrait.spriteFrame = frame;
                const customerComponent = node.getComponent(Customer);
                const order = LevelOrders.getCfg(customer.OrderId);
                if (!customerComponent || !order) throw new Error(`顾客或订单配置有误：${customer.Id} / ${customer.OrderId}`);
                customerComponent.setOrder(order);
                node.name = customer.Id;
                node.setPosition(customer.X, customer.Y, 0);
                this.customerLayer.addChild(node);
            });
            const workbenchNode = instantiate(getPrefab(workbenchConfig.Prefab));
            workbenchNode.name = config.Workbench.Id;
            workbenchNode.setPosition(config.Workbench.X, config.Workbench.Y, 0);
            this.node.addChild(workbenchNode);
            workbenchNode.setSiblingIndex(3); // 工作台在柜台前景之上。
            let holdingArea: HoldingArea | null = null;
            if (config.HoldingArea && holdingAreaConfig) {
                const area = instantiate(getPrefab(holdingAreaConfig.Prefab));
                const component = area.getComponent(HoldingArea);
                if (!component) throw new Error('暂存区 Prefab 缺少 HoldingArea 组件');
                component.capacity = config.HoldingArea.Capacity;
                holdingArea = component;
                area.name = config.HoldingArea.Id;
                area.setPosition(config.HoldingArea.X, config.HoldingArea.Y, 0);
                this.node.addChild(area);
                area.setSiblingIndex(4);
            }
            const binNode = instantiate(getPrefab(binConfig.Prefab));
            binNode.name = config.Bin.Id;
            binNode.setPosition(config.Bin.X, config.Bin.Y, 0);
            this.node.addChild(binNode);
            this.bin = binNode.getComponent(BinView);
            if (!this.bin || !this.bin.dropZone || !this.bin.skeleton) throw new Error('垃圾桶 Prefab 缺少 BinView、放置区或动画');
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
                            if (!container.isValid) {
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
                    this.setupContainerDrag(item, workbenchNode, holdingArea);
                    tween(item)
                        .to(0.35, { position: new Vec3(config.Workbench.X, config.Workbench.Y, 0) }, { easing: 'quadOut' })
                        .start();
                });
            });
        } catch (error) {
            if (this.isValid && version === this.loadVersion) console.error(`加载关卡内容失败：${levelId}`, error);
        }
    }

    update(dt: number): void {
        if (this.bin?.isValid) this.bin.tick(dt, this.binHovered);
    }

    private isOverBin(item: Node): boolean {
        const bin = this.bin;
        return !!bin?.isValid && DropZone.pick([bin.dropZone], item.worldPosition.x, item.worldPosition.y) === bin.dropZone;
    }

    private setupContainerDrag(item: Node, workbench: Node, holdingArea: HoldingArea | null): void {
        const draggable = item.getComponent(Draggable) || item.addComponent(Draggable);
        let restPosition = new Vec3();
        draggable.canBegin = () => !this.draggingContainer;
        item.on(Draggable.EventType.BEGIN, () => {
            this.draggingContainer = item;
            Tween.stopAllByTarget(item);
            // 工作台上的容器返回工作台中心；暂存区容器返回其原槽位。
            restPosition = this.activeContainer === item ? workbench.worldPosition.clone() : item.worldPosition.clone();
            item.setSiblingIndex(this.node.children.length - 1);
            this.binHovered = this.isOverBin(item);
            this.bin?.setOpen(this.binHovered);
        });
        item.on(Draggable.EventType.MOVE, () => {
            this.binHovered = this.isOverBin(item);
            this.bin?.setOpen(this.binHovered);
        });
        const finish = (cancelled: boolean): void => {
            const wasOnWorkbench = this.activeContainer === item;
            const point = new Vec2(item.worldPosition.x, item.worldPosition.y);
            const discard = !cancelled && this.isOverBin(item);
            this.binHovered = false;
            if (discard) {
                if (wasOnWorkbench) this.activeContainer = null;
                else holdingArea?.remove(item);
                this.draggingContainer = null;
                item.active = false;
                item.destroy();
                this.bin?.swallow();
                return;
            }
            this.bin?.setOpen(false);
            if (!cancelled) {
                const customer = this.customerLayer.getComponentsInChildren(Customer).find(candidate =>
                    candidate.waiting && candidate.node.isValid && candidate.node.activeInHierarchy
                    && candidate.node.getComponent(UITransform)!.getBoundingBoxToWorld().contains(point),
                );
                if (customer) {
                    const container = item.getComponent(Container);
                    if (container && customer.matches(container.ingredients)) {
                        if (wasOnWorkbench) this.activeContainer = null;
                        else holdingArea?.remove(item);
                        this.draggingContainer = null;
                        item.active = false;
                        item.destroy();
                        customer.leave();
                        return;
                    }
                    customer.showMismatch();
                    item.setWorldPosition(restPosition);
                    this.draggingContainer = null;
                    return;
                }
            }
            if (!cancelled && wasOnWorkbench && holdingArea?.isValid
                && holdingArea.node.getComponent(UITransform)!.getBoundingBoxToWorld().contains(point)) {
                const slot = holdingArea.store(item);
                if (slot) {
                    this.activeContainer = null;
                    item.setWorldPosition(slot);
                    this.draggingContainer = null;
                    return;
                }
            }
            // 工作台的可见区域在其子节点；用该区域检测容器是否放回工作台。
            const workbenchVisual = workbench.children[0]?.getComponent(UITransform) || workbench.getComponent(UITransform)!;
            if (!cancelled && !wasOnWorkbench && !this.activeContainer?.isValid
                && workbenchVisual.getBoundingBoxToWorld().contains(point)) {
                holdingArea?.remove(item);
                this.activeContainer = item;
                item.setWorldPosition(workbench.worldPosition);
            } else {
                item.setWorldPosition(restPosition);
            }
            this.draggingContainer = null;
        };
        item.on(Draggable.EventType.END, () => finish(false));
        item.on(Draggable.EventType.CANCEL, () => finish(true));
    }

    onClose(): void {
        this.loadVersion++;
        if (this.activeContainer?.isValid) Tween.stopAllByTarget(this.activeContainer);
        this.activeContainer = null;
        this.draggingContainer = null;
        this.binHovered = false;
        this.bin = null;
        for (const item of this.flyingIngredients) {
            if (item.isValid) Tween.stopAllByTarget(item);
        }
        this.flyingIngredients.clear();
    }
}
