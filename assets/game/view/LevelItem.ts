import { _decorator, Component, EventTouch, Label, Node, sp, Sprite, SpriteFrame, Vec2 } from 'cc';
import { app } from '../GameApp';
import type { LevelConfig } from '../config/Levels';

const { ccclass, property } = _decorator;

@ccclass('LevelItem')
export class LevelItem extends Component {
    @property(Sprite)
    icon: Sprite = null!;

    @property(Label)
    levelLabel: Label = null!;

    // 每次重新绑定时递增，避免异步加载完成后显示旧关卡的图片。
    private loadVersion = 0;
    private levelId: string | null = null;
    private selected = false;
    private touchId: number | null = null;
    private touchStart = new Vec2();
    private touchMoved = false;
    onSelect: ((id: string) => void) | null = null;
    @property(sp.Skeleton)
    private skeleton: sp.Skeleton

    onEnable(): void {
        this.node.on(Node.EventType.TOUCH_START, this.onTouchStart, this);
        this.node.on(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
        this.node.on(Node.EventType.TOUCH_END, this.onTouchEnd, this);
        this.node.on(Node.EventType.TOUCH_CANCEL, this.onTouchCancel, this);
    }

    onDisable(): void {
        this.node.off(Node.EventType.TOUCH_START, this.onTouchStart, this);
        this.node.off(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
        this.node.off(Node.EventType.TOUCH_END, this.onTouchEnd, this);
        this.node.off(Node.EventType.TOUCH_CANCEL, this.onTouchCancel, this);
        this.touchId = null;
    }

    async setData(config: LevelConfig): Promise<void> {
        const version = ++this.loadVersion;

        this.levelId = config.Id;
        this.updateLabel();
        this.resetVisual();

        try {
            if (config.IsSpine) {
                const data = await app.res.load(config.FilePath, sp.SkeletonData);
                if (!this.isValid || version !== this.loadVersion) return;
                const animations = data.getRuntimeData()?.animations;
                if (!animations) throw new Error(`无法解析 Spine 数据：${config.FilePath}`);
                const animation = config.Animation || animations.find(item => item.name === 'idle')?.name || animations[0]?.name;
                if (config.Animation && !animations.some(item => item.name === config.Animation)) {
                    throw new Error(`Spine 动画不存在：${config.Animation}`);
                }
                const scale = config.SpineScale ?? 1;
                if (!Number.isFinite(scale) || scale <= 0) throw new Error('SpineScale 必须大于零');
                const skeleton = this.skeleton;
                skeleton.node.setScale(scale, scale, 1);
                skeleton.skeletonData = data;
                skeleton.node.active = true;
                skeleton.setToSetupPose();
                if (animation) skeleton.setAnimation(0, animation, true);
            } else {
                const frame = await app.res.load(config.FilePath, SpriteFrame);
                if (!this.isValid || version !== this.loadVersion) return;
                this.icon.spriteFrame = frame;
            }
        } catch (error) {
            if (this.isValid && version === this.loadVersion) {
                console.error(`加载关卡图片失败：${config.FilePath}`, error);
            }
        }
    }

    /** 回收时取消旧加载结果，避免节点闲置时继续显示旧关卡。 */
    clear(): void {
        this.loadVersion++;
        this.touchId = null;
        this.levelId = null;
        this.onSelect = null;
        this.resetVisual();
    }

    setSelected(selected: boolean): void {
        this.selected = selected;
        this.updateLabel();
    }

    private updateLabel(): void {
        if (!this.levelId) return;
        const text = this.levelId.replace('level_', '关卡 ');
        this.levelLabel.string = this.selected ? `▶ ${text} ◀` : text;
    }

    private onTouchStart(event: EventTouch): void {
        if (this.touchId !== null || !this.levelId) return;
        this.touchId = event.getID();
        this.touchStart.set(event.getUILocation());
        this.touchMoved = false;
    }

    private onTouchMove(event: EventTouch): void {
        if (event.getID() !== this.touchId) return;
        if (Vec2.distance(this.touchStart, event.getUILocation()) > 10) this.touchMoved = true;
    }

    private onTouchEnd(event: EventTouch): void {
        if (event.getID() !== this.touchId) return;
        const isTap = !this.touchMoved && Vec2.distance(this.touchStart, event.getUILocation()) <= 10;
        this.touchId = null;
        if (isTap && this.levelId) this.onSelect?.(this.levelId);
    }

    private onTouchCancel(event: EventTouch): void {
        if (event.getID() === this.touchId) this.touchId = null;
    }

    private resetVisual(): void {
        this.icon.spriteFrame = null;
        this.skeleton.clearTracks();
        this.skeleton.node.active = false;
    }

    onDestroy(): void {
        this.loadVersion++;
    }
}
