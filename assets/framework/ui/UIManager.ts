import { BlockInputEvents, Node } from 'cc';
import { createFullscreenNode, fillBackground } from './UIKit';
import type { UIPanel } from './UIPanel';

export type UILayer = 'page' | 'popup';

/** 界面类：能被 new 出来，并带有静态的 layer。 */
export type PanelClass<Params> = (new () => UIPanel<Params>) & { layer: UILayer };

type OpenArgs<Params> = [Params] extends [void] ? [] : [Params];

interface Entry { panelClass: PanelClass<any>; panel: UIPanel<any>; holder: Node }

/**
 * 界面管理：负责打开、关闭界面，并保证层级正确。
 * - 页面（page）同一时刻只有一个：打开新页面会关掉当前所有界面。
 * - 弹窗（popup）叠在页面之上，背后自动加一层遮罩，挡住对下面的点击。
 *
 * 目前界面都用代码搭建；以后要支持预制体，在 open 里改成先加载再创建即可。
 */
export class UIManager {
    /** 弹窗背后遮罩的颜色。 */
    maskColor = '#000000AA';

    private layers: Record<UILayer, Node> | null = null;
    private entries: Entry[] = [];

    /** 指定界面的根节点（一般是 Canvas）。每次进入新场景都要重新调用。 */
    init(root: Node): void {
        this.entries = [];
        this.layers = {
            page: createFullscreenNode(root, 'PageLayer'),
            popup: createFullscreenNode(root, 'PopupLayer'),
        };
    }

    /** 打开界面。同一个弹窗重复打开时，会先关掉旧的。 */
    open<Params>(panelClass: PanelClass<Params>, ...args: OpenArgs<Params>): void {
        if (!this.layers) throw new Error('UIManager 尚未初始化，请先调用 init');
        if (panelClass.layer === 'page') this.closeAll();
        else this.close(panelClass);

        const holder = createFullscreenNode(this.layers[panelClass.layer], panelClass.name || 'Panel');
        if (panelClass.layer === 'popup') {
            fillBackground(holder, this.maskColor);
            holder.addComponent(BlockInputEvents);
        }
        const panel = createFullscreenNode(holder, 'Content').addComponent(panelClass);
        panel.ui = this;
        this.entries.push({ panelClass, panel, holder });
        panel.onOpen(args[0] as Params);
    }

    /** 关闭界面，可以传界面类，也可以传界面实例。没打开时什么都不做。 */
    close(target: PanelClass<any> | UIPanel<any>): void {
        const closing = this.entries.filter(entry => entry.panelClass === target || entry.panel === target);
        closing.forEach(entry => this.remove(entry));
    }

    /** 关闭所有界面。 */
    closeAll(): void {
        this.entries.slice().reverse().forEach(entry => this.remove(entry));
    }

    isOpen(panelClass: PanelClass<any>): boolean {
        return this.entries.some(entry => entry.panelClass === panelClass);
    }

    private remove(entry: Entry): void {
        const index = this.entries.indexOf(entry);
        if (index < 0) return;
        // 先移出列表，界面在 onClose 里再次调用 close 也不会重复关闭。
        this.entries.splice(index, 1);
        if (entry.panel.isValid) entry.panel.onClose();
        if (entry.holder.isValid) entry.holder.destroy();
    }
}
