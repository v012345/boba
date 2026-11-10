import { _decorator, Button } from 'cc';
import { UIPanel } from '../../framework/ui/UIPanel';

const { ccclass, property } = _decorator;

export interface MainMenuParams {
    /** 点击「开始营业」。 */
    onStart: () => void;
}

/** 主菜单。布局在 resources/prefabs/ui/MainMenu.prefab 里。 */
@ccclass('MainMenuPanel')
export class MainMenuPanel extends UIPanel<MainMenuParams> {
    static prefab = 'prefabs/ui/MainMenu';

    @property(Button)
    startButton: Button = null!;

    onOpen(params: MainMenuParams) {
        this.startButton.node.on(Button.EventType.CLICK, params.onStart);
    }
}
