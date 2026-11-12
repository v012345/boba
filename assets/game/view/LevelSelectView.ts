import { _decorator, instantiate, Node, Prefab, ScrollView, Sprite, SpriteFrame, UITransform, Vec3 } from 'cc';
import { UIPanel } from '../../framework/ui/UIPanel';
import { app } from '../GameApp';
import { Levels } from '../config/Levels';
import { LevelItem } from './LevelItem';
import { LevelView } from './LevelView';

const { ccclass, property } = _decorator;
const MAP_RESOURCE_DIR = 'images/level-select/maps/continuous/modular-curved';
const MAP_FILES = ['map_01', 'map_02', 'map_03', 'map_04'];

@ccclass('LevelSelectView')
export class LevelSelectView extends UIPanel {
    static prefab = 'prefabs/view/LevelSelectView';

    @property(Node)
    content: Node = null!;

    @property(Prefab)
    levelItemPrefab: Prefab = null!;

    /** 提前显示视口两侧的关卡，避免滑动时突然出现。 */
    @property
    preloadMargin = 250;

    private visible = new Map<string, Node>();
    private pool: Node[] = [];
    private contentTransform: UITransform = null!;
    private viewTransform: UITransform = null!;
    private corner = new Vec3();
    private coordinateOffsetX = 0;
    private mapFrames: SpriteFrame[] = [];
    private mapVisible = new Map<number, Node>();
    private mapPool: Node[] = [];
    private mapWidth = 0;
    private mapHeight = 0;
    private mapCount = 0;
    private loadVersion = 0;
    private selectedLevelId: string | null = null;
    private openingLevel = false;

    onOpen(): void {
        this.contentTransform = this.content.getComponent(UITransform)!;
        this.viewTransform = this.content.parent!.getComponent(UITransform)!;
        if (!this.contentTransform || !this.viewTransform || !this.levelItemPrefab.data.getComponent(LevelItem)) {
            throw new Error('选关页面缺少 Content、视口 UITransform 或 LevelItem 组件');
        }
        const version = ++this.loadVersion;
        void this.loadMap(version);
    }

    private async loadMap(version: number): Promise<void> {
        try {
            const frames = await Promise.all(MAP_FILES.map(name =>
                app.res.load(`${MAP_RESOURCE_DIR}/${name}/spriteFrame`, SpriteFrame),
            ));
            if (version !== this.loadVersion || !this.isValid) return;
            const { width, height } = frames[0].originalSize;
            if (width <= 0 || height <= 0 || frames.some(frame => frame.originalSize.width !== width || frame.originalSize.height !== height)) {
                throw new Error('选关地图分段尺寸必须一致且大于零');
            }
            this.mapFrames = frames;
            this.mapWidth = width;
            this.mapHeight = height;
            this.resizeContent();
            // ScrollView 通过移动 Content 实现滚动，包括惯性、回弹和代码滚动。
            this.content.on(Node.EventType.TRANSFORM_CHANGED, this.refreshVisible, this);
            this.viewTransform.node.on(Node.EventType.SIZE_CHANGED, this.refreshVisible, this);
            this.refreshVisible();
        } catch (error) {
            if (version === this.loadVersion && this.isValid) console.error('加载选关地图失败', error);
        }
    }

    /** 坐标配置以原 Content 锚点为原点；扩宽后平移原地图及关卡以保持相对位置。 */
    private resizeContent(): void {
        const content = this.contentTransform;
        const oldWidth = content.contentSize.width;
        this.coordinateOffsetX = content.anchorX * oldWidth;
        const lastX = Levels.getCfgs().reduce((max, cfg) => Math.max(max, cfg.X), 0);
        const viewWidth = this.viewTransform.contentSize.width;
        const requiredWidth = Math.max(oldWidth, this.coordinateOffsetX + lastX + viewWidth / 2);
        this.mapCount = Math.max(2, Math.ceil(requiredWidth / this.mapWidth));
        const width = this.mapCount * this.mapWidth;

        for (const child of this.content.children) {
            child.setPosition(child.position.x + this.coordinateOffsetX, child.position.y, child.position.z);
        }
        content.setAnchorPoint(0, content.anchorY);
        content.setContentSize(width, content.contentSize.height);
        const scroll = this.viewTransform.node.parent?.getComponent(ScrollView);
        scroll?.scrollToLeft(0);
    }

    private refreshVisible(): void {
        const view = this.viewTransform;
        const width = view.contentSize.width;
        const height = view.contentSize.height;
        // 将视口的四角转换到 Content 的局部坐标，兼容父节点缩放和旋转。
        let left = Infinity, right = -Infinity;
        for (const x of [-view.anchorX * width, (1 - view.anchorX) * width]) {
            for (const y of [-view.anchorY * height, (1 - view.anchorY) * height]) {
                this.corner.set(x, y, 0);
                view.convertToWorldSpaceAR(this.corner, this.corner);
                this.contentTransform.convertToNodeSpaceAR(this.corner, this.corner);
                left = Math.min(left, this.corner.x);
                right = Math.max(right, this.corner.x);
            }
        }
        left -= Math.max(0, this.preloadMargin);
        right += Math.max(0, this.preloadMargin);

        this.refreshMap(left, right);

        const wanted = Levels.getCfgs().filter(cfg => cfg.X + this.coordinateOffsetX >= left && cfg.X + this.coordinateOffsetX <= right);
        const wantedIds = new Set(wanted.map(cfg => cfg.Id));
        for (const [id, node] of this.visible) {
            if (wantedIds.has(id)) continue;
            node.getComponent(LevelItem)!.clear();
            node.active = false;
            this.visible.delete(id);
            this.pool.push(node);
        }
        for (const cfg of wanted) {
            if (this.visible.has(cfg.Id)) continue;
            const node = this.pool.pop() || instantiate(this.levelItemPrefab);
            if (!node.parent) this.content.addChild(node);
            node.setPosition(cfg.X + this.coordinateOffsetX, cfg.Y, 0);
            node.active = true;
            this.visible.set(cfg.Id, node);
            const item = node.getComponent(LevelItem)!;
            item.onSelect = this.selectLevel.bind(this);
            item.setSelected(cfg.Id === this.selectedLevelId);
            void item.setData(cfg);
        }
    }

    private selectLevel(id: string): void {
        if (this.openingLevel) return;
        const level = Levels.getCfg(id);
        if (!level) {
            console.error(`找不到关卡配置：${id}`);
            return;
        }
        this.selectedLevelId = id;
        for (const [visibleId, node] of this.visible) {
            node.getComponent(LevelItem)!.setSelected(visibleId === id);
        }
        this.openingLevel = true;
        void app.ui.open(LevelView, {
            level,
            onBack: () => { void app.ui.open<void>(LevelSelectView); },
        }).then(() => { this.openingLevel = false; }, () => { this.openingLevel = false; });
    }

    /** 首尾固定，中段交替使用 02、03；只保留视口附近的地图节点。 */
    private refreshMap(left: number, right: number): void {
        const first = Math.max(0, Math.floor(left / this.mapWidth));
        const last = Math.min(this.mapCount - 1, Math.floor(right / this.mapWidth));
        for (const [index, node] of this.mapVisible) {
            if (index >= first && index <= last) continue;
            node.active = false;
            this.mapVisible.delete(index);
            this.mapPool.push(node);
        }
        for (let index = first; index <= last; index++) {
            if (this.mapVisible.has(index)) continue;
            const type = index === 0 ? 0 : index === this.mapCount - 1 ? 3 : 1 + (index - 1) % 2;
            let node = this.mapPool.pop();
            if (!node) {
                node = new Node('MapSegment');
                node.layer = this.content.layer;
                node.addComponent(UITransform).setContentSize(this.mapWidth, this.mapHeight);
                node.addComponent(Sprite).sizeMode = Sprite.SizeMode.CUSTOM;
            }
            if (!node.parent) this.content.addChild(node);
            node.getComponent(Sprite)!.spriteFrame = this.mapFrames[type];
            node.setPosition((index + 0.5) * this.mapWidth, 0, 0);
            node.setSiblingIndex(0); // 地图始终位于关卡节点后面。
            node.active = true;
            this.mapVisible.set(index, node);
        }
    }

    onClose(): void {
        this.loadVersion++;
        this.content.off(Node.EventType.TRANSFORM_CHANGED, this.refreshVisible, this);
        this.viewTransform?.node.off(Node.EventType.SIZE_CHANGED, this.refreshVisible, this);
        for (const node of this.visible.values()) node.getComponent(LevelItem)?.clear();
        this.visible.clear();
        this.pool.length = 0;
        this.mapVisible.clear();
        this.mapPool.length = 0;
        this.mapFrames = [];
        this.selectedLevelId = null;
        this.contentTransform = null!;
        this.viewTransform = null!;
    }
}
