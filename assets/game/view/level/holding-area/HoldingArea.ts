import { _decorator, Component } from 'cc';

const { ccclass } = _decorator;

/** 容器暂存区。 */
@ccclass('HoldingArea')
export class HoldingArea extends Component {
    /** 可暂存的容器数量，由关卡配置设置。 */
    capacity = 1;
}
