import { Game, game, Prefab } from 'cc';
import type { State, StateMachine } from '../../framework/fsm/StateMachine';
import type { GameApp } from '../GameApp';
import type { SessionSummary } from '../GameEvents';
import { TeaGame } from '../logic/TeaGame';
import { DEFAULT_SHOP_ID, getShopDefinition } from '../config/Shops';
import { HudPanel } from '../ui/HudPanel';
import { MainMenuPanel } from '../ui/MainMenuPanel';
import { PausePanel } from '../ui/PausePanel';
import { ResultPanel } from '../ui/ResultPanel';
import { ShopView } from '../view/ShopView';

/** 游戏流程的状态名。切换时用 app.flow.change(Flow.Playing)，避免手写字符串。 */
export const Flow = { Menu: 'menu', Playing: 'playing', Result: 'result' } as const;

interface ShopSelection { shopId?: string }
interface ShopResult { summary: SessionSummary; shopId: string }

function selectedShop(data?: unknown): string {
    return (data as ShopSelection | undefined)?.shopId || DEFAULT_SHOP_ID;
}

// 界面由流程打开，并通过回调把「玩家想做什么」交回流程；界面自己不切换流程。
// 页面互相替换（新页面就绪后会关掉旧界面），所以状态退出时不用手动关界面。

/** 主菜单。 */
class MenuState implements State<GameApp> {
    enter(app: GameApp, _from: string | null, data?: unknown) {
        const shopId = selectedShop(data);
        app.ui.open(MainMenuPanel, { onStart: () => app.flow.change(Flow.Playing, { shopId }) });
    }
}

/** 营业中：创建一局规则并每帧推进它，直到规则发出结束事件。 */
class PlayingState implements State<GameApp> {
    private app: GameApp | null = null;
    private session: TeaGame | null = null;
    private shopId: string = DEFAULT_SHOP_ID;
    private generation = 0;
    private ready = false;
    private hiddenDuringLoad = false;

    enter(app: GameApp, _from: string | null, data?: unknown) {
        this.app = app;
        this.shopId = selectedShop(data);
        this.ready = false;
        this.hiddenDuringLoad = false;
        const generation = ++this.generation;
        app.events.on('session:ended', summary => app.flow.change(Flow.Result, { summary, shopId: this.shopId }), this);
        // 切到后台时自动暂停，回来后由玩家自己点继续。
        game.on(Game.EVENT_HIDE, this.pause, this);
        void this.openShop(app, generation);
    }

    private async openShop(app: GameApp, generation: number): Promise<void> {
        try {
            const shop = getShopDefinition(this.shopId);
            // 提前加载整套依赖，店铺与 HUD 都就绪之前不扣营业时间和顾客耐心。
            const [layoutPrefab] = await Promise.all([
                app.res.load(shop.layoutPath, Prefab),
                app.res.load(ShopView.prefab, Prefab),
                app.res.load(HudPanel.prefab, Prefab),
            ]);
            if (generation !== this.generation) return;
            const session = new TeaGame(Math.random, app.events, shop.profile);
            session.paused = true;
            this.session = session;
            let opened = false;
            await app.ui.open(ShopView, { session, shop, layoutPrefab, onReady: () => { opened = true; } });
            if (generation !== this.generation) return;
            if (!opened) throw new Error(`店铺 ${shop.id} 的布局初始化失败`);
            await app.ui.open(HudPanel, { session, onPause: () => this.pause() });
            if (generation !== this.generation) return;
            this.ready = true;
            session.paused = false;
            if (this.hiddenDuringLoad) this.pause();
        } catch (error) {
            if (generation !== this.generation) return;
            console.error('[Shop] 打开店铺失败', error);
            app.flow.change(Flow.Menu, { shopId: this.shopId });
        }
    }

    update(_app: GameApp, dt: number) {
        if (this.ready) this.session?.tick(dt);
    }

    exit(app: GameApp) {
        app.events.offTarget(this);
        game.off(Game.EVENT_HIDE, this.pause, this);
        ++this.generation;
        if (!this.ready) {
            app.ui.close(ShopView);
            app.ui.close(HudPanel);
        }
        this.ready = false;
        this.app = null;
        this.session = null;
    }

    private pause() {
        this.hiddenDuringLoad = true;
        const app = this.app, session = this.session;
        if (!this.ready || !app || !session || !session.active) return;
        session.paused = true;
        app.ui.open(PausePanel, {
            onResume: () => { session.paused = false; app.ui.close(PausePanel); },
            onMenu: () => app.flow.change(Flow.Menu, { shopId: this.shopId }),
        });
    }
}

/** 结算。结算弹窗叠在制作台页面之上，数据由营业状态切换过来时带入。 */
class ResultState implements State<GameApp> {
    enter(app: GameApp, _from: string | null, data?: unknown) {
        const result = data as ShopResult;
        app.ui.open(ResultPanel, {
            summary: result.summary,
            onRestart: () => app.flow.change(Flow.Playing, { shopId: result.shopId }),
            onMenu: () => app.flow.change(Flow.Menu, { shopId: result.shopId }),
        });
    }
}

export function registerFlow(flow: StateMachine<GameApp>): void {
    flow.add(Flow.Menu, new MenuState()).add(Flow.Playing, new PlayingState()).add(Flow.Result, new ResultState());
}
