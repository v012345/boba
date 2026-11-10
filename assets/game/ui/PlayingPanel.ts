import { _decorator } from 'cc';
import { createButton, createLabel, fillBackground } from '../../framework/ui/UIKit';
import { UIPanel } from '../../framework/ui/UIPanel';
import { SecondaryButton, Theme } from './Theme';

const { ccclass } = _decorator;

export interface PlayingParams {
    /** 点击「打烊」。 */
    onEnd: () => void;
}

/**
 * 营业中的页面。临时占位：玩法画面迁移到新架构之前，只有一个提前打烊的按钮，
 * 用来走通「营业 → 结算」。迁移后这里会变成 HUD（时间、营业额、暂停）。
 */
@ccclass('PlayingPanel')
export class PlayingPanel extends UIPanel<PlayingParams> {
    onOpen(params: PlayingParams) {
        fillBackground(this.node, Theme.sand);
        createLabel(this.node, '营业中', 0, 90, 600, 80, 52, Theme.ink);
        createLabel(this.node, '玩法画面还没有迁移到新架构，先用按钮结束这一局。', 0, 10, 900, 44, 26, Theme.muted);
        createButton(this.node, '打烊', 0, -100, 260, 84, SecondaryButton, params.onEnd);
    }
}
