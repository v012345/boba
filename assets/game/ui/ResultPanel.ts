import { _decorator } from 'cc';
import { createButton, createLabel, createNode, fillBackground } from '../../framework/ui/UIKit';
import type { UILayer } from '../../framework/ui/UIManager';
import { UIPanel } from '../../framework/ui/UIPanel';
import { PrimaryButton, SecondaryButton, Theme } from './Theme';

const { ccclass } = _decorator;

export interface ResultParams {
    money: number;
    target: number;
    /** 点击「再开一局」。 */
    onRestart: () => void;
    /** 点击「回主菜单」。 */
    onMenu: () => void;
}

/** 结算弹窗：显示这一局的营业额，叠在营业页面之上。 */
@ccclass('ResultPanel')
export class ResultPanel extends UIPanel<ResultParams> {
    static layer: UILayer = 'popup';

    onOpen(params: ResultParams) {
        const reached = params.money >= params.target;
        const card = createNode(this.node, 'Card', 0, 0, 640, 400);
        fillBackground(card, Theme.cream, 24);
        createLabel(card, reached ? '今日目标达成！' : '打烊啦，再接再厉', 0, 120, 580, 60, 38, Theme.green);
        createLabel(card, `营业额 ¥${params.money} / ¥${params.target}`, 0, 30, 560, 50, 30, Theme.ink);
        createButton(card, '再开一局', -150, -110, 260, 80, PrimaryButton, params.onRestart);
        createButton(card, '回主菜单', 150, -110, 260, 80, SecondaryButton, params.onMenu);
    }
}
