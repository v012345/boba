import { _decorator, Color, Component } from 'cc';

const { ccclass, property } = _decorator;

/** 桌上的一份配料。点击它（同节点上的 Button）就往杯子里加这种料。 */
@ccclass('IngredientTray')
export class IngredientTray extends Component {
    // @property({ tooltip: '配料代号，必须是 tea、milk、pearl、jelly 之一' })
    // ingredient = 'tea';
    // @property({ tooltip: '加料时飞向杯子的小颗粒的颜色' })
    // dropColor = new Color(169, 100, 47, 255);
    // @property({ tooltip: '小颗粒的大小' })
    // dropSize = 10;
    // @property({ tooltip: '小颗粒是圆的还是方的' })
    // dropRound = true;
}
