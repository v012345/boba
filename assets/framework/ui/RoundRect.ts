import { _decorator, CCFloat, Color, Component, Graphics, Node, UITransform } from 'cc';

const { ccclass, property, requireComponent, executeInEditMode, menu } = _decorator;

/**
 * 纯色圆角矩形底板，铺满所在节点。挂到节点上即可，不需要图片素材。
 * 在编辑器里也会实时显示，改颜色、圆角或节点尺寸都会立刻重画。
 * 用于卡片、按钮底、遮罩等。
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

    @property({ type: Color, tooltip: '填充颜色' })
    get color(): Color { return this._color; }
    set color(value: Color) { this._color.set(value); this.draw(); }

    @property({ type: CCFloat, min: 0, tooltip: '圆角半径，0 为直角' })
    get radius(): number { return this._radius; }
    set radius(value: number) { this._radius = Math.max(0, value); this.draw(); }

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
        const radius = Math.min(this._radius, width / 2, height / 2);
        graphics.clear();
        graphics.fillColor = this._color;
        if (radius > 0) graphics.roundRect(x, y, width, height, radius);
        else graphics.rect(x, y, width, height);
        graphics.fill();
    }
}
