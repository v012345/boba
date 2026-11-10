import { _decorator, Component } from 'cc';
import { Flow } from './flow/GameFlow';
import { app } from './GameApp';

const { ccclass } = _decorator;

/** 游戏入口：挂在启动场景的任意一个节点上。只负责进入第一个流程，并每帧驱动 app。 */
@ccclass('Main')
export class Main extends Component {
    start() {
        app.flow.change(Flow.Menu);
    }

    update(dt: number) {
        app.update(dt);
    }
}
