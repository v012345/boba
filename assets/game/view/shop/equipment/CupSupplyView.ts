import { _decorator, Button, Component, Label, Node } from 'cc';

const { ccclass, property } = _decorator;

/** 杯摞：取杯按钮、提示文字与出杯位置组成一个可摆放物件。 */
@ccclass('CupSupplyView')
export class CupSupplyView extends Component {
    @property(Button)
    button: Button = null!;
    @property(Label)
    label: Label = null!;
    @property({ type: Node, tooltip: '取杯时杯子的出发位置' })
    cupPoint: Node = null!;

    show(stored: boolean): void {
        this.label.string = stored ? '共用空杯\n点击取一只' : '制作位已满';
    }
}
