import { _decorator, Component } from 'cc';
import type { UILayer, UIManager } from './UIManager';

const { ccclass } = _decorator;

/**
 * 所有界面的基类。一个界面 = 一个预制体 + 挂在预制体根节点上的界面组件。
 * 布局、文字、颜色都在编辑器里摆；组件只负责填入数据、把操作通过回调交出去。
 * Params 是打开界面时要传入的数据；不需要数据就不写。
 *
 * 界面不直接切换流程，这样它不依赖具体玩法。
 */
@ccclass('UIPanel')
export abstract class UIPanel<Params = void> extends Component {
    /** 预制体路径，相对 resources 目录、不带扩展名。子类必须填写。 */
    static prefab = '';

    /** 所在层级，默认是整页界面。各层的含义见 UIManager 里的 UILayer。子类按需覆盖。 */
    static layer: UILayer = 'page';

    /** 创建本界面的管理器，由 UIManager 填入。 */
    ui: UIManager | null = null;

    /** 界面显示出来时调用一次，在这里填数据、绑定按钮。 */
    abstract onOpen(params: Params): void;

    /** 界面关闭前调用，在这里释放自己创建的东西。 */
    onClose(): void {}

    /** 关闭自己。 */
    close(): void {
        this.ui?.close(this);
    }
}
