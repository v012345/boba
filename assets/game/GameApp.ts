import { App } from '../framework/core/App';
import { registerFlow } from './flow/GameFlow';
import type { GameEvents } from './GameEvents';

export type GameApp = App<GameEvents>;

/** 全游戏唯一的 app 实例。游戏代码需要事件、流程等服务时，都从这里取。 */
export const app: GameApp = new App<GameEvents>();
registerFlow(app.flow);
