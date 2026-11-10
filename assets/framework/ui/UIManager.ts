import { BlockInputEvents, Color, instantiate, Node, Prefab, UITransform, Widget } from 'cc';
import type { ResManager } from '../res/ResManager';
import { RoundRect } from './RoundRect';
import type { UIPanel } from './UIPanel';

/**
 * 界面层级，从下到上：
 * - page：整页界面，同一时刻只有一个。
 * - overlay：浮在页面上的常驻界面（比如 HUD），不挡下面的点击。
 * - popup：弹窗，背后有遮罩，挡住对下面的点击。
 * - top：最上层的系统提示（比如「请横屏」），同样带遮罩，换页时也不会被关掉。
 */
export type UILayer = 'page' | 'overlay' | 'popup' | 'top';

const LAYERS: { layer: UILayer; nodeName: string; modal: boolean }[] = [
    { layer: 'page', nodeName: 'PageLayer', modal: false },
    { layer: 'overlay', nodeName: 'OverlayLayer', modal: false },
    { layer: 'popup', nodeName: 'PopupLayer', modal: true },
    { layer: 'top', nodeName: 'TopLayer', modal: true },
];

/** 界面类：能被 new 出来，并带有静态的 prefab 和 layer。 */
export type PanelClass<Params> = (new () => UIPanel<Params>) & { prefab: string; layer: UILayer };

type OpenArgs<Params> = [Params] extends [void] ? [] : [Params];

/** 一次打开请求。预制体还在加载时 holder 和 panel 为空。 */
interface Entry { panelClass: PanelClass<any>; holder: Node | null; panel: UIPanel<any> | null }

/**
 * 界面管理：负责加载预制体、打开和关闭界面，并保证层级正确。
 * 换页规则：新页面加载好后，会替换掉在它之前打开的所有界面（top 层除外）。
 * 所以流程切换时只管打开新页面，不用手动关旧界面。
 */
export class UIManager {
    /** 弹窗背后遮罩的颜色。 */
    maskColor = new Color(0, 0, 0, 170);

    private res: ResManager;
    private layers: Record<UILayer, Node> | null = null;
    // 按请求的先后顺序排列。
    private entries: Entry[] = [];

    constructor(res: ResManager) {
        this.res = res;
    }

    /** 指定界面的根节点（一般是 Canvas）。每次进入新场景都要重新调用。 */
    init(root: Node): void {
        this.entries = [];
        const layers = {} as Record<UILayer, Node>;
        for (const { layer, nodeName } of LAYERS) layers[layer] = createFullscreenNode(root, nodeName);
        this.layers = layers;
    }

    /**
     * 打开界面。预制体加载是异步的，返回的 Promise 在界面显示出来（或加载失败）后完成。
     * 加载期间如果界面又被关闭或被新页面替换，它就不会再显示。
     */
    open<Params>(panelClass: PanelClass<Params>, ...args: OpenArgs<Params>): Promise<void> {
        if (!this.layers) throw new Error('UIManager 尚未初始化，请先调用 init');
        if (!panelClass.prefab) throw new Error(`${panelClass.name} 没有填写 static prefab`);
        // 页面以外的界面重复打开时，先关掉旧的。页面要等新的就绪后再换，避免闪一下空屏。
        if (panelClass.layer !== 'page') this.close(panelClass);

        const entry: Entry = { panelClass, holder: null, panel: null };
        this.entries.push(entry);
        return this.res.load(panelClass.prefab, Prefab).then(prefab => {
            const index = this.entries.indexOf(entry);
            if (index < 0 || !this.layers || !this.layers[panelClass.layer].isValid) return;
            if (panelClass.layer === 'page') {
                this.entries.slice(0, index).filter(old => old.panelClass.layer !== 'top').forEach(old => this.remove(old));
            }
            this.show(entry, prefab, args[0] as Params);
        }).catch(error => {
            this.remove(entry);
            console.error(`[UI] 打开 ${panelClass.name} 失败（${panelClass.prefab}）`, error);
        });
    }

    /** 关闭界面，可以传界面类，也可以传界面实例。没打开时什么都不做。 */
    close(target: PanelClass<any> | UIPanel<any>): void {
        const closing = this.entries.filter(entry => entry.panelClass === target || entry.panel === target);
        closing.forEach(entry => this.remove(entry));
    }

    /** 关闭所有界面，包括还在加载中的。 */
    closeAll(): void {
        this.entries.slice().reverse().forEach(entry => this.remove(entry));
    }

    /** 界面是否已打开或正在打开。 */
    isOpen(panelClass: PanelClass<any>): boolean {
        return this.entries.some(entry => entry.panelClass === panelClass);
    }

    private show(entry: Entry, prefab: Prefab, params: unknown): void {
        const { panelClass } = entry;
        const holder = createFullscreenNode(this.layers![panelClass.layer], panelClass.name || 'Panel');
        entry.holder = holder;
        if (LAYERS.some(item => item.layer === panelClass.layer && item.modal)) {
            holder.addComponent(RoundRect).color = this.maskColor;
            holder.addComponent(BlockInputEvents);
        }
        const node = instantiate(prefab);
        holder.addChild(node);
        const panel = node.getComponent(panelClass);
        if (!panel) throw new Error(`预制体根节点上没有挂 ${panelClass.name} 组件`);
        entry.panel = panel;
        panel.ui = this;
        panel.onOpen(params);
    }

    private remove(entry: Entry): void {
        const index = this.entries.indexOf(entry);
        if (index < 0) return;
        // 先移出列表，界面在 onClose 里再次调用 close 也不会重复关闭。
        this.entries.splice(index, 1);
        if (entry.panel && entry.panel.isValid) entry.panel.onClose();
        if (entry.holder && entry.holder.isValid) entry.holder.destroy();
    }
}

/** 创建一个始终铺满父节点的空节点，屏幕尺寸变化时会跟着变。 */
function createFullscreenNode(parent: Node, name: string): Node {
    const node = new Node(name);
    node.layer = parent.layer;
    parent.addChild(node);
    node.addComponent(UITransform).setContentSize(parent.getComponent(UITransform)!.contentSize);
    const widget = node.addComponent(Widget);
    widget.isAlignTop = widget.isAlignBottom = widget.isAlignLeft = widget.isAlignRight = true;
    widget.top = widget.bottom = widget.left = widget.right = 0;
    widget.alignMode = Widget.AlignMode.ON_WINDOW_RESIZE;
    return node;
}
