import { _decorator, Component, director, ResolutionPolicy, view } from 'cc';
import { OrientationWatcher } from '../framework/platform/Orientation';
import { app } from './GameApp';
import { RotateHintPanel } from './ui/RotateHintPanel';
import { LevelSelectView } from './view/LevelSelectView';

const { ccclass } = _decorator;

/** 游戏入口：挂在启动场景的 Canvas 上。负责初始化界面根节点、进入第一个流程，并每帧驱动 app。 */
@ccclass('Main')
export class Main extends Component {
    private orientation: OrientationWatcher | null = null;

    start() {
        // 界面按 1280×720 设计。整屏等比缩放、不裁切，比例不同的屏幕会在两侧或上下留边。
        view.setDesignResolutionSize(1280, 720, ResolutionPolicy.SHOW_ALL);
        app.ui.init(this.node);
        // 开发期间直接打开选关页面。
        app.ui.open<any>(LevelSelectView);
        this.orientation = new OrientationWatcher(portrait => this.onOrientationChange(portrait));
        this.orientation.start();
    }

    update(dt: number) {
        app.update(dt);
    }

    onDestroy() {
        this.orientation?.stop();
        if (director.isPaused()) director.resume();
    }

    /**
     * 这个游戏只支持横屏。竖屏时盖一层提示并暂停整个游戏（计时和动画都停，按钮仍可点），
     * 转回横屏自动继续。
     */
    private onOrientationChange(portrait: boolean) {
        if (!portrait) {
            director.resume();
            app.ui.close(RotateHintPanel);
            return;
        }
        app.ui.open(RotateHintPanel, {
            canLock: OrientationWatcher.canLock(),
            onLock: () => OrientationWatcher.requestLandscape(),
        }).then(() => {
            // 提示显示出来之后再暂停；加载期间如果已经转回横屏就不暂停了。
            if (this.orientation?.portrait && app.ui.isOpen(RotateHintPanel)) director.pause();
        });
    }
}
