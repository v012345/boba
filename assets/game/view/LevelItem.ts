import { _decorator, Component, Label, Sprite, SpriteFrame } from 'cc';
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

    async setData(config: LevelConfig): Promise<void> {
        const version = ++this.loadVersion;

        this.levelLabel.string = config.Id.replace('level_', '关卡 ');
        this.icon.spriteFrame = null;

        if (config.IsSpine) {
            console.warn(`关卡 ${config.Id} 使用 Spine，暂未接入`);
            return;
        }

        try {
            const frame = await app.res.load(config.FilePath, SpriteFrame);

            if (!this.isValid || version !== this.loadVersion) return;
            this.icon.spriteFrame = frame;
        } catch (error) {
            if (this.isValid && version === this.loadVersion) {
                console.error(`加载关卡图片失败：${config.FilePath}`, error);
            }
        }
    }

    /** 回收时取消旧加载结果，避免节点闲置时继续显示旧关卡。 */
    clear(): void {
        this.loadVersion++;
        this.icon.spriteFrame = null;
    }

    onDestroy(): void {
        this.loadVersion++;
    }
}
