import { _decorator, Component, Label, Node, Skeleton, sp, Sprite, SpriteFrame, UITransform } from 'cc';
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
    @property(sp.Skeleton)
    private skeleton: sp.Skeleton

    async setData(config: LevelConfig): Promise<void> {
        const version = ++this.loadVersion;

        this.levelLabel.string = config.Id.replace('level_', '关卡 ');
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
        this.resetVisual();
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
