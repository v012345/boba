import { _decorator, Button, Label } from 'cc';
import type { UILayer } from '../../framework/ui/UIManager';
import { UIPanel } from '../../framework/ui/UIPanel';
import type { SessionSummary } from '../GameEvents';

const { ccclass, property } = _decorator;

export interface ResultParams {
    summary: SessionSummary;
    /** 点击「再开一局」。 */
    onRestart: () => void;
    /** 点击「回主菜单」。 */
    onMenu: () => void;
}

/** 结算弹窗：显示这一局的成绩，叠在营业页面之上。布局在 resources/prefabs/ui/Result.prefab 里。 */
@ccclass('ResultPanel')
export class ResultPanel extends UIPanel<ResultParams> {
    static prefab = 'prefabs/ui/Result';
    static layer: UILayer = 'popup';

    @property(Label)
    titleLabel: Label = null!;
    @property(Label)
    detailLabel: Label = null!;
    @property(Button)
    restartButton: Button = null!;
    @property(Button)
    menuButton: Button = null!;

    onOpen(params: ResultParams) {
        const { money, target, served, lost, bestCombo } = params.summary;
        this.titleLabel.string = money >= target ? '今日目标达成！' : '打烊啦，再接再厉';
        this.detailLabel.string = `营业额 ¥${money} / ¥${target}\n完成 ${served} 单 · 流失 ${lost} 位\n最高连击 ${bestCombo}`;
        this.restartButton.node.on(Button.EventType.CLICK, params.onRestart);
        this.menuButton.node.on(Button.EventType.CLICK, params.onMenu);
    }
}
