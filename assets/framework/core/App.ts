import { StateMachine } from '../fsm/StateMachine';
import { ResManager } from '../res/ResManager';
import { UIManager } from '../ui/UIManager';
import { EventBus } from './EventBus';

/**
 * 框架入口：把所有服务挂在一个对象上，游戏代码只需要认识它。
 * 以后新增的服务（音频、存档…）都作为字段加在这里。
 *
 * 框架不知道具体游戏有哪些事件，所以由游戏带着自己的事件表来创建实例，
 * 见 game/GameApp.ts。
 *
 * 注意：App 用到了引擎，所以 game/logic 里的纯规则不要 import app；
 * 规则需要发事件时，把 app.events 作为参数传给它。
 */
export class App<Events extends object> {
    /** 全局事件总线。 */
    readonly events = new EventBus<Events>();
    /** 资源加载与释放。 */
    readonly res = new ResManager();
    /** 界面管理。使用前需要先 app.ui.init(Canvas 节点)。 */
    readonly ui = new UIManager();
    /** 游戏流程状态机，状态回调拿到的上下文就是 app 本身。 */
    readonly flow: StateMachine<App<Events>> = new StateMachine<App<Events>>(this);

    /** 每帧调用一次，由游戏入口组件驱动。 */
    update(dt: number): void {
        this.flow.update(dt);
    }
}
