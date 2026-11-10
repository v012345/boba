import { _decorator, Color, Component, Graphics, Node, Sprite, SpriteFrame } from 'cc';
import type { Ingredient } from '../logic/TeaGame';

const { ccclass, property } = _decorator;

/**
 * 一杯奶茶的样子：杯身图片按加入的配料切换，封口膜按需显示。
 * 制作台上的杯子、订单气泡里的示意图、飞给顾客的那一杯都用它。
 */
@ccclass('DrinkView')
export class DrinkView extends Component {
    @property(Sprite)
    body: Sprite = null!;
    @property({ type: Node, tooltip: '封口膜' })
    lid: Node = null!;
    @property({ type: Graphics, tooltip: '还没加奶就先加了小料时，临时画在杯里的小料' })
    toppings: Graphics = null!;

    @property({ type: SpriteFrame, tooltip: '空杯' })
    emptyFrame: SpriteFrame | null = null;
    @property({ type: SpriteFrame, tooltip: '只有茶底' })
    teaFrame: SpriteFrame | null = null;
    @property({ type: SpriteFrame, tooltip: '原味奶茶' })
    milkFrame: SpriteFrame | null = null;
    @property({ type: SpriteFrame, tooltip: '珍珠奶茶' })
    pearlFrame: SpriteFrame | null = null;
    @property({ type: SpriteFrame, tooltip: '椰果奶茶' })
    jellyFrame: SpriteFrame | null = null;
    @property({ type: SpriteFrame, tooltip: '双拼奶茶' })
    pearlJellyFrame: SpriteFrame | null = null;

    @property({ tooltip: '封盖过程中封口膜上下跳动的幅度' })
    lidBounce = 13;

    private lidY: number | null = null;

    /**
     * 按配料和封盖情况刷新外观。
     * sealingTime 只在封盖过程中传入（秒，持续增长），封口膜会随它上下跳动。
     */
    show(ingredients: readonly Ingredient[], lidOn: boolean, sealingTime?: number): void {
        const milk = ingredients.indexOf('milk') >= 0;
        const pearl = ingredients.indexOf('pearl') >= 0;
        const jelly = ingredients.indexOf('jelly') >= 0;
        let frame: SpriteFrame | null;
        if (!ingredients.length) frame = this.emptyFrame;
        else if (!milk) frame = this.teaFrame;
        else if (jelly) frame = pearl ? this.pearlJellyFrame : this.jellyFrame;
        else frame = pearl ? this.pearlFrame : this.milkFrame;
        if (this.body.spriteFrame !== frame) this.body.spriteFrame = frame;

        if (this.lidY === null) this.lidY = this.lid.position.y;
        this.lid.active = lidOn;
        const bounce = sealingTime === undefined ? 0 : Math.abs(Math.sin(sealingTime * 7)) * this.lidBounce;
        this.lid.setPosition(this.lid.position.x, this.lidY + bounce);

        this.drawLooseToppings(pearl && !milk, jelly && !milk);
    }

    // 成品都有对应的图片；「先加小料、后加奶」的中间状态没有图，暂时用代码画。
    private drawLooseToppings(pearl: boolean, jelly: boolean): void {
        const g = this.toppings;
        g.clear();
        if (pearl) {
            g.fillColor = new Color('#574033');
            for (let p = 0; p < 8; p++) { g.circle(-23 + p % 4 * 14, -39 + Math.floor(p / 4) * 12, 5); g.fill(); }
        }
        if (jelly) {
            g.fillColor = new Color('#FFF1CDD9'); g.strokeColor = new Color('#D9B785'); g.lineWidth = 1;
            for (let p = 0; p < 5; p++) { g.roundRect(-25 + p * 10, -27 + p % 2 * 10, 9, 11, 2); g.fill(); g.stroke(); }
        }
    }
}
