import { _decorator, Color, Component, Label, Node, Sprite, SpriteFrame, UIOpacity, UITransform, Vec3 } from 'cc';
import { DropZone } from '../../framework/input/DropZone';
import { FillBar } from '../../framework/ui/FillBar';
import { CUSTOMER_NAMES } from '../config/Customers';
import { INGREDIENT_NAMES, RECIPES, TeaGame } from '../logic/TeaGame';
import { DrinkView } from './DrinkView';

const { ccclass, property } = _decorator;

/**
 * 一个顾客站位：头像、订单气泡、耐心条，以及进店和离店的动画。
 * 不自己跑 update，由 ShopView 每帧调用 tick，这样暂停时会跟着一起冻结。
 */
@ccclass('CustomerView')
export class CustomerView extends Component {
    @property({ type: UIOpacity, tooltip: '控制整个顾客淡入淡出' })
    fade: UIOpacity = null!;
    @property({ type: Node, tooltip: '头像节点，会上下起伏' })
    portrait: Node = null!;
    @property(Sprite)
    portraitSprite: Sprite = null!;
    @property({ type: [SpriteFrame], tooltip: '头像，按进店顺序循环使用' })
    portraits: SpriteFrame[] = [];
    @property({ type: DrinkView, tooltip: '气泡里的订单示意图' })
    order: DrinkView = null!;
    @property(Label)
    title: Label = null!;
    @property(Label)
    detail: Label = null!;
    @property(Label)
    mood: Label = null!;
    @property(FillBar)
    patience: FillBar = null!;
    @property({ type: DropZone, tooltip: '把奶茶拖到这个范围内算交给这位顾客' })
    dropZone: DropZone = null!;

    @property({ tooltip: '平时的文字和耐心条颜色' })
    calmColor = new Color(82, 123, 98, 255);
    @property({ tooltip: '快没耐心时的文字和耐心条颜色' })
    urgentColor = new Color(189, 102, 82, 255);
    @property({ tooltip: '快没耐心时头像的染色' })
    urgentTint = new Color(255, 226, 206, 255);
    @property({ tooltip: '耐心少于多少秒算「快没耐心」' })
    urgentSeconds = 10;
    @property({ tooltip: '进店动画时长（秒）' })
    enterDuration = 0.6;
    @property({ tooltip: '进店时从左边多远处走过来' })
    enterDistance = 110;
    @property({ tooltip: '离店时向右走多远' })
    exitDistance = 150;
    @property({ tooltip: '奶茶飞到顾客身上的位置，相对站位中心的高度' })
    receiveOffsetY = -33;
    @property({ tooltip: '「+¥」飘字出现的位置，相对站位中心的高度' })
    rewardOffsetY = 55;

    private session: TeaGame | null = null;
    private slot = 0;
    private shownId = -1;
    private arrival = 0;
    private goodbye = 0;
    private shake = 0;
    private home = new Vec3();
    private portraitHome = new Vec3();

    /** 站位中心往上 offsetY 处的世界坐标，不含进出场的位移。 */
    worldPoint(offsetY = 0): Vec3 {
        const local = new Vec3(this.home.x, this.home.y + offsetY, 0);
        return this.node.parent!.getComponent(UITransform)!.convertToWorldSpaceAR(local);
    }

    /** 绑定到某一局的某个站位。如果此刻已经有顾客，直接播放进店。 */
    bind(session: TeaGame, slot: number): void {
        this.session = session;
        this.slot = slot;
        this.home.set(this.node.position);
        this.portraitHome.set(this.portrait.position);
        this.dropZone.accepting = false;
        this.node.active = false;
        if (session.customers[slot]) this.arrive();
    }

    /** 新顾客进店：换头像、写订单、从左侧淡入。 */
    arrive(): void {
        const customer = this.session?.customers[this.slot];
        if (!customer) return;
        const recipe = RECIPES[customer.recipe];
        this.shownId = customer.id;
        this.arrival = this.enterDuration;
        this.goodbye = 0;
        this.node.active = true;
        if (this.portraits.length) this.portraitSprite.spriteFrame = this.portraits[(customer.id - 1) % this.portraits.length];
        this.order.node.active = true;
        this.order.show(recipe.ingredients, true);
        this.patience.node.active = true;
        this.title.string = `${recipe.name} · ¥${recipe.price}`;
        this.detail.string = recipe.ingredients.map(i => INGREDIENT_NAMES[i]).join(' + ');
        this.place();
        this.refreshMood();
    }

    /** 顾客离店：served 为 true 是满意离开，false 是等不及走了。 */
    leave(served: boolean): void {
        if (!this.session || !this.node.active) return;
        this.goodbye = this.session.departureDuration;
        this.arrival = 0;
        this.shownId = -1;
        this.dropZone.accepting = false;
        this.order.node.active = false;
        this.patience.node.active = false;
        this.portraitSprite.color = Color.WHITE;
        this.title.string = served ? '谢谢，好喝！' : '等太久啦…';
        this.detail.string = served ? '下次还来 ♡' : '下次再来吧';
        this.mood.string = served ? '满意离店' : '失望离店';
        this.mood.color = served ? this.calmColor : this.urgentColor;
    }

    /** 拿到的奶茶不对：摇头。 */
    refuse(): void {
        this.shake = 0.3;
    }

    /** 每帧推进动画并刷新耐心。clock 是 ShopView 的累计时间，用来让起伏连续。 */
    tick(dt: number, clock: number): void {
        if (!this.session || !this.node.active) return;
        this.arrival = Math.max(0, this.arrival - dt);
        this.goodbye = Math.max(0, this.goodbye - dt);
        const present = this.current() !== null;
        if (!present && this.goodbye === 0) { this.node.active = false; return; }
        this.dropZone.accepting = present;
        this.place();

        const urgent = this.refreshMood();
        const walking = this.arrival > 0 || this.goodbye > 0;
        this.portrait.setPosition(
            this.portraitHome.x + (urgent ? Math.sin(clock * 9) * 2 : 0),
            this.portraitHome.y + Math.sin(clock * (walking ? 17 : 2.6) + this.slot) * (walking ? 4 : 2),
        );
        if (this.shake > 0) {
            this.shake = Math.max(0, this.shake - dt);
            const t = 1 - this.shake / 0.3;
            this.portrait.angle = Math.sin(t * Math.PI * 6) * 6 * (1 - t);
        }
    }

    /** 正在显示的那位顾客；已经离开或换了人则为 null。 */
    private current() {
        const customer = this.session?.customers[this.slot];
        return customer && customer.id === this.shownId ? customer : null;
    }

    /** 按进店、离店的进度摆放位置和透明度。 */
    private place(): void {
        const entry = this.enterDuration > 0 ? this.arrival / this.enterDuration : 0;
        const total = this.session!.departureDuration;
        // 离店的前四分之一时间原地道别，之后才走开。
        const departure = this.goodbye > 0 ? Math.max(0, (1 - this.goodbye / total - 0.25) / 0.75) : 0;
        this.node.setPosition(this.home.x - this.enterDistance * entry * entry * entry + this.exitDistance * departure * departure, this.home.y);
        this.fade.opacity = Math.round(255 * (1 - entry) * (1 - departure));
    }

    /** 刷新耐心相关的显示，返回顾客是否快没耐心了。 */
    private refreshMood(): boolean {
        const customer = this.current();
        if (!customer) return false;
        const urgent = customer.patience < this.urgentSeconds;
        const color = urgent ? this.urgentColor : this.calmColor;
        const name = CUSTOMER_NAMES[(customer.id - 1) % CUSTOMER_NAMES.length];
        this.mood.string = `${name} · 拖杯交付 ${Math.ceil(customer.patience)}s`;
        this.mood.color = color;
        this.portraitSprite.color = urgent ? this.urgentTint : Color.WHITE;
        this.patience.set(customer.patience / customer.maxPatience, color);
        return urgent;
    }
}
