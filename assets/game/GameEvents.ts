/**
 * 本游戏的全部事件：事件名 → 携带的数据。全部由规则（game/logic）发出，画面和界面监听。
 * 新增事件只需要在这里加一行，emit 和 on 的地方都会自动得到类型检查。
 */
export interface GameEvents {
    /** 顾客进店并点单。slot 是当前店铺配置中的站位序号（从 0 开始）。 */
    'customer:arrived': { slot: number };
    /** 顾客离店。served 为 true 表示拿到了奶茶，false 表示等不及走了。 */
    'customer:left': { slot: number; served: boolean };
    /** 封盖机封好了一杯。cup 是杯位序号。 */
    'cup:sealed': { cup: number };
    /** 一局营业结束（时间到）。 */
    'session:ended': SessionSummary;
}

/** 一局营业的结算数据。 */
export interface SessionSummary {
    /** 营业额。 */
    money: number;
    /** 目标营业额。 */
    target: number;
    /** 完成的订单数。 */
    served: number;
    /** 等不及离开的顾客数。 */
    lost: number;
    /** 最高连击。 */
    bestCombo: number;
}
