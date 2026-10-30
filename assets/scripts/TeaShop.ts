import { _decorator, Component, Node, UITransform, Graphics, Color, Label, Layers, view, ResolutionPolicy, BlockInputEvents, Sprite, SpriteFrame, Texture2D, ImageAsset, resources, Rect, Size, game as engineGame, Game } from 'cc';
import { TeaGame, RECIPES, INGREDIENT_NAMES, Ingredient, Cup } from './TeaGame';

const { ccclass } = _decorator;
const C = { ink: '#513B30', muted: '#8C7560', cream: '#FFF8E8', green: '#527B62', mint: '#E6EDDA', red: '#BD6652', gold: '#D49A4C' };
const ITEMS: Ingredient[] = ['tea', 'milk', 'pearl', 'jelly'];
const NAMES = ['小橘', '阿青', '林奶奶', '小陆'];
interface CustomerUI { node: Node; portrait: Node; sprite: Sprite; title: Label; detail: Label; mood: Label; bar: Graphics; id: number; arrival: number; goodbye: number }
interface CupUI { node: Node; art: Graphics; title: Label; detail: Label; status: Label; bar: Graphics; fill: number; pulse: number; lastState: string }
interface Effect { node: Node; age: number; duration: number; step: (t: number) => void }

/** Runtime UI: keep the existing TeaShop component on Canvas; no manual bindings. */
@ccclass('TeaShop')
export class TeaShop extends Component {
    private game = new TeaGame();
    private root!: Node;
    private fx!: Node;
    private hud!: Label;
    private toast!: Label;
    private customers: CustomerUI[] = [];
    private cups: CupUI[] = [];
    private effects: Effect[] = [];
    private frames: SpriteFrame[] = [];
    private textures: Texture2D[] = [];
    private portraits: SpriteFrame[] = [];
    private ingredientArt: Sprite[] = [];
    private overlay: Node | null = null;
    private overlayKind = '';
    private loading = true;
    private clock = 0;
    private refreshIn = 0;

    start() {
        view.setDesignResolutionSize(1280, 720, ResolutionPolicy.SHOW_ALL);
        this.root = this.nodeAt(this.node, 'TeaShopUI', 0, 0, 1280, 720);
        this.panel(this.root, 1280, 720, '#DEC39A', 0);
        const background = this.nodeAt(this.root, 'ShopBackground', 0, 0, 1280, 720).addComponent(Sprite);
        background.sizeMode = Sprite.SizeMode.CUSTOM;
        this.panel(this.nodeAt(this.root, 'Header', 0, 304, 1192, 74), 1192, 74, '#FFF8E8F5');
        this.text(this.root, '巷口奶茶铺', -432, 307, 280, 44, 31, C.ink);
        this.hud = this.text(this.root, '', 80, 307, 660, 44, 25, C.ink);
        this.button(this.root, '暂停', 530, 304, 112, 68, C.green, () => { this.game.paused = true; this.render(); });

        for (let i = 0; i < 3; i++) {
            const node = this.nodeAt(this.root, `Customer${i}`, -398 + i * 398, 157, 380, 204);
            this.panel(node, 380, 204, '#FFF8E8F2');
            const portrait = this.nodeAt(node, 'Portrait', -120, 5, 130, 150);
            const sprite = portrait.addComponent(Sprite); sprite.sizeMode = Sprite.SizeMode.CUSTOM;
            const ui: CustomerUI = { node, portrait, sprite, id: -1, arrival: 0, goodbye: 0,
                title: this.text(node, '', 65, 66, 225, 36, 25, C.ink),
                detail: this.text(node, '', 65, 5, 225, 78, 22, C.ink),
                mood: this.text(node, '', 30, -61, 290, 32, 21, C.green),
                bar: this.nodeAt(node, 'Patience', 0, -88, 340, 8).addComponent(Graphics) };
            node.on(Node.EventType.TOUCH_END, () => this.deliver(i), this);
            this.customers.push(ui);
        }
        for (let i = 0; i < 2; i++) {
            const node = this.nodeAt(this.root, `Station${i}`, -398 + i * 398, -58, 380, 200);
            this.panel(node, 380, 200, C.cream);
            const ui: CupUI = { node, fill: 0, pulse: 0, lastState: 'empty',
                art: this.nodeAt(node, 'Cup', -110, -8, 110, 130).addComponent(Graphics),
                title: this.text(node, '', 0, 73, 345, 34, 23, C.ink),
                detail: this.text(node, '', 62, 17, 225, 72, 22, C.ink),
                status: this.text(node, '', 62, -49, 225, 52, 21, C.green),
                bar: this.nodeAt(node, 'SealProgress', 0, -87, 335, 7).addComponent(Graphics) };
            node.on(Node.EventType.TOUCH_END, () => { if (!this.canAct()) return; this.game.select(i); ui.pulse = 0.28; this.render(); }, this);
            this.cups.push(ui);
        }
        const book = this.nodeAt(this.root, 'RecipeBook', 398, -58, 380, 200);
        this.panel(book, 380, 200, '#FFF8E8F5');
        this.text(book, '今日配方', 0, 73, 340, 34, 25, C.green);
        this.text(book, '原味 = 红茶 + 鲜奶\n珍珠 / 椰果 = 原味 + 对应配料\n双拼 = 原味 + 珍珠 + 椰果', 0, 10, 345, 106, 21, C.ink);
        this.text(book, '选中成品 → 点击顾客', 0, -69, 345, 32, 21, C.green);
        ITEMS.forEach((ingredient, index) => {
            const node = this.button(this.root, '', -500 + index * 188, -232, 172, 126, C.cream, () => this.addIngredient(ingredient, index));
            const icon = this.nodeAt(node, ingredient, -34, 11, 90, 90).addComponent(Sprite); icon.sizeMode = Sprite.SizeMode.CUSTOM;
            this.ingredientArt.push(icon);
            this.text(node, INGREDIENT_NAMES[ingredient], 42, 0, 78, 50, 24, C.ink);
            this.text(node, index < 2 ? '基础茶底' : '按单添加', 0, -44, 148, 25, 18, C.muted);
        });
        this.button(this.root, '封杯\n2.5 秒', 298, -232, 204, 126, C.green, () => {
            const ui = this.cups[this.game.selected]; this.game.seal();
            if (this.game.cups[this.game.selected].state === 'sealing') ui.pulse = 0.3;
            this.render();
        });
        this.button(this.root, '倒掉\n重做', 502, -232, 172, 126, C.red, () => {
            this.game.discard(); this.cups[this.game.selected].pulse = 0.3; this.render();
        });
        this.panel(this.nodeAt(this.root, 'ToastPanel', 0, -324, 1192, 44), 1192, 44, '#FFF8E8EF', 12);
        this.toast = this.text(this.root, '正在布置奶茶铺…', 0, -324, 1160, 40, 22, C.ink);
        this.fx = this.nodeAt(this.root, 'Effects', 0, 0, 1280, 720);
        engineGame.on(Game.EVENT_HIDE, this.onHide, this);
        this.render();
        Promise.all([
            this.loadArt('shop', texture => { background.spriteFrame = this.frame(texture); }),
            this.loadArt('customers', texture => {
                this.portraits = [0, 1, 2, 3].map(i => this.frame(texture, i));
            }),
            this.loadArt('ingredients', texture => this.ingredientArt.forEach((sprite, i) => { sprite.spriteFrame = this.frame(texture, i); })),
        ]).then(() => {
            if (!this.isValid) return;
            this.loading = false; this.render();
        });
    }

    private canAct() { return !this.loading && this.game.active; }
    private onHide() { if (!this.game.ended) { this.game.paused = true; this.render(); } }
    private loadArt(name: string, apply: (texture: Texture2D) => void): Promise<void> {
        return new Promise(resolve => resources.load(`art/${name}`, ImageAsset, (error, image) => {
            if (this.isValid && !error) {
                const texture = new Texture2D(); texture.image = image;
                this.textures.push(texture); apply(texture);
            } else if (error) console.warn(`[TeaShop] 美术资源加载失败: ${name}`, error);
            resolve();
        }));
    }
    private frame(texture: Texture2D, cell?: number) {
        const frame = new SpriteFrame(); frame.texture = texture;
        if (cell !== undefined) {
            const w = texture.width / 2, h = texture.height / 2;
            frame.rect = new Rect((cell % 2) * w, Math.floor(cell / 2) * h, w, h);
            frame.originalSize = new Size(w, h);
        }
        this.frames.push(frame); return frame;
    }

    update(dt: number) {
        if (!this.root || this.loading) return;
        this.game.tick(dt);
        if (this.game.active) {
            this.clock += dt;
            for (let index = 0; index < this.customers.length; index++) {
                const ui = this.customers[index];
                ui.arrival = Math.max(0, ui.arrival - dt);
                ui.goodbye = Math.max(0, ui.goodbye - dt);
                const pop = 1 - Math.pow(ui.arrival / 0.4, 2);
                ui.portrait.setScale(0.88 + 0.12 * pop, 0.88 + 0.12 * pop, 1);
                const customer = this.game.customers[index];
                const urgent = customer && customer.patience < 10;
                ui.portrait.setPosition(-120 + (urgent ? Math.sin(this.clock * 9) * 2 : 0), 5 + Math.sin(this.clock * 2.6 + ui.id) * 2 - ui.arrival * 40 + (ui.goodbye > 0 ? Math.abs(Math.sin(ui.goodbye * 9)) * 9 : 0));
            }
            this.cups.forEach((ui, index) => {
                const cup = this.game.cups[index];
                const target = cup.ingredients.length ? (cup.ingredients.indexOf('milk') >= 0 ? 76 : 40) : 0;
                ui.fill += (target - ui.fill) * Math.min(1, dt * 9);
                ui.pulse = Math.max(0, ui.pulse - dt);
                ui.art.node.setScale(1 + Math.sin(ui.pulse / 0.3 * Math.PI) * 0.08, 1, 1);
                if (cup.state === 'ready' && ui.lastState === 'sealing') {
                    ui.pulse = 0.3; this.floatText('封好啦！', ui.node.position.x, 12, C.green);
                }
                ui.lastState = cup.state;
                this.drawCup(ui.art, cup, ui.fill, this.clock);
            });
            this.effects = this.effects.filter(effect => {
                effect.age += dt; effect.step(Math.min(1, effect.age / effect.duration));
                if (effect.age >= effect.duration) { effect.node.destroy(); return false; } return true;
            });
        }
        this.refreshIn -= dt;
        if (this.refreshIn <= 0) { this.refreshIn = 0.1; this.render(); }
    }

    private addIngredient(ingredient: Ingredient, button: number) {
        const index = this.game.selected, cup = this.game.cups[index], before = cup.ingredients.length;
        this.game.add(ingredient);
        if (cup.ingredients.length > before) {
            const targetX = this.cups[index].node.position.x - 110;
            const startX = -500 + button * 188;
            for (let i = 0; i < 5; i++) {
                const node = this.nodeAt(this.fx, 'IngredientDrop', startX, -220, 16, 16), g = node.addComponent(Graphics);
                g.fillColor = new Color(['#A9642F', '#FFF5DC', '#51362C', '#FFE7A5'][button]);
                if (button === 3) g.rect(-6, -6, 12, 12); else g.circle(0, 0, button === 2 ? 7 : 5);
                g.fill();
                this.effect(node, 0.38 + i * 0.04, t => node.setPosition(startX + (targetX - startX) * t + Math.sin(i * 2) * 12 * t, -220 + 154 * t + Math.sin(t * Math.PI) * 100));
            }
            this.cups[index].pulse = 0.3;
        }
        this.render();
    }

    private deliver(slot: number) {
        if (!this.canAct()) return;
        const index = this.game.selected;
        const cup: Cup = { ...this.game.cups[index], ingredients: [...this.game.cups[index].ingredients] };
        const before = this.game.money;
        if (this.game.deliver(slot)) {
            const ui = this.customers[slot]; ui.goodbye = 0.85;
            const startX = this.cups[index].node.position.x - 110, endX = ui.node.position.x - 115;
            const node = this.nodeAt(this.fx, 'DeliveryCup', startX, -66, 110, 130);
            this.drawCup(node.addComponent(Graphics), cup, 76, 0);
            this.effect(node, 0.5, t => {
                const ease = 1 - Math.pow(1 - t, 3);
                node.setPosition(startX + (endX - startX) * ease, -66 + 220 * ease + Math.sin(t * Math.PI) * 45);
                node.setScale(1 - t * 0.45, 1 - t * 0.45, 1);
            });
            this.floatText(`+¥${this.game.money - before}${this.game.combo > 1 ? `  连击 ×${this.game.combo}` : ''}`, ui.node.position.x, 185, C.green);
        } else {
            const node = this.customers[slot].portrait;
            this.effect(this.nodeAt(this.fx, 'ShakeTimer', 0, 0, 1, 1), 0.3, t => { node.angle = Math.sin(t * Math.PI * 6) * 6 * (1 - t); });
        }
        this.render();
    }

    private effect(node: Node, duration: number, step: (t: number) => void) { this.effects.push({ node, age: 0, duration, step }); }
    private floatText(value: string, x: number, y: number, color: string) {
        const label = this.text(this.fx, value, x, y, 380, 50, 28, color);
        this.effect(label.node, 0.9, t => { label.node.setPosition(x, y + t * 55); label.color = new Color(color); label.color = new Color(label.color.r, label.color.g, label.color.b, Math.round(255 * Math.min(1, (1 - t) * 3))); });
    }

    private drawCup(g: Graphics, cup: Cup, fill: number, time: number) {
        g.clear(); g.fillColor = new Color('#E5CEAA'); g.ellipse(0, -53, 45, 8); g.fill();
        g.fillColor = new Color('#FFFCF2'); g.roundRect(-37, -48, 74, 103, 12); g.fill();
        if (fill > 0.2) {
            g.fillColor = new Color(cup.ingredients.indexOf('milk') >= 0 ? '#CFA273' : '#A96C38');
            g.roundRect(-31, -42, 62, Math.max(2, fill), 5); g.fill();
        }
        if (cup.ingredients.indexOf('pearl') >= 0) {
            g.fillColor = new Color('#574033');
            for (let p = 0; p < 8; p++) { g.circle(-22 + p % 4 * 14, -33 + Math.floor(p / 4) * 13, 6); g.fill(); }
        }
        if (cup.ingredients.indexOf('jelly') >= 0) {
            g.fillColor = new Color('#FFF1CD');
            for (let p = 0; p < 5; p++) { g.roundRect(-24 + p * 10, -7 + p % 2 * 10, 8, 12, 2); g.fill(); }
        }
        g.strokeColor = new Color('#77513B'); g.lineWidth = 3;
        g.roundRect(-37, -48, 74, 103, 12); g.stroke();
        g.strokeColor = new Color('#FFFFFFAA'); g.lineWidth = 4; g.moveTo(-25, 2); g.lineTo(-25, 37); g.stroke();
        g.fillColor = new Color('#F7EDD9'); g.circle(0, 11, 15); g.fill();
        g.fillColor = new Color(C.green); g.ellipse(-3, 13, 5, 8); g.fill();
        if (cup.state === 'sealing' || cup.state === 'ready') {
            const y = cup.state === 'ready' ? 50 : 55 + Math.abs(Math.sin(time * 7)) * 13;
            g.fillColor = new Color(cup.state === 'ready' ? C.green : C.gold);
            g.roundRect(-42, y, 84, 10, 4); g.fill();
            g.strokeColor = new Color('#77513B'); g.lineWidth = 2; g.roundRect(-42, y, 84, 10, 4); g.stroke();
        }
    }

    private nodeAt(parent: Node, name: string, x: number, y: number, w: number, h: number) {
        const node = new Node(name); node.layer = Layers.Enum.UI_2D; parent.addChild(node);
        node.addComponent(UITransform).setContentSize(w, h); node.setPosition(x, y); return node;
    }
    private panel(node: Node, w: number, h: number, color: string, radius = 18, selected = false) {
        const g = node.getComponent(Graphics) || node.addComponent(Graphics); g.clear();
        g.fillColor = new Color('#513B3025'); g.roundRect(-w / 2 + 2, -h / 2 - 4, w, h, radius); g.fill();
        g.fillColor = new Color(color); g.roundRect(-w / 2, -h / 2, w, h, radius); g.fill();
        g.strokeColor = new Color(selected ? C.green : '#AB89604F'); g.lineWidth = selected ? 4 : 2;
        g.roundRect(-w / 2 + 2, -h / 2 + 2, w - 4, h - 4, radius); g.stroke(); return g;
    }
    private text(parent: Node, value: string, x: number, y: number, w: number, h: number, size: number, color: string) {
        const label = this.nodeAt(parent, 'Text', x, y, w, h).addComponent(Label);
        label.string = value; label.fontSize = size; label.lineHeight = size + 7; label.color = new Color(color);
        label.horizontalAlign = Label.HorizontalAlign.CENTER; label.verticalAlign = Label.VerticalAlign.CENTER;
        label.overflow = Label.Overflow.SHRINK; label.enableWrapText = true; return label;
    }
    private button(parent: Node, value: string, x: number, y: number, w: number, h: number, color: string, action: () => void, modal = false) {
        const node = this.nodeAt(parent, 'Button', x, y, w, h); this.panel(node, w, h, color);
        this.text(node, value, 0, 0, w - 16, h - 10, 27, '#FFF8E8');
        node.on(Node.EventType.TOUCH_START, () => { if (modal || this.canAct()) node.setScale(0.96, 0.96, 1); }, this);
        node.on(Node.EventType.TOUCH_CANCEL, () => node.setScale(1, 1, 1), this);
        node.on(Node.EventType.TOUCH_END, () => { node.setScale(1, 1, 1); if (modal || this.canAct()) action(); }, this);
        return node;
    }
    private progress(g: Graphics, ratio: number, color: string, width: number) {
        g.clear(); g.fillColor = new Color('#E1D2B8'); g.roundRect(-width / 2, -4, width, 8, 4); g.fill();
        if (ratio > 0) { g.fillColor = new Color(color); g.roundRect(-width / 2, -4, Math.max(8, width * Math.min(1, ratio)), 8, 4); g.fill(); }
    }

    private render() {
        if (!this.root) return;
        const game = this.game;
        this.hud.string = `${Math.ceil(game.time)} 秒    ¥${game.money} / ${game.target}    连击 ×${game.combo}`;
        this.hud.color = new Color(game.time <= 15 ? C.red : C.ink);
        this.toast.string = this.loading ? '正在布置奶茶铺…' : game.message;
        this.customers.forEach((ui, index) => {
            const customer = game.customers[index];
            if (!customer) {
                ui.portrait.active = ui.goodbye > 0;
                if (ui.goodbye > 0) ui.sprite.color = new Color('#FFFFFF');
                ui.title.string = ui.goodbye > 0 ? '谢谢，好喝！' : '等候下一位';
                ui.detail.string = ui.goodbye > 0 ? '下次还来 ♡' : '可以提前备茶';
                ui.mood.string = ui.goodbye > 0 ? '满意离店' : '空位'; ui.mood.color = new Color(C.green);
                this.progress(ui.bar, 0, C.green, 340); ui.id = -1; return;
            }
            if (ui.id !== customer.id) { ui.id = customer.id; ui.arrival = 0.4; ui.goodbye = 0; }
            ui.portrait.active = true;
            if (this.portraits.length) ui.sprite.spriteFrame = this.portraits[(customer.id - 1) % 4];
            const recipe = RECIPES[customer.recipe], urgent = customer.patience < 10;
            ui.title.string = `${NAMES[(customer.id - 1) % 4]} · ¥${recipe.price}`;
            ui.detail.string = `${recipe.name}\n${recipe.ingredients.map(i => INGREDIENT_NAMES[i]).join(' + ')}`;
            ui.mood.string = urgent ? `快一点呀！ ${Math.ceil(customer.patience)}s` : `点击交付 · ${Math.ceil(customer.patience)}s`;
            ui.mood.color = new Color(urgent ? C.red : C.green);
            ui.sprite.color = new Color(urgent ? '#FFE2CE' : '#FFFFFF');
            this.progress(ui.bar, customer.patience / customer.maxPatience, urgent ? C.red : C.green, 340);
        });
        this.cups.forEach((ui, index) => {
            const cup = game.cups[index], selected = index === game.selected;
            this.panel(ui.node, 380, 200, selected ? C.mint : C.cream, 18, selected);
            ui.title.string = `${selected ? '●' : '○'} ${index + 1} 号杯 · ${selected ? '当前制作' : '点击切换'}`;
            ui.detail.string = cup.ingredients.length ? cup.ingredients.map(i => INGREDIENT_NAMES[i]).join(' + ') : '空杯\n先加入红茶';
            ui.status.string = cup.state === 'empty' ? '等待制作' : cup.state === 'making' ? '配好后点击封杯' : cup.state === 'sealing' ? `封杯中 ${cup.remaining.toFixed(1)}s` : '✓ 成品可交付';
            this.progress(ui.bar, cup.state === 'ready' ? 1 : cup.state === 'sealing' ? 1 - cup.remaining / 2.5 : 0, C.green, 335);
        });
        this.renderOverlay();
    }
    private renderOverlay() {
        const kind = this.game.ended ? 'end' : this.game.paused ? 'pause' : '';
        if (kind === this.overlayKind) return;
        this.overlayKind = kind;
        if (this.overlay) { this.overlay.destroy(); this.overlay = null; }
        if (!kind) return;
        this.overlay = this.nodeAt(this.root, 'Overlay', 0, 0, 1280, 720);
        this.panel(this.overlay, 1280, 720, '#49372EDB', 0); this.overlay.addComponent(BlockInputEvents);
        const panel = this.nodeAt(this.overlay, 'Summary', 0, 0, 640, 430); this.panel(panel, 640, 430, C.cream, 24);
        const ended = kind === 'end';
        this.text(panel, ended ? (this.game.money >= this.game.target ? '今日目标达成！' : '打烊啦，再接再厉') : '休息一下', 0, 134, 580, 60, 36, C.green);
        this.text(panel, ended ? `营业额 ¥${this.game.money} / ¥${this.game.target}\n完成 ${this.game.served} 单 · 流失 ${this.game.lost} 位\n最高连击 ${this.game.bestCombo}` : '计时与动画已暂停\n准备好了就继续营业吧。', 0, 20, 560, 150, 26, C.ink);
        this.button(panel, ended ? '再开一局' : '继续营业', 0, -135, 280, 76, C.green, () => {
            if (ended) {
                this.effects.forEach(effect => effect.node.destroy()); this.effects = [];
                this.game = new TeaGame(); this.clock = 0;
                this.cups.forEach(ui => { ui.fill = 0; ui.lastState = 'empty'; });
                this.customers.forEach(ui => { ui.id = -1; ui.goodbye = 0; ui.portrait.angle = 0; });
            } else this.game.paused = false;
            this.render();
        }, true);
    }
    onDestroy() {
        engineGame.off(Game.EVENT_HIDE, this.onHide, this);
        if (this.root) this.root.destroy();
        this.frames.forEach(frame => frame.destroy()); this.textures.forEach(texture => texture.destroy());
    }
}
