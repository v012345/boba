import { _decorator, Button, Node } from 'cc';
import type { UILayer } from '../../framework/ui/UIManager';
import { UIPanel } from '../../framework/ui/UIPanel';

const { ccclass, property } = _decorator;

export interface RotateHintParams {
    /** 这个浏览器能不能用代码锁定横屏。不能的话只显示文字引导，不显示按钮。 */
    canLock: boolean;
    /** 点击「全屏并锁定横屏」。 */
    onLock: () => void;
}

/** 竖屏时盖住整个画面的「请把手机横过来」。布局在 resources/prefabs/ui/RotateHint.prefab 里。 */
@ccclass('RotateHintPanel')
export class RotateHintPanel extends UIPanel<RotateHintParams> {
    static prefab = 'prefabs/ui/RotateHint';
    static layer: UILayer = 'top';

    @property(Button)
    lockButton: Button = null!;
    @property({ type: Node, tooltip: '浏览器不支持锁定方向时显示的文字' })
    manualTip: Node = null!;

    onOpen(params: RotateHintParams) {
        this.lockButton.node.active = params.canLock;
        this.manualTip.active = !params.canLock;
        this.lockButton.node.on(Button.EventType.CLICK, params.onLock);
    }
}
