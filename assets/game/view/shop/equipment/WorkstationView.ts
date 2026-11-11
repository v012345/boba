import { _decorator, Component, Label, Node } from 'cc';
import { INGREDIENT_NAMES } from '../../../logic/TeaGame';
import type { Cup } from '../../../logic/TeaGame';

const { ccclass, property } = _decorator;

/** 制作位：杯子停放点与制作提示。 */
@ccclass('WorkstationView')
export class WorkstationView extends Component {
    @property(Label)
    detail: Label = null!;
    @property(Label)
    status: Label = null!;
    @property({ type: Node, tooltip: '杯子在制作台上的停放位置' })
    cupPoint: Node = null!;

    show(cup: Cup): void {
        const stored = cup.state === 'stored', placing = cup.state === 'placing';
        this.detail.string = stored ? '从桌下取一只杯子' : placing ? '正在放上桌…'
            : cup.ingredients.map(ingredient => INGREDIENT_NAMES[ingredient]).join(' + ');
        this.status.string = stored ? '等待取杯' : placing ? '' : cup.state === 'empty' ? '点击材料加料'
            : cup.state === 'making' ? '拖到封盖机' : cup.state === 'sealing' ? `封杯中 ${cup.remaining.toFixed(1)}s` : '✓ 从机器拖给客人';
    }
}
