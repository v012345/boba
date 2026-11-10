import { _decorator, Component } from 'cc';
import { Flow, registerFlow } from './flow/GameFlow';
import { app } from './GameApp';

const { ccclass } = _decorator;

// 流程状态只注册一次（脚本加载时），重复进入场景不会重复注册。
registerFlow(app.flow);

/** 游戏入口：挂在启动场景的 Canvas 上。负责初始化界面根节点、进入第一个流程，并每帧驱动 app。 */
@ccclass('Main')
export class Main extends Component {
    start() {
        app.ui.init(this.node);
        app.flow.change(Flow.Menu);
    }

    update(dt: number) {
        app.update(dt);
    }
}
