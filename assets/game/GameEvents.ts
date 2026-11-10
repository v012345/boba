/**
 * 本游戏的全部事件：事件名 → 携带的数据。
 * 新增事件只需要在这里加一行，emit 和 on 的地方都会自动得到类型检查。
 */
export interface GameEvents {
    /** 一局营业结束（时间到），由规则发出。 */
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
