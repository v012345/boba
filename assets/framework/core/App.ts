import { StateMachine } from '../fsm/StateMachine';
import { EventBus } from './EventBus';

/**
 * 框架入口：把所有服务挂在一个对象上，游戏代码只需要认识它。
 * 以后新增的服务（界面、资源、音频、存档…）都作为字段加在这里。
 *
 * 框架不知道具体游戏有哪些事件，所以由游戏带着自己的事件表来创建实例，
 * 见 game/GameApp.ts。
 */
export class App<Events extends object> {
    /** 全局事件总线。 */
    readonly events = new EventBus<Events>();
    /** 游戏流程状态机，状态回调拿到的上下文就是 app 本身。 */
    readonly flow: StateMachine<App<Events>> = new StateMachine<App<Events>>(this);

    /** 每帧调用一次，由游戏入口组件驱动。 */
    update(dt: number): void {
        this.flow.update(dt);
    }
}
