import { _decorator, Component } from 'cc';
import type { UILayer, UIManager } from './UIManager';

const { ccclass } = _decorator;

/**
 * 所有界面的基类。一个界面 = 一个继承它的组件，由 UIManager 负责创建和销毁。
 * Params 是打开界面时要传入的数据；不需要数据就不写。
 *
 * 界面只管显示和把操作通过回调交出去，不直接切换流程，这样它不依赖具体玩法。
 */
@ccclass('UIPanel')
export abstract class UIPanel<Params = void> extends Component {
    /** 所在层级：'page' 是整页界面，'popup' 是叠在页面上的弹窗。子类按需覆盖。 */
    static layer: UILayer = 'page';

    /** 创建本界面的管理器，由 UIManager 填入。 */
    ui: UIManager | null = null;

    /** 界面打开时调用一次，在这里搭建界面。此时 this.node 已铺满屏幕。 */
    abstract onOpen(params: Params): void;

    /** 界面关闭前调用，在这里释放自己创建的东西。 */
    onClose(): void {}

    /** 关闭自己。 */
    close(): void {
        this.ui?.close(this);
    }
}
