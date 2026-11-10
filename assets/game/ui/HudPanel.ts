import { _decorator, Button, Color, Label } from 'cc';
import { UIPanel } from '../../framework/ui/UIPanel';
import type { TeaGame } from '../logic/TeaGame';

const { ccclass, property } = _decorator;

export interface HudParams {
    /** 当前这一局的规则对象，HUD 只读取它来显示。 */
    session: TeaGame;
    /** 点击「暂停」。 */
    onPause: () => void;
}

/** 营业中的 HUD：剩余时间、营业额、连击、提示语和暂停按钮。布局在 resources/prefabs/ui/Hud.prefab 里。 */
@ccclass('HudPanel')
export class HudPanel extends UIPanel<HudParams> {
    static prefab = 'prefabs/ui/Hud';

    @property(Label)
    statusLabel: Label = null!;
    @property(Label)
    messageLabel: Label = null!;
    @property(Button)
    pauseButton: Button = null!;
    @property({ tooltip: '剩余时间不多时，状态文字换成这个颜色' })
    urgentColor = new Color(189, 102, 82, 255);
    @property({ tooltip: '剩余多少秒开始提醒' })
    urgentSeconds = 15;

    private session: TeaGame | null = null;
    private normalColor = new Color();

    onOpen(params: HudParams) {
        this.session = params.session;
        this.normalColor.set(this.statusLabel.color);
        this.pauseButton.node.on(Button.EventType.CLICK, params.onPause);
        this.refresh();
    }

    update() {
        this.refresh();
    }

    private refresh() {
        const session = this.session;
        if (!session) return;
        this.statusLabel.string = `${Math.ceil(session.time)} 秒    ¥${session.money} / ${session.target}    连击 ×${session.combo}`;
        this.statusLabel.color = session.time <= this.urgentSeconds ? this.urgentColor : this.normalColor;
        this.messageLabel.string = session.message;
    }
}
