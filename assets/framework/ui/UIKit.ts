import { Button, Color, Graphics, Label, Node, UITransform, Widget } from 'cc';

/**
 * 用代码搭界面的小工具。坐标以父节点中心为原点，x 向右、y 向上。
 * 颜色用 '#RRGGBB' 或 '#RRGGBBAA' 字符串。
 */

/** 创建一个带尺寸的空节点。 */
export function createNode(parent: Node, name: string, x = 0, y = 0, width = 0, height = 0): Node {
    const node = new Node(name);
    node.layer = parent.layer;
    parent.addChild(node);
    node.addComponent(UITransform).setContentSize(width, height);
    node.setPosition(x, y);
    return node;
}

/** 创建一个始终铺满父节点的空节点，屏幕尺寸变化时会跟着变。 */
export function createFullscreenNode(parent: Node, name: string): Node {
    const size = parent.getComponent(UITransform)!.contentSize;
    const node = createNode(parent, name, 0, 0, size.width, size.height);
    const widget = node.addComponent(Widget);
    widget.isAlignTop = widget.isAlignBottom = widget.isAlignLeft = widget.isAlignRight = true;
    widget.top = widget.bottom = widget.left = widget.right = 0;
    widget.alignMode = Widget.AlignMode.ON_WINDOW_RESIZE;
    return node;
}

/** 给节点画一个铺满自身的纯色底，radius 为圆角半径。节点尺寸变化时自动重画。 */
export function fillBackground(node: Node, color: string, radius = 0): Graphics {
    const graphics = node.getComponent(Graphics) || node.addComponent(Graphics);
    const transform = node.getComponent(UITransform)!;
    const draw = () => {
        const { width, height } = transform.contentSize;
        graphics.clear();
        graphics.fillColor = new Color(color);
        if (radius > 0) graphics.roundRect(-width / 2, -height / 2, width, height, radius);
        else graphics.rect(-width / 2, -height / 2, width, height);
        graphics.fill();
    };
    draw();
    node.on(Node.EventType.SIZE_CHANGED, draw);
    return graphics;
}

/** 创建一段居中的文字，放不下时自动缩小。 */
export function createLabel(parent: Node, text: string, x: number, y: number, width: number, height: number, fontSize: number, color: string): Label {
    const label = createNode(parent, 'Label', x, y, width, height).addComponent(Label);
    label.string = text;
    label.fontSize = fontSize;
    label.lineHeight = Math.round(fontSize * 1.3);
    label.color = new Color(color);
    label.horizontalAlign = Label.HorizontalAlign.CENTER;
    label.verticalAlign = Label.VerticalAlign.CENTER;
    label.overflow = Label.Overflow.SHRINK;
    label.enableWrapText = true;
    return label;
}

export interface ButtonStyle { background: string; color: string; fontSize: number; radius: number }

/** 创建一个圆角按钮，按下时轻微缩小。 */
export function createButton(parent: Node, text: string, x: number, y: number, width: number, height: number, style: ButtonStyle, onClick: () => void): Node {
    const node = createNode(parent, 'Button', x, y, width, height);
    fillBackground(node, style.background, style.radius);
    createLabel(node, text, 0, 0, width - 16, height - 10, style.fontSize, style.color);
    const button = node.addComponent(Button);
    button.transition = Button.Transition.SCALE;
    button.zoomScale = 0.96;
    button.duration = 0.08;
    node.on(Button.EventType.CLICK, onClick);
    return node;
}
