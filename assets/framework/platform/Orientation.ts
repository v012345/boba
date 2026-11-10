import { screen } from 'cc';

/**
 * 横竖屏监视：给只支持横屏的游戏用。
 * 网页没法强制横屏，所以做法是：发现视口是竖的就通知游戏（游戏自己决定怎么拦，比如弹提示并暂停），
 * 转回横屏再通知一次。原生包的方向由构建配置锁定，这里主要服务于网页。
 */
export class OrientationWatcher {
    private onChange: (portrait: boolean) => void;
    private isPortrait = false;
    private timer: ReturnType<typeof setInterval> | null = null;

    constructor(onChange: (portrait: boolean) => void) {
        this.onChange = onChange;
    }

    /** 当前是否竖屏。 */
    get portrait(): boolean { return this.isPortrait; }

    /** 开始监视。如果此刻已经是竖屏，会立即回调一次。 */
    start(): void {
        if (this.timer !== null) return;
        // 有些浏览器在旋转事件之后一两帧才报出新的尺寸，所以除了监听事件，还定时再看一眼。
        this.timer = setInterval(this.check, 400);
        if (typeof window !== 'undefined' && window.addEventListener) {
            window.addEventListener('resize', this.check);
            window.addEventListener('orientationchange', this.check);
        }
        this.check();
    }

    stop(): void {
        if (this.timer === null) return;
        clearInterval(this.timer);
        this.timer = null;
        if (typeof window !== 'undefined' && window.removeEventListener) {
            window.removeEventListener('resize', this.check);
            window.removeEventListener('orientationchange', this.check);
        }
    }

    /** 这个浏览器能不能用代码锁定方向。iOS Safari 完全不支持，这时不要给玩家一个点了没反应的按钮。 */
    static canLock(): boolean {
        const orientation = screenOrientation();
        return !!orientation && typeof orientation.lock === 'function';
    }

    /** 进入全屏并尝试锁定横屏。必须在玩家点击的回调里调用，浏览器才允许。不支持时静默失败。 */
    static requestLandscape(): void {
        if (typeof document === 'undefined') return;
        const lock = () => {
            const orientation = screenOrientation();
            if (!orientation || typeof orientation.lock !== 'function') return;
            try {
                const attempt = orientation.lock('landscape');
                if (attempt && typeof attempt.catch === 'function') attempt.catch(() => {});
            } catch (error) { console.warn('[Orientation] 无法锁定横屏', error); }
        };
        const element: any = document.documentElement;
        if (!element || !element.requestFullscreen) { lock(); return; }
        try {
            const attempt = element.requestFullscreen();
            if (attempt && typeof attempt.then === 'function') attempt.then(lock, lock);
            else lock();
        } catch (error) { console.warn('[Orientation] 无法进入全屏', error); }
    }

    private readonly check = () => {
        const size = viewportSize();
        if (size.width < 16 || size.height < 16) return;
        // 留 2% 的余量，接近正方形的窗口不算竖屏。
        const portrait = size.height > size.width * 1.02;
        if (portrait === this.isPortrait) return;
        this.isPortrait = portrait;
        this.onChange(portrait);
    };
}

/** 网页上取 CSS 视口（玩家实际拿着的方向），原生上取引擎的窗口尺寸。 */
function viewportSize(): { width: number; height: number } {
    if (typeof window !== 'undefined' && window.innerWidth > 0) return { width: window.innerWidth, height: window.innerHeight };
    const size = screen.windowSize;
    return { width: size.width, height: size.height };
}

function screenOrientation(): any {
    if (typeof window === 'undefined' || !window.screen) return null;
    return (window.screen as any).orientation;
}
