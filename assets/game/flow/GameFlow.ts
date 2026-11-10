import type { State, StateMachine } from '../../framework/fsm/StateMachine';
import type { GameApp } from '../GameApp';
import type { SessionSummary } from '../GameEvents';
import { TeaGame } from '../logic/TeaGame';
import { HudPanel } from '../ui/HudPanel';
import { MainMenuPanel } from '../ui/MainMenuPanel';
import { PausePanel } from '../ui/PausePanel';
import { ResultPanel } from '../ui/ResultPanel';

/** 游戏流程的状态名。切换时用 app.flow.change(Flow.Playing)，避免手写字符串。 */
export const Flow = { Menu: 'menu', Playing: 'playing', Result: 'result' } as const;

// 界面由流程打开，并通过回调把「玩家想做什么」交回流程；界面自己不切换流程。
// 页面互相替换（新页面就绪后会关掉旧界面），所以状态退出时不用手动关界面。

/** 主菜单。 */
class MenuState implements State<GameApp> {
    enter(app: GameApp) {
        app.ui.open(MainMenuPanel, { onStart: () => app.flow.change(Flow.Playing) });
    }
}

/** 营业中：创建一局规则并每帧推进它，直到规则发出结束事件。 */
class PlayingState implements State<GameApp> {
    private session: TeaGame | null = null;

    enter(app: GameApp) {
        const session = new TeaGame(Math.random, app.events);
        this.session = session;
        app.events.on('session:ended', summary => app.flow.change(Flow.Result, summary), this);
        app.ui.open(HudPanel, {
            session,
            onPause: () => {
                session.paused = true;
                app.ui.open(PausePanel, {
                    onResume: () => { session.paused = false; app.ui.close(PausePanel); },
                    onMenu: () => app.flow.change(Flow.Menu),
                });
            },
        });
    }

    update(_app: GameApp, dt: number) {
        this.session?.tick(dt);
    }

    exit(app: GameApp) {
        app.events.offTarget(this);
        this.session = null;
    }
}

/** 结算。结算弹窗叠在营业页面之上，数据由营业状态切换过来时带入。 */
class ResultState implements State<GameApp> {
    enter(app: GameApp, _from: string | null, data?: unknown) {
        app.ui.open(ResultPanel, {
            summary: data as SessionSummary,
            onRestart: () => app.flow.change(Flow.Playing),
            onMenu: () => app.flow.change(Flow.Menu),
        });
    }
}

export function registerFlow(flow: StateMachine<GameApp>): void {
    flow.add(Flow.Menu, new MenuState()).add(Flow.Playing, new PlayingState()).add(Flow.Result, new ResultState());
}
