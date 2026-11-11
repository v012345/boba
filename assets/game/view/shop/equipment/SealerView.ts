import { _decorator, Component, Label, Node, Sprite, SpriteFrame } from 'cc';
import { DropZone } from '../../../../framework/input/DropZone';
import { FillBar } from '../../../../framework/ui/FillBar';
import type { Cup } from '../../../logic/TeaGame';

const { ccclass, property } = _decorator;

/** 封盖机的画面、交互范围与停杯位置。封盖规则由 TeaGame 负责。 */
@ccclass('SealerView')
export class SealerView extends Component {
    @property(SpriteFrame)
    idleFrame: SpriteFrame | null = null;
    @property(Label)
    label: Label = null!;
    @property(FillBar)
    progress: FillBar = null!;
    @property({ type: Node, tooltip: '杯子在机器里的停放位置' })
    cupPoint: Node = null!;
    @property({ tooltip: '杯子在机器里的显示比例' })
    cupScale = 0.62;
    @property({ type: DropZone, tooltip: '随机器一起移动的放置区' })
    dropZone: DropZone = null!;

    show(cup: Cup, inMachine: boolean, duration: number): void {
        const sealing = cup.state === 'sealing';
        this.progress.set(cup.state === 'ready' ? 1 : sealing ? 1 - cup.remaining / duration : 0);
        this.label.string = sealing ? `封盖中 ${cup.remaining.toFixed(1)}s`
            : inMachine ? '封好了，拖给客人' : `拖入封盖 · ${duration}秒`;
        // const frame = sealing ? this.workingFrame : this.idleFrame;
        // if (this.machine.spriteFrame !== frame) this.machine.spriteFrame = frame;
    }
}
