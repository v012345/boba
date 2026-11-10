import type { State, StateMachine } from '../../framework/fsm/StateMachine';
import type { GameApp } from '../GameApp';

/** 游戏流程的状态名。切换时用 app.flow.change(Flow.Playing)，避免手写字符串。 */
export const Flow = { Menu: 'menu', Playing: 'playing', Result: 'result' } as const;

/** 主菜单。界面模块做好后，在 enter 里打开主菜单、exit 里关闭。 */
const menu: State<GameApp> = {};

/** 营业中。之后在 enter 里创建一局的规则对象，在 update 里推进它。 */
const playing: State<GameApp> = {
    enter(app) {
        app.events.on('session:ended', () => app.flow.change(Flow.Result), playing);
    },
    exit(app) {
        app.events.offTarget(playing);
    },
};

/** 结算。之后在 enter 里打开结算界面。 */
const result: State<GameApp> = {};

export function registerFlow(flow: StateMachine<GameApp>): void {
    flow.add(Flow.Menu, menu).add(Flow.Playing, playing).add(Flow.Result, result);
}
