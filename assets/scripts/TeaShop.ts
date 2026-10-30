import { _decorator, Component, Node, UITransform, Graphics, Color, Label, Layers, view, ResolutionPolicy, BlockInputEvents, Sprite, SpriteFrame, Texture2D, ImageAsset, resources, Rect, Size, game as engineGame, Game, EventTouch, Vec3, UIOpacity, screen as engineScreen } from 'cc';
import { findDropTarget, findSnapTarget, dropZones, DropTarget } from './TeaDropTargets';
import { TeaGame, RECIPES, INGREDIENT_NAMES, Ingredient, Cup, CUP_SUPPLIES } from './TeaGame';

const { ccclass } = _decorator;
const C = { ink: '#513B30', muted: '#8C7560', cream: '#FFF8E8', green: '#527B62', mint: '#E6EDDA', red: '#BD6652', gold: '#D49A4C' };
const ITEMS: Ingredient[] = ['tea', 'milk', 'pearl', 'jelly'];
const NAMES = ['小橘', '阿青', '林奶奶', '小陆'];
interface DrinkVisual { node: Node; body: Sprite; toppings: Graphics; lid: Sprite }
interface CustomerUI { opacity: UIOpacity; happy: boolean; bubble: Node; orderArt: DrinkVisual; node: Node; portrait: Node; sprite: Sprite; title: Label; detail: Label; mood: Label; bar: Graphics; id: number; arrival: number; goodbye: number }
interface CupUI { supplyX: number; node: Node; art: DrinkVisual; title: Label; detail: Label; status: Label; bar: Graphics; fill: number; pulse: number; lastState: string }
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
    private cupFrames: SpriteFrame[] = [];
    private jellyCupFrames: SpriteFrame[] = [];
    private lidFrame: SpriteFrame | null = null;
    private supplies: { sprite: Sprite; label: Label }[] = [];
    private overlay: Node | null = null;
    private overlayKind = '';
    private loading = true;
    private clock = 0;
    private refreshIn = 0;
    private machine!: Sprite;
    private trash!: Sprite;
    private machineLabel!: Label;
    private deviceFrames: SpriteFrame[] = [];
    private dropHint!: Graphics;
    private grips: { node: Node; x: number; y: number; w: number; h: number }[] = [];
    private activeGrip: { node: Node; x: number; y: number; w: number; h: number } | null = null;
    private drag: { id: number; offset: Vec3; start: Vec3; target: Vec3; moved: number } | null = null;
    private grip = 0;
    private hoverKey = '';
    private portrait = false;
    private rotateHint: Node | null = null;
    private orientIn = 0;
    private returnFrom = new Vec3();
    private returnScale = 1;
    private returnT = -1;
    private returnDuration = 0;
    private readonly dragLift = 26;
    private readonly snapRadius = 52;
    private inMachine = false;
    private readonly machinePos = new Vec3(125, -116, 0);
    private readonly ingredientX = [-512, -330, 350, 520];
    private readonly probe = new Vec3();

    start() {
        view.setDesignResolutionSize(1280, 720, ResolutionPolicy.SHOW_ALL);
        this.root = this.nodeAt(this.node, 'TeaShopUI', 0, 0, 1280, 720);
        this.panel(this.root, 1280, 720, '#DEC39A', 0);
        const background = this.nodeAt(this.root, 'ShopBackground', 0, 0, 1280, 720).addComponent(Sprite);
        background.sizeMode = Sprite.SizeMode.CUSTOM;
        this.panel(this.nodeAt(this.root, 'Header', 0, 304, 1192, 74), 1192, 74, '#FFF8E8F5');
        this.text(this.root, '巷口奶茶铺', -432, 307, 280, 44, 31, C.ink);
        this.hud = this.text(this.root, '', 80, 307, 660, 44, 25, C.ink);
        this.button(this.root, '暂停', 530, 304, 112, 68, C.green, () => { this.cancelDrag(); this.game.paused = true; this.render(); });

        // Customers are drawn first; the counter in front occludes their lower bodies.
        for (let i = 0; i < 3; i++) {
            const node = this.nodeAt(this.root, `Customer${i}`, -390 + i * 390, 130, 350, 260);
            const portrait = this.nodeAt(node, 'Portrait', 0, -58, 170, 170);
            const sprite = portrait.addComponent(Sprite); sprite.sizeMode = Sprite.SizeMode.CUSTOM;
            const bubble = this.nodeAt(node, 'OrderBubble', 0, 82, 330, 112);
            const g = this.panel(bubble, 330, 112, C.cream, 22);
            g.fillColor = new Color(C.cream); g.moveTo(-18, -54); g.lineTo(0, -72); g.lineTo(18, -54); g.close(); g.fill();
            const orderArt = this.createDrink(bubble, 'RequestedDrink', -116, 2);
            orderArt.node.setScale(0.55, 0.55, 1);
            const ui: CustomerUI = { node, portrait, sprite, bubble, orderArt, opacity: node.addComponent(UIOpacity), happy: false, id: -1, arrival: 0, goodbye: 0,
                title: this.text(bubble, '', 22, 32, 255, 30, 22, C.ink),
                detail: this.text(bubble, '', 35, 0, 240, 42, 19, C.ink),
                mood: this.text(bubble, '', 18, -35, 280, 28, 19, C.green),
                bar: this.nodeAt(bubble, 'Patience', 0, -51, 280, 6).addComponent(Graphics) };
            this.customers.push(ui);
        }
        // Exact wood pixels extracted from the existing shop background, no procedural table.
        const counter = this.spriteAt(this.root, 'CounterCutout', 0, -81, 1280, 252);
        const shelf = this.spriteAt(this.root, 'CupShelf', 0, -256, 1280, 148);
        this.trash = this.spriteAt(this.root, 'TrashBin', -420, -249, 145, 145);
        this.text(this.root, '拖入垃圾桶\n丢弃整杯', -550, -258, 135, 66, 20, C.cream);
        CUP_SUPPLIES.forEach(supply => {
            const stack = this.hitArea(this.root, 'CupSupply-' + supply.size, supply.shelfX, -254, 220, 102, () => {
                const slot = this.game.takeFromSupply(supply.size);
                if (slot >= 0) this.cups[slot].supplyX = supply.shelfX;
                this.render();
            });
            const sprite = this.spriteAt(stack, 'StackArt', -40, 3, 102, 102);
            const label = this.text(stack, '', 58, 0, 125, 70, 21, C.cream);
            this.supplies.push({ sprite, label });
        });
        for (let i = 0; i < this.game.cups.length; i++) {
            const x = -115;
            const node = this.nodeAt(this.root, `Station${i}`, x, -88, 208, 214);
            const ui: CupUI = { node, supplyX: 0, fill: 0, pulse: 0, lastState: 'stored',
                art: this.createDrink(node, 'Cup', 0, 0),
                title: this.text(node, '', 0, 88, 200, 30, 21, C.ink),
                detail: this.text(node, '', 0, -66, 200, 27, 17, C.ink),
                status: this.text(node, '', 0, -90, 200, 28, 19, C.green),
                bar: this.nodeAt(node, 'SealProgress', 0, -105, 180, 6).addComponent(Graphics) };
            this.cups.push(ui);
        }
        ITEMS.forEach((ingredient, index) => {
            const x = this.ingredientX[index];
            const node = this.hitArea(this.root, ingredient + '-Tray', x, -42, 174, 162, () => this.addIngredient(ingredient, index));
            const icon = this.nodeAt(node, ingredient, 0, 10, 156, 142).addComponent(Sprite); icon.sizeMode = Sprite.SizeMode.CUSTOM;
            this.ingredientArt.push(icon);
            this.panel(this.nodeAt(node, 'NameTag', 0, -63, 120, 32), 120, 32, '#FFF8E8DC', 8);
            this.text(node, INGREDIENT_NAMES[ingredient], 0, -63, 145, 32, 24, C.ink);
        });
        this.machine = this.spriteAt(this.root, 'SealingMachine', 125, -70, 210, 210);
        this.machineLabel = this.text(this.root, '拖入封盖 · 1秒', 125, -188, 235, 30, 22, C.green);
        this.text(this.root, '拖到机器封盖 → 拖给客人\n不要的杯子拖进垃圾桶', 438, -255, 320, 70, 21, C.cream);
        this.panel(this.nodeAt(this.root, 'ToastPanel', 0, -324, 1192, 44), 1192, 44, '#FFF8E8EF', 12);
        this.toast = this.text(this.root, '正在布置奶茶铺…', 0, -324, 1160, 40, 22, C.ink);
        this.fx = this.nodeAt(this.root, 'Effects', 0, 0, 1280, 720);
        this.dropHint = this.nodeAt(this.fx, 'DropHint', 0, 0, 1280, 720).addComponent(Graphics);
        this.cups.forEach(ui => { ui.art.node.setParent(this.fx); });
        // Two fixed grab pads, sized for a thumb rather than for the 140px glass.
        // They never move and never resize, so a press always lands on the same node;
        // only the game state decides whether a press actually lifts the cup.
        this.grips = [
            this.grabPad('StationGrab', -115, -96, 250, 200),
            this.grabPad('MachineGrab', 125, -100, 200, 190),
        ];
        engineGame.on(Game.EVENT_HIDE, this.onHide, this);
        this.watchOrientation();
        this.render();
        Promise.all([
            this.loadArt('machine-bin', texture => { this.deviceFrames = [0, 1, 2, 3].map(i => this.frame(texture, i)); this.machine.spriteFrame = this.deviceFrames[0]; this.trash.spriteFrame = this.deviceFrames[2]; }),
            this.loadArt('shop', texture => {
                background.spriteFrame = this.frame(texture);
                counter.spriteFrame = this.region(texture, new Rect(0, 610, texture.width, 260));
            }),
            this.loadArt('cup-shelf', texture => { shelf.spriteFrame = this.frame(texture); }),
            this.loadArt('cup-jelly-states', texture => { this.jellyCupFrames = [0, 1, 2, 3].map(i => this.frame(texture, i)); }),
            this.loadArt('cup-states', texture => { this.cupFrames = [0, 1, 2, 3].map(i => this.frame(texture, i)); }),
            this.loadArt('service-props', texture => {
                this.supplies.forEach(supply => { supply.sprite.spriteFrame = this.frame(texture, 0); });
                this.lidFrame = this.frame(texture, 1);
                this.ingredientArt[2].spriteFrame = this.frame(texture, 2);
                this.ingredientArt[3].spriteFrame = this.frame(texture, 3);
            }),
            this.loadArt('customers', texture => {
                this.portraits = [0, 1, 2, 3].map(i => this.frame(texture, i));
            }),
            this.loadArt('ingredients', texture => this.ingredientArt.slice(0, 2).forEach((sprite, i) => { sprite.spriteFrame = this.frame(texture, i); })),
        ]).then(() => {
            if (!this.isValid) return;
            this.loading = false; this.render();
        });
    }

    private canAct() { return !this.loading && !this.portrait && this.game.active; }
    private onHide() { this.cancelDrag(); if (!this.game.ended) { this.game.paused = true; this.render(); } }

    // A browser page cannot force its own orientation, so landscape is requested in two
    // steps: block play while the viewport is portrait, and offer a tap that goes
    // fullscreen and calls screen.orientation.lock where the browser supports it.
    private watchOrientation() {
        this.orientIn = 0; this.checkOrientation();
        if (typeof window === 'undefined' || !window.addEventListener) return;
        window.addEventListener('resize', this.onViewportChange);
        window.addEventListener('orientationchange', this.onViewportChange);
    }
    private readonly onViewportChange = () => {
        this.checkOrientation();
        // Some browsers report the canvas size a frame or two after the rotate event.
        setTimeout(() => { if (this.isValid) this.checkOrientation(); }, 180);
    };
    private checkOrientation() {
        const size = this.viewportSize();
        if (size.width < 16 || size.height < 16) return;
        const portrait = size.height > size.width * 1.02;
        if (portrait === this.portrait) return;
        this.portrait = portrait;
        if (portrait) { this.cancelDrag(); this.showRotateHint(); }
        else { this.hideRotateHint(); this.render(); }
    }
    /** CSS viewport on web (what the player actually holds), engine screen size on native. */
    private viewportSize() {
        if (typeof window !== 'undefined' && window.innerWidth > 0) return { width: window.innerWidth, height: window.innerHeight };
        const size = engineScreen.windowSize;
        return { width: size.width, height: size.height };
    }
    private showRotateHint() {
        if (this.rotateHint || !this.root) return;
        const node = this.nodeAt(this.root, 'RotateHint', 0, 0, 1280, 720);
        this.panel(node, 1280, 720, '#2A211DF0', 0);
        node.addComponent(BlockInputEvents);
        const card = this.nodeAt(node, 'Card', 0, 0, 620, 380);
        this.panel(card, 620, 380, C.cream, 26);
        const phone = this.nodeAt(card, 'Phone', 0, 106, 170, 100).addComponent(Graphics);
        phone.lineWidth = 8; phone.strokeColor = new Color(C.green);
        phone.roundRect(-66, -36, 132, 72, 16); phone.stroke();
        phone.lineWidth = 3; phone.strokeColor = new Color('#527B6299');
        phone.roundRect(-50, -22, 100, 44, 7); phone.stroke();
        this.text(card, '请把手机横过来', 0, 22, 540, 46, 33, C.ink);
        this.text(card, '横屏才摆得下制作台、材料罐和客人。\n转回横屏自动继续，营业时间不会趁这段时间溜走。', 0, -46, 550, 80, 20, C.muted);
        // iOS Safari has no orientation lock at all, so do not offer a dead button there.
        if (this.canLockOrientation()) this.button(card, '全屏并锁定横屏', 0, -134, 330, 74, C.green, () => this.requestLandscape(), true);
        else this.text(card, '这个浏览器不支持网页锁定方向\n请手动把手机转成横向', 0, -134, 530, 74, 19, C.muted);
        this.rotateHint = node;
    }
    private canLockOrientation() {
        if (typeof window === 'undefined' || !window.screen) return false;
        const orientation: any = (window.screen as any).orientation;
        return !!orientation && typeof orientation.lock === 'function';
    }
    private hideRotateHint() {
        if (!this.rotateHint) return;
        this.rotateHint.destroy(); this.rotateHint = null;
    }
    private requestLandscape() {
        if (typeof document === 'undefined') return;
        const lock = () => {
            const orientation: any = typeof window !== 'undefined' && window.screen ? (window.screen as any).orientation : null;
            if (!orientation || typeof orientation.lock !== 'function') return;
            try {
                const attempt = orientation.lock('landscape');
                if (attempt && typeof attempt.catch === 'function') attempt.catch(() => {});
            } catch (error) { console.warn('[TeaShop] 无法锁定横屏', error); }
        };
        const element: any = document.documentElement;
        if (!element || !element.requestFullscreen) { lock(); return; }
        try {
            const attempt = element.requestFullscreen();
            if (attempt && typeof attempt.then === 'function') attempt.then(lock, lock);
            else lock();
        } catch (error) { console.warn('[TeaShop] 无法进入全屏', error); }
    }
    private loadArt(name: string, apply: (texture: Texture2D) => void): Promise<void> {
        return new Promise(resolve => resources.load(`art/${name}`, ImageAsset, (error, image) => {
            if (this.isValid && !error) {
                const texture = new Texture2D(); texture.image = image;
                this.textures.push(texture); apply(texture);
            } else if (error) console.warn(`[TeaShop] 美术资源加载失败: ${name}`, error);
            resolve();
        }));
    }
    private region(texture: Texture2D, rect: Rect) {
        const frame = new SpriteFrame(); frame.texture = texture;
        frame.rect = rect; frame.originalSize = new Size(rect.width, rect.height);
        this.frames.push(frame); return frame;
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
        if (!this.root) return;
        this.orientIn -= dt;
        if (this.orientIn <= 0) { this.orientIn = 0.4; this.checkOrientation(); }
        if (this.loading || this.portrait) return;
        this.game.tick(dt);
        if (this.customers.some((ui, i) => (this.game.customers[i]?.id ?? -1) !== ui.id)) this.render();
        if (this.game.ended) this.cancelDrag();
        if (this.game.active) {
            this.clock += dt;
            for (let index = 0; index < this.customers.length; index++) {
                const ui = this.customers[index];
                ui.arrival = Math.max(0, ui.arrival - dt);
                ui.goodbye = Math.max(0, ui.goodbye - dt);
                const entry = ui.arrival / 0.6;
                const departure = ui.goodbye > 0 ? Math.max(0, (1 - ui.goodbye / this.game.departureDuration - 0.25) / 0.75) : 0;
                const baseX = -390 + index * 390;
                ui.node.setPosition(baseX - 110 * entry * entry * entry + 150 * departure * departure, 130);
                ui.opacity.opacity = Math.round(255 * (1 - entry) * (1 - departure));
                ui.portrait.setScale(1, 1, 1);
                const customer = this.game.customers[index];
                const urgent = customer && customer.patience < 10;
                const walking = ui.arrival > 0 || ui.goodbye > 0;
                ui.portrait.setPosition((urgent ? Math.sin(this.clock * 9) * 2 : 0), -58 + Math.sin(this.clock * (walking ? 17 : 2.6) + index) * (walking ? 4 : 2));
                if (!customer && ui.goodbye === 0) ui.node.active = false;
            }
            this.cups.forEach((ui, index) => {
                const cup = this.game.cups[index];
                const target = cup.ingredients.length ? (cup.ingredients.indexOf('milk') >= 0 ? 76 : 40) : 0;
                ui.fill += (target - ui.fill) * Math.min(1, dt * 9);
                ui.pulse = Math.max(0, ui.pulse - dt);
                if (cup.state === 'stored' || cup.state === 'placing') this.inMachine = false;
                if (this.drag) this.updateDrag(dt);
                else if (this.returnT >= 0) this.stepReturn(dt);
                else {
                    this.restoreCupPosition();
                    const scale = this.inMachine ? 0.62 : 1;
                    ui.art.node.setScale(scale * (1 + Math.sin(ui.pulse / 0.3 * Math.PI) * 0.08), scale, 1);
                }
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
        if (this.drag) return;
        const index = this.game.selected, cup = this.game.cups[index], before = cup.ingredients.length;
        this.game.add(ingredient);
        if (cup.ingredients.length > before) {
            const targetX = this.cups[index].node.position.x;
            const startX = this.ingredientX[button];
            for (let i = 0; i < 5; i++) {
                const node = this.nodeAt(this.fx, 'IngredientDrop', startX, -27, 16, 16), g = node.addComponent(Graphics);
                g.fillColor = new Color(['#A9642F', '#FFF5DC', '#51362C', '#FFE7A5'][button]);
                if (button === 3) g.rect(-6, -6, 12, 12); else g.circle(0, 0, button === 2 ? 7 : 5);
                g.fill();
                this.effect(node, 0.38 + i * 0.04, t => node.setPosition(startX + (targetX - startX) * t + Math.sin(i * 2) * 12 * t, -27 - 61 * t + Math.sin(t * Math.PI) * 115));
            }
            this.cups[index].pulse = 0.3;
        }
        this.render();
    }

    private deliver(slot: number, start: Vec3) {
        if (!this.canAct()) return;
        const customer = this.game.customers[slot];
        if (!customer) return;
        const index = this.game.selected;
        const cup: Cup = { ...this.game.cups[index], ingredients: [...this.game.cups[index].ingredients] };
        const before = this.game.money;
        if (this.game.deliver(slot)) {
            const ui = this.customers[slot]; ui.goodbye = this.game.departureDuration; ui.happy = true; ui.arrival = 0;
            const startX = start.x, startY = start.y, endX = -390 + slot * 390;
            this.inMachine = false;
            const drink = this.createDrink(this.fx, 'DeliveryCup', startX, startY);
            const node = drink.node;
            this.drawCup(drink, cup, 76, 0);
            this.effect(node, 0.5, t => {
                const ease = 1 - Math.pow(1 - t, 3);
                node.setPosition(startX + (endX - startX) * ease, startY + (97 - startY) * ease + Math.sin(t * Math.PI) * 25);
                node.setScale(1 - t * 0.45, 1 - t * 0.45, 1);
            });
            this.floatText(`+¥${this.game.money - before}${this.game.combo > 1 ? `  连击 ×${this.game.combo}` : ''}`, ui.node.position.x, 185, C.green);
        } else {
            const node = this.customers[slot].portrait;
            this.effect(this.nodeAt(this.fx, 'ShakeTimer', 0, 0, 1, 1), 0.3, t => { node.angle = Math.sin(t * Math.PI * 6) * 6 * (1 - t); });
        }
        this.render();
    }

    private touchPoint(event: EventTouch): Vec3 {
        const p = event.getUILocation();
        return this.root.getComponent(UITransform)!.convertToNodeSpaceAR(new Vec3(p.x, p.y, 0));
    }
    private beginDrag(event: EventTouch, grip: { node: Node; x: number; y: number; w: number; h: number }) {
        if (!this.canAct() || this.drag) return;
        const cup = this.game.cups[0];
        if (cup.state === 'stored' || cup.state === 'sealing' || (cup.state === 'placing' && !this.game.settlePlacement(0))) return;
        const art = this.cups[0].art.node;
        const point = this.touchPoint(event);
        // Pads overlap each other's area, so only a press near the glass lifts it.
        const half = 70 * art.scale.x, reach = 60;
        const dx = Math.max(Math.abs(point.x - art.position.x) - half, 0), dy = Math.max(Math.abs(point.y - art.position.y) - half, 0);
        if (Math.sqrt(dx * dx + dy * dy) > reach) return;
        // Offset is kept in world units so the glass stays exactly under the finger.
        const offset = art.position.clone().subtract(point);
        this.drag = { id: event.getID(), offset, start: art.position.clone(), target: art.position.clone(), moved: 0 };
        this.grip = 0;
        this.returnT = -1;
        this.hoverKey = '';
        art.setSiblingIndex(this.fx.children.length - 1);
        // One owner for the whole gesture: the pressed pad covers the playfield until
        // release, so a finger leaving the pad never breaks the drag.
        this.activeGrip = grip;
        grip.node.getComponent(UITransform)!.setContentSize(1280, 720);
        grip.node.setPosition(0, 0);
        grip.node.setSiblingIndex(this.fx.children.length - 1);
        this.paintDropZones(null);
        event.propagationStopped = true;
    }
    private moveDrag(event: EventTouch) {
        event.propagationStopped = true;
        if (!this.drag || event.getID() !== this.drag.id) return;
        if (!this.canAct()) { this.cancelDrag(); return; }
        const p = this.touchPoint(event).add(this.drag.offset);
        this.drag.moved = Math.max(this.drag.moved, Vec3.distance(p, this.drag.start));
        this.drag.target.set(p.x, p.y, 0);
    }
    /** Finger target plus a small lift, eased in so the glass never jumps on grab. */
    private updateDrag(dt: number) {
        const drag = this.drag; if (!drag) return;
        this.grip = Math.min(1, this.grip + dt * 13);
        const ease = this.grip * (2 - this.grip), lift = this.dragLift * ease, scale = (this.inMachine ? 0.62 : 1) + (1.08 - (this.inMachine ? 0.62 : 1)) * ease;
        const art = this.cups[0].art.node;
        art.setPosition(drag.target.x, drag.target.y + lift, 0);
        art.setScale(scale, scale, 1);
        this.probe.set(drag.target.x, drag.target.y + lift, 0);
        const target = this.pickTarget(this.probe);
        const key = target ? target.kind + target.slot : '';
        if (key === this.hoverKey) return;
        this.hoverKey = key;
        this.paintDropZones(target);
    }
    private pickTarget(p: Vec3): DropTarget | null {
        const occupied = this.game.customers.map(customer => !!customer);
        return findDropTarget(p.x, p.y, occupied) || findSnapTarget(p.x, p.y, occupied, this.snapRadius);
    }
    private endDrag(event: EventTouch) {
        event.propagationStopped = true;
        if (!this.drag || event.getID() !== this.drag.id) return;
        const tap = this.drag.moved < 8;
        const p = this.cups[0].art.node.position.clone();
        const target = tap ? null : this.pickTarget(p);
        this.drag = null; this.hoverKey = '';
        this.resetGrip();
        this.clearDropZones();
        if (this.canAct()) {
            if (target && target.kind === 'trash') {
                const cup: Cup = { ...this.game.cups[0], ingredients: [...this.game.cups[0].ingredients] };
                this.game.discard(); this.inMachine = false;
                const ghost = this.createDrink(this.fx, 'DiscardedCup', p.x, p.y);
                this.drawCup(ghost, cup, 0, 0);
                this.effect(ghost.node, 0.25, t => { ghost.node.setPosition(p.x + (-420 - p.x) * t, p.y + (-270 - p.y) * t); ghost.node.setScale(1 - t, 1 - t, 1); });
            } else if (target && target.kind === 'machine') {
                if (this.game.cups[0].state === 'ready') this.game.message = '这杯已经封好啦，拖给对应的客人。';
                else {
                    this.game.seal();
                    if (this.game.cups[0].state === 'sealing') this.inMachine = true;
                }
            } else if (target && target.kind === 'customer') {
                this.deliver(target.slot, p);
            } else if (!tap) this.game.message = '拖到封盖机、客人或桌下垃圾桶。';
        }
        this.returnCup(this.game.cups[0].state === 'stored' ? 0 : tap ? 0.08 : 0.16);
        this.render();
    }
    private cancelTouch(event: EventTouch) {
        event.propagationStopped = true;
        if (this.drag && event.getID() === this.drag.id) this.cancelDrag();
    }
    private cancelDrag() {
        if (!this.drag) return;
        this.drag = null; this.hoverKey = ''; this.returnT = -1;
        this.resetGrip();
        this.clearDropZones();
        this.restoreCupPosition();
    }
    private resetGrip() {
        const grip = this.activeGrip; if (!grip) return;
        this.activeGrip = null;
        grip.node.setPosition(grip.x, grip.y);
        grip.node.getComponent(UITransform)!.setContentSize(grip.w, grip.h);
    }
    /** Bounces the glass home instead of teleporting it, which read as "the drag was dropped". */
    private returnCup(duration: number) {
        const art = this.cups[0].art.node;
        if (duration <= 0) { this.returnT = -1; this.restoreCupPosition(); return; }
        this.returnFrom.set(art.position);
        this.returnScale = art.scale.x;
        this.returnT = 0; this.returnDuration = duration;
    }
    private stepReturn(dt: number) {
        const art = this.cups[0].art.node;
        this.returnT = Math.min(this.returnDuration, this.returnT + dt);
        const t = this.returnT / this.returnDuration, ease = 1 - Math.pow(1 - t, 3);
        const home = this.cupHome();
        art.setPosition(this.returnFrom.x + (home.x - this.returnFrom.x) * ease, this.returnFrom.y + (home.y - this.returnFrom.y) * ease, 0);
        const scale = this.returnScale + (home.scale - this.returnScale) * ease;
        art.setScale(scale, scale, 1);
        if (t >= 1) this.returnT = -1;
    }
    private cupHome() {
        const ui = this.cups[0];
        if (this.inMachine) return { x: this.machinePos.x, y: this.machinePos.y, scale: 0.62 };
        const cup = this.game.cups[0];
        const travel = cup.state === 'placing' ? Math.pow(cup.remaining / 0.45, 2) : 0;
        return { x: ui.node.position.x + (ui.supplyX - ui.node.position.x) * travel, y: -88 - 166 * travel, scale: 1 };
    }
    private restoreCupPosition() {
        const ui = this.cups[0]; if (!ui) return;
        const home = this.cupHome();
        ui.art.node.setPosition(home.x, home.y, 0);
        ui.art.node.setScale(home.scale, home.scale, 1);
    }
    private clearDropZones() {
        if (this.dropHint) this.dropHint.clear();
        if (this.deviceFrames.length) this.trash.spriteFrame = this.deviceFrames[2];
    }
    private paintDropZones(hover: DropTarget | null) {
        const g = this.dropHint; if (!g) return;
        g.clear();
        dropZones(this.game.customers.map(customer => !!customer)).forEach(zone => {
            const r = zone.rect, hit = !!hover && hover.kind === zone.kind && hover.slot === zone.slot;
            if (hit) {
                g.fillColor = new Color(zone.kind === 'trash' ? '#BD66522E' : '#527B622E');
                g.roundRect(r.x, r.y, r.width, r.height, 18); g.fill();
            }
            g.strokeColor = new Color(hit ? (zone.kind === 'trash' ? C.red : zone.kind === 'machine' ? C.gold : C.green) : '#513B3033');
            g.lineWidth = hit ? 4 : 2;
            g.roundRect(r.x, r.y, r.width, r.height, hit ? 18 : 14); g.stroke();
        });
        if (this.deviceFrames.length) this.trash.spriteFrame = this.deviceFrames[hover && hover.kind === 'trash' ? 3 : 2];
    }
    private grabPad(name: string, x: number, y: number, w: number, h: number) {
        const node = this.nodeAt(this.fx, name, x, y, w, h);
        const grip = { node, x, y, w, h };
        node.on(Node.EventType.TOUCH_START, (event: EventTouch) => this.beginDrag(event, grip), this);
        node.on(Node.EventType.TOUCH_MOVE, this.moveDrag, this);
        node.on(Node.EventType.TOUCH_END, this.endDrag, this);
        node.on(Node.EventType.TOUCH_CANCEL, this.cancelTouch, this);
        return grip;
    }
    private syncGrab() {
        // Deactivating the touch owner mid-gesture would swallow the release, so only
        // the game phase flips these pads, never the drag itself.
        if (this.drag) return;
        const live = this.canAct();
        this.grips.forEach(grip => { grip.node.active = live; });
    }

    private effect(node: Node, duration: number, step: (t: number) => void) { this.effects.push({ node, age: 0, duration, step }); }
    private floatText(value: string, x: number, y: number, color: string) {
        const label = this.text(this.fx, value, x, y, 380, 50, 28, color);
        this.effect(label.node, 0.9, t => { label.node.setPosition(x, y + t * 55); label.color = new Color(color); label.color = new Color(label.color.r, label.color.g, label.color.b, Math.round(255 * Math.min(1, (1 - t) * 3))); });
    }

    private spriteAt(parent: Node, name: string, x: number, y: number, w: number, h: number): Sprite {
        const sprite = this.nodeAt(parent, name, x, y, w, h).addComponent(Sprite);
        sprite.sizeMode = Sprite.SizeMode.CUSTOM; return sprite;
    }
    private createDrink(parent: Node, name: string, x: number, y: number): DrinkVisual {
        const node = this.nodeAt(parent, name, x, y, 140, 140);
        const body = this.spriteAt(node, 'CupSprite', 0, 0, 140, 140);
        const toppings = this.nodeAt(node, 'LooseToppings', 0, 0, 100, 120).addComponent(Graphics);
        const lid = this.spriteAt(node, 'SealSprite', 0, 48, 108, 90);
        return { node, body, toppings, lid };
    }
    private drawCup(art: DrinkVisual, cup: Cup, _fill: number, time: number) {
        const milk = cup.ingredients.indexOf('milk') >= 0;
        const pearl = cup.ingredients.indexOf('pearl') >= 0;
        const cell = milk ? (pearl ? 3 : 2) : cup.ingredients.length ? 1 : 0;
        const jelly = cup.ingredients.indexOf('jelly') >= 0;
        const frames = milk && jelly ? this.jellyCupFrames : this.cupFrames;
        if (frames.length) art.body.spriteFrame = frames[cell];
        // Finished drinks and lids use raster art; unusual tea-before-milk toppings use a temporary overlay.
        const g = art.toppings; g.clear();
        if (pearl && !milk) {
            g.fillColor = new Color('#574033');
            for (let p = 0; p < 8; p++) { g.circle(-23 + p % 4 * 14, -39 + Math.floor(p / 4) * 12, 5); g.fill(); }
        }
        if (jelly && !milk) {
            g.fillColor = new Color('#FFF1CDD9'); g.strokeColor = new Color('#D9B785'); g.lineWidth = 1;
            for (let p = 0; p < 5; p++) { g.roundRect(-25 + p * 10, -27 + p % 2 * 10, 9, 11, 2); g.fill(); g.stroke(); }
        }
        art.lid.node.active = cup.state === 'ready' || cup.state === 'sealing';
        art.lid.spriteFrame = this.lidFrame;
        art.lid.node.setPosition(0, 48 + (cup.state === 'sealing' ? Math.abs(Math.sin(time * 7)) * 13 : 0));
    }

    private hitArea(parent: Node, name: string, x: number, y: number, w: number, h: number, action: () => void) {
        const node = this.nodeAt(parent, name, x, y, w, h);
        node.on(Node.EventType.TOUCH_START, () => { if (this.canAct()) node.setScale(0.96, 0.96, 1); }, this);
        node.on(Node.EventType.TOUCH_CANCEL, () => node.setScale(1, 1, 1), this);
        node.on(Node.EventType.TOUCH_END, () => { node.setScale(1, 1, 1); if (this.canAct()) action(); }, this);
        return node;
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
            if (!customer && ui.id >= 0 && ui.goodbye <= 0) {
                ui.goodbye = game.departureDuration; ui.happy = false; ui.arrival = 0;
            }
            ui.node.active = !!customer || ui.goodbye > 0;
            if (!customer) {
                ui.portrait.active = ui.goodbye > 0; ui.bubble.active = ui.goodbye > 0;
                ui.sprite.color = new Color('#FFFFFF');
                ui.title.string = ui.happy ? '谢谢，好喝！' : '等太久啦…'; ui.detail.string = ui.happy ? '下次还来 ♡' : '下次再来吧'; ui.mood.string = ui.happy ? '满意离店' : '失望离店'; ui.mood.color = new Color(ui.happy ? C.green : C.red);
                ui.orderArt.node.active = false; ui.bar.node.active = false; ui.id = -1; return;
            }
            if (ui.id !== customer.id) {
                ui.id = customer.id; ui.arrival = 0.6; ui.goodbye = 0; ui.happy = false;
                ui.opacity.opacity = 0; ui.node.setPosition(-390 + index * 390 - 110, 130);
            }
            ui.portrait.active = true; ui.bubble.active = true;
            if (this.portraits.length) ui.sprite.spriteFrame = this.portraits[(customer.id - 1) % 4];
            // The order is readable the instant the customer walks in.
            const recipe = RECIPES[customer.recipe];
            const urgent = customer.patience < 10;
            ui.orderArt.node.active = true; ui.bar.node.active = true;
            this.drawCup(ui.orderArt, { ingredients: recipe.ingredients, state: 'ready', remaining: 0 }, 76, 0);
            ui.title.string = `${recipe.name} · ¥${recipe.price}`;
            ui.detail.string = recipe.ingredients.map(i => INGREDIENT_NAMES[i]).join(' + ');
            ui.mood.string = `${NAMES[(customer.id - 1) % 4]} · 拖杯交付 ${Math.ceil(customer.patience)}s`;
            ui.mood.color = new Color(urgent ? C.red : C.green);
            ui.sprite.color = new Color(urgent ? '#FFE2CE' : '#FFFFFF');
            this.progress(ui.bar, customer.patience / customer.maxPatience, urgent ? C.red : C.green, 280);
        });
        this.cups.forEach((ui, index) => {
            const cup = game.cups[index], selected = index === game.selected;
            const stored = cup.state === 'stored';

            ui.art.node.active = !stored;
            ui.title.string = '制作区';
            ui.title.color = new Color(selected ? C.green : C.ink);
            ui.detail.string = stored ? '从桌下取一只杯子' : cup.state === 'placing' ? '正在放上桌…' : cup.ingredients.map(i => INGREDIENT_NAMES[i]).join(' + ');
            ui.status.string = stored ? '等待取杯' : cup.state === 'placing' ? '' : cup.state === 'empty' ? '点击材料加料' : cup.state === 'making' ? '拖到右侧封盖机' : cup.state === 'sealing' ? `封杯中 ${cup.remaining.toFixed(1)}s` : '✓ 从机器拖给客人';
            this.progress(ui.bar, cup.state === 'ready' ? 1 : cup.state === 'sealing' ? 1 - cup.remaining / this.game.sealDuration : 0, C.green, 180);
        });
        this.supplies.forEach(supply => { supply.label.string = game.cups.some(cup => cup.state === 'stored') ? '共用空杯\n点击取一只' : '制作位已满'; });
        const sealing = game.cups[0].state === 'sealing';
        this.machineLabel.string = sealing ? `封盖中 ${game.cups[0].remaining.toFixed(1)}s` : this.inMachine ? '封好了，拖给客人' : '拖入封盖 · 1秒';
        if (this.deviceFrames.length) this.machine.spriteFrame = this.deviceFrames[sealing ? 1 : 0];
        this.syncGrab();
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
                this.cancelDrag(); this.inMachine = false; this.game = new TeaGame(); this.clock = 0; this.returnT = -1;
                this.cups.forEach(ui => { ui.fill = 0; ui.lastState = 'stored'; ui.art.node.setPosition(0, 0); });
                this.customers.forEach(ui => { ui.id = -1; ui.goodbye = 0; ui.arrival = 0; ui.happy = false; ui.opacity.opacity = 255; ui.portrait.angle = 0; });
            } else this.game.paused = false;
            this.render();
        }, true);
    }
    onDestroy() {
        engineGame.off(Game.EVENT_HIDE, this.onHide, this);
        if (typeof window !== 'undefined' && window.removeEventListener) {
            window.removeEventListener('resize', this.onViewportChange);
            window.removeEventListener('orientationchange', this.onViewportChange);
        }
        this.hideRotateHint();
        if (this.root) this.root.destroy();
        this.frames.forEach(frame => frame.destroy()); this.textures.forEach(texture => texture.destroy());
    }
}
