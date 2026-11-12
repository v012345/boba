import { _decorator, instantiate, Node, Prefab, ScrollView, UITransform, Vec3 } from 'cc';
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

    /** 提前显示视口两侧的关卡，避免滑动时突然出现。 */
    @property
    preloadMargin = 250;

    private visible = new Map<string, Node>();
    private pool: Node[] = [];
    private contentTransform: UITransform = null!;
    private viewTransform: UITransform = null!;
    private corner = new Vec3();
    private coordinateOffsetX = 0;

    onOpen(): void {
        this.contentTransform = this.content.getComponent(UITransform)!;
        this.viewTransform = this.content.parent!.getComponent(UITransform)!;
        if (!this.contentTransform || !this.viewTransform || !this.levelItemPrefab.data.getComponent(LevelItem)) {
            throw new Error('选关页面缺少 Content、视口 UITransform 或 LevelItem 组件');
        }
        this.resizeContent();
        // ScrollView 通过移动 Content 实现滚动，包括惯性、回弹和代码滚动。
        this.content.on(Node.EventType.TRANSFORM_CHANGED, this.refreshVisible, this);
        this.viewTransform.node.on(Node.EventType.SIZE_CHANGED, this.refreshVisible, this);
        this.refreshVisible();
    }

    /** 坐标配置以原 Content 锚点为原点；扩宽后平移原地图及关卡以保持相对位置。 */
    private resizeContent(): void {
        const content = this.contentTransform;
        const oldWidth = content.contentSize.width;
        this.coordinateOffsetX = content.anchorX * oldWidth;
        const lastX = Levels.getCfgs().reduce((max, cfg) => Math.max(max, cfg.X), 0);
        const viewWidth = this.viewTransform.contentSize.width;
        const width = Math.max(oldWidth, this.coordinateOffsetX + lastX + viewWidth / 2);

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
            void node.getComponent(LevelItem)!.setData(cfg);
        }
    }

    onClose(): void {
        this.content.off(Node.EventType.TRANSFORM_CHANGED, this.refreshVisible, this);
        this.viewTransform?.node.off(Node.EventType.SIZE_CHANGED, this.refreshVisible, this);
        for (const node of this.visible.values()) node.getComponent(LevelItem)?.clear();
        this.visible.clear();
        this.pool.length = 0;
        this.contentTransform = null!;
        this.viewTransform = null!;
    }
}
