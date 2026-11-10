import { _decorator, Button } from 'cc';
import type { UILayer } from '../../framework/ui/UIManager';
import { UIPanel } from '../../framework/ui/UIPanel';

const { ccclass, property } = _decorator;

export interface PauseParams {
    /** 点击「继续营业」。 */
    onResume: () => void;
    /** 点击「回主菜单」。 */
    onMenu: () => void;
}

/** 暂停弹窗。布局在 resources/prefabs/ui/Pause.prefab 里。 */
@ccclass('PausePanel')
export class PausePanel extends UIPanel<PauseParams> {
    static prefab = 'prefabs/ui/Pause';
    static layer: UILayer = 'popup';

    @property(Button)
    resumeButton: Button = null!;
    @property(Button)
    menuButton: Button = null!;

    onOpen(params: PauseParams) {
        this.resumeButton.node.on(Button.EventType.CLICK, params.onResume);
        this.menuButton.node.on(Button.EventType.CLICK, params.onMenu);
    }
}
