import { _decorator, CCFloat, Color, Component, Graphics, Node, UITransform } from 'cc';

const { ccclass, property, requireComponent, executeInEditMode, menu } = _decorator;

/**
 * 纯色圆角矩形，铺满所在节点，可以带描边。挂到节点上即可，不需要图片素材。
 * 在编辑器里也会实时显示，改颜色、圆角、描边或节点尺寸都会立刻重画。
 * 用于卡片、按钮底、遮罩、进度条、提示框等。只要描边不要填充时，把填充颜色的透明度设为 0。
 */
@ccclass('RoundRect')
@requireComponent(Graphics)
@executeInEditMode
@menu('UI/RoundRect')
export class RoundRect extends Component {
    @property
    private _color = new Color(255, 255, 255, 255);
    @property
    private _radius = 0;
    @property
    private _strokeColor = new Color(0, 0, 0, 255);
    @property
    private _strokeWidth = 0;

    @property({ type: Color, tooltip: '填充颜色' })
    get color(): Color { return this._color; }
    set color(value: Color) { this._color.set(value); this.draw(); }

    @property({ type: CCFloat, min: 0, tooltip: '圆角半径，0 为直角' })
    get radius(): number { return this._radius; }
    set radius(value: number) { this._radius = Math.max(0, value); this.draw(); }

    @property({ type: Color, tooltip: '描边颜色' })
    get strokeColor(): Color { return this._strokeColor; }
    set strokeColor(value: Color) { this._strokeColor.set(value); this.draw(); }

    @property({ type: CCFloat, min: 0, tooltip: '描边宽度，0 为不描边。描边画在矩形内侧' })
    get strokeWidth(): number { return this._strokeWidth; }
    set strokeWidth(value: number) { this._strokeWidth = Math.max(0, value); this.draw(); }

    onEnable() {
        this.node.on(Node.EventType.SIZE_CHANGED, this.draw, this);
        this.node.on(Node.EventType.ANCHOR_CHANGED, this.draw, this);
        this.draw();
    }

    onDisable() {
        this.node.off(Node.EventType.SIZE_CHANGED, this.draw, this);
        this.node.off(Node.EventType.ANCHOR_CHANGED, this.draw, this);
    }

    private draw() {
        const graphics = this.getComponent(Graphics);
        const transform = this.getComponent(UITransform);
        if (!graphics || !transform) return;
        const { width, height } = transform.contentSize;
        const x = -width * transform.anchorX, y = -height * transform.anchorY;
        graphics.clear();
        if (this._color.a > 0) {
            this.path(graphics, x, y, width, height, this._radius);
            graphics.fillColor = this._color;
            graphics.fill();
        }
        const stroke = Math.min(this._strokeWidth, width / 2, height / 2);
        if (stroke > 0 && this._strokeColor.a > 0) {
            // 线条以路径为中心向两侧各占一半，所以路径向内收半个线宽。
            const inset = stroke / 2;
            this.path(graphics, x + inset, y + inset, width - stroke, height - stroke, this._radius - inset);
            graphics.lineWidth = stroke;
            graphics.strokeColor = this._strokeColor;
            graphics.stroke();
        }
    }

    private path(graphics: Graphics, x: number, y: number, width: number, height: number, radius: number) {
        const r = Math.max(0, Math.min(radius, width / 2, height / 2));
        if (r > 0) graphics.roundRect(x, y, width, height, r);
        else graphics.rect(x, y, width, height);
    }
}
