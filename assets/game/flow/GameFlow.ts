import type { State, StateMachine } from '../../framework/fsm/StateMachine';
import type { GameApp } from '../GameApp';
import type { GameEvents } from '../GameEvents';
import { MainMenuPanel } from '../ui/MainMenuPanel';
import { PlayingPanel } from '../ui/PlayingPanel';
import { ResultPanel } from '../ui/ResultPanel';

/** 游戏流程的状态名。切换时用 app.flow.change(Flow.Playing)，避免手写字符串。 */
export const Flow = { Menu: 'menu', Playing: 'playing', Result: 'result' } as const;

// 界面由流程打开，并通过回调把「玩家想做什么」交回流程；界面自己不切换流程。
// 页面互相替换（打开新页面会关掉旧界面），所以状态退出时不用手动关界面。

/** 主菜单。 */
const menu: State<GameApp> = {
    enter(app) {
        app.ui.open(MainMenuPanel, { onStart: () => app.flow.change(Flow.Playing) });
    },
};

/** 营业中。之后在 enter 里创建一局的规则对象，在 update 里推进它。 */
const playing: State<GameApp> = {
    enter(app) {
        app.events.on('session:ended', summary => app.flow.change(Flow.Result, summary), playing);
        // 临时占位：规则迁移过来之前，由「打烊」按钮代替规则发出结束事件。
        app.ui.open(PlayingPanel, {
            onEnd: () => app.events.emit('session:ended', { money: 0, target: 150 }),
        });
    },
    exit(app) {
        app.events.offTarget(playing);
    },
};

/** 结算。结算弹窗叠在营业页面之上，数据由营业状态切换过来时带入。 */
const result: State<GameApp> = {
    enter(app, _from, data) {
        const summary = data as GameEvents['session:ended'];
        app.ui.open(ResultPanel, {
            money: summary.money,
            target: summary.target,
            onRestart: () => app.flow.change(Flow.Playing),
            onMenu: () => app.flow.change(Flow.Menu),
        });
    },
};

export function registerFlow(flow: StateMachine<GameApp>): void {
    flow.add(Flow.Menu, menu).add(Flow.Playing, playing).add(Flow.Result, result);
}
