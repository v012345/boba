import { _decorator, Button, Color, instantiate, Label, Node, Sprite, SpriteFrame, UITransform, Vec3 } from 'cc';
import { Animator, easeOutCubic } from '../../framework/fx/Animator';
import { Draggable, DragEndInfo } from '../../framework/input/Draggable';
import { DropZone } from '../../framework/input/DropZone';
import { FillBar } from '../../framework/ui/FillBar';
import { RoundRect } from '../../framework/ui/RoundRect';
import { UIPanel } from '../../framework/ui/UIPanel';
import { app } from '../GameApp';
import { Ingredient, INGREDIENT_NAMES, TeaGame } from '../logic/TeaGame';
import { BinView } from './BinView';
import { CupView } from './CupView';
import { CustomerView } from './CustomerView';
import { DrinkView } from './DrinkView';
import { IngredientTray } from './IngredientTray';

const { ccclass, property } = _decorator;

export interface ShopParams {
    /** 当前这一局的规则对象。 */
    session: TeaGame;
}

/**
 * 制作台页面：顾客、配料、杯子、封盖机、垃圾桶。布局在 resources/prefabs/view/Shop.prefab 里。
 *
 * 它是规则和画面之间的桥：
 * - 玩家的操作（点配料、取杯、拖杯子）在这里翻译成对规则的调用；
 * - 规则的状态每帧读一次用来刷新画面，离散的时刻（顾客进出、封好）通过事件收到。
 * 所有动画都由这里的 update 推进，暂停或结束时整个画面一起冻结。
 */
@ccclass('ShopView')
export class ShopView extends UIPanel<ShopParams> {
    static prefab = 'prefabs/view/Shop';

    @property({ type: [CustomerView], tooltip: '三个顾客站位，顺序对应规则里的 0、1、2 号位' })
    customers: CustomerView[] = [];
    @property(CupView)
    cup: CupView = null!;
    @property(BinView)
    bin: BinView = null!;
    @property({ type: DropZone, tooltip: '垃圾桶的放置区' })
    binZone: DropZone = null!;
    @property({ type: DropZone, tooltip: '封盖机的放置区' })
    machineZone: DropZone = null!;
    @property({ type: [IngredientTray], tooltip: '桌上的配料' })
    trays: IngredientTray[] = [];

    @property({ type: Button, tooltip: '杯摞，点击取杯' })
    supplyButton: Button = null!;
    @property(Label)
    supplyLabel: Label = null!;
    @property(Label)
    stationDetail: Label = null!;
    @property(Label)
    stationStatus: Label = null!;
    @property(FillBar)
    sealBar: FillBar = null!;
    @property(Sprite)
    machine: Sprite = null!;
    @property(SpriteFrame)
    machineIdleFrame: SpriteFrame | null = null;
    @property(SpriteFrame)
    machineWorkingFrame: SpriteFrame | null = null;
    @property(Label)
    machineLabel: Label = null!;

    @property({ type: Node, tooltip: '杯子在制作位上停放的位置' })
    stationPoint: Node = null!;
    @property({ type: Node, tooltip: '杯子在封盖机里停放的位置' })
    machinePoint: Node = null!;
    @property({ type: Node, tooltip: '取杯时杯子出发的位置' })
    supplyPoint: Node = null!;
    @property({ tooltip: '杯子在封盖机里缩小到多少倍' })
    machineCupScale = 0.62;

    @property({ type: Node, tooltip: '飞行的杯子、小颗粒、飘字都放在这一层' })
    effects: Node = null!;
    @property({ type: Node, tooltip: '加料小颗粒的模板' })
    dropletTemplate: Node = null!;
    @property({ type: Label, tooltip: '飘字的模板' })
    floatTextTemplate: Label = null!;

    private session: TeaGame | null = null;
    private zones: DropZone[] = [];
    private hovered: DropZone | null = null;
    private animator = new Animator();
    private clock = 0;
    private inMachine = false;
    // 三个停放点换算到杯子父节点坐标后的位置。
    private stationRest = new Vec3();
    private machineRest = new Vec3();
    private supplyRest = new Vec3();

    onOpen(params: ShopParams) {
        const session = params.session;
        this.session = session;
        this.customers.forEach((customer, slot) => customer.bind(session, slot));
        // 顺序即优先级：范围重叠时靠前的优先。
        this.zones = [this.binZone, this.machineZone, ...this.customers.map(customer => customer.dropZone)];
        this.dropletTemplate.active = false;
        this.floatTextTemplate.node.active = false;
        const cupSpace = this.cup.node.parent!.getComponent(UITransform)!;
        cupSpace.convertToNodeSpaceAR(this.stationPoint.worldPosition, this.stationRest);
        cupSpace.convertToNodeSpaceAR(this.machinePoint.worldPosition, this.machineRest);
        cupSpace.convertToNodeSpaceAR(this.supplyPoint.worldPosition, this.supplyRest);

        app.events.on('customer:arrived', ({ slot }) => this.customers[slot].arrive(), this);
        app.events.on('customer:left', ({ slot, served }) => this.customers[slot].leave(served), this);
        app.events.on('cup:sealed', this.onSealed, this);

        this.supplyButton.node.on(Button.EventType.CLICK, this.takeCup, this);
        this.trays.forEach(tray => tray.node.on(Button.EventType.CLICK, () => this.addIngredient(tray), this));
        const grab = this.cup.grab;
        grab.canBegin = () => this.canGrab();
        grab.node.on(Draggable.EventType.BEGIN, this.onDragBegin, this);
        grab.node.on(Draggable.EventType.END, this.onDragEnd, this);
        grab.node.on(Draggable.EventType.CANCEL, this.onDragCancel, this);

        this.refresh(0);
        this.cup.snap();
    }

    onClose() {
        app.events.offTarget(this);
    }

    update(dt: number) {
        const session = this.session;
        if (!session) return;
        this.bin.paused = !session.active;
        if (!session.active) {
            // 暂停、切后台或营业结束时，手里的杯子放回原位，不触发任何放置。
            if (this.cup.dragging) this.cup.grab.cancel();
            return;
        }
        this.clock += dt;
        this.animator.update(dt);
        this.customers.forEach(customer => customer.tick(dt, this.clock));
        this.bin.tick(dt, this.hovered === this.binZone);
        this.refresh(dt);
    }

    // ---------- 每帧刷新 ----------

    private refresh(dt: number) {
        const session = this.session!;
        const cup = session.cups[0];
        const stored = cup.state === 'stored', placing = cup.state === 'placing', sealing = cup.state === 'sealing';
        if (stored || placing) this.inMachine = false;

        // 杯子该停在哪：封盖机里，或制作位上；刚取出的杯子从杯摞滑向制作位。
        if (this.inMachine) {
            this.cup.setRest(this.machineRest.x, this.machineRest.y, this.machineCupScale);
        } else {
            const station = this.stationRest, supply = this.supplyRest;
            const travel = placing ? Math.pow(cup.remaining / session.placeDuration, 2) : 0;
            this.cup.setRest(station.x + (supply.x - station.x) * travel, station.y + (supply.y - station.y) * travel, 1);
        }
        this.cup.node.active = !stored;
        this.cup.tick(dt);
        this.cup.drink.show(cup.ingredients, sealing || cup.state === 'ready', sealing ? this.clock : undefined);
        if (this.cup.dragging) this.updateHover();

        this.stationDetail.string = stored ? '从桌下取一只杯子' : placing ? '正在放上桌…' : cup.ingredients.map(i => INGREDIENT_NAMES[i]).join(' + ');
        this.stationStatus.string = stored ? '等待取杯' : placing ? '' : cup.state === 'empty' ? '点击材料加料'
            : cup.state === 'making' ? '拖到右侧封盖机' : sealing ? `封杯中 ${cup.remaining.toFixed(1)}s` : '✓ 从机器拖给客人';
        this.sealBar.set(cup.state === 'ready' ? 1 : sealing ? 1 - cup.remaining / session.sealDuration : 0);
        this.supplyLabel.string = stored ? '共用空杯\n点击取一只' : '制作位已满';
        this.machineLabel.string = sealing ? `封盖中 ${cup.remaining.toFixed(1)}s` : this.inMachine ? '封好了，拖给客人' : `拖入封盖 · ${session.sealDuration}秒`;
        const machineFrame = sealing ? this.machineWorkingFrame : this.machineIdleFrame;
        if (this.machine.spriteFrame !== machineFrame) this.machine.spriteFrame = machineFrame;
    }

    // ---------- 点击 ----------

    private takeCup() {
        this.session?.takeFromSupply();
    }

    private addIngredient(tray: IngredientTray) {
        const session = this.session;
        if (!session || this.cup.dragging) return;
        if (!session.add(tray.ingredient as Ingredient)) return;
        this.cup.pulse();
        // 几颗小颗粒沿弧线从配料飞进杯子。
        const start = this.toEffects(tray.node.worldPosition), target = this.toEffects(this.cup.node.worldPosition);
        const startY = start.y + 15;
        for (let i = 0; i < 5; i++) {
            const node = instantiate(this.dropletTemplate);
            node.active = true;
            node.getComponent(UITransform)!.setContentSize(tray.dropSize, tray.dropSize);
            const shape = node.getComponent(RoundRect)!;
            shape.color = tray.dropColor;
            shape.radius = tray.dropRound ? tray.dropSize / 2 : 2;
            node.setPosition(start.x, startY);
            this.effects.addChild(node);
            this.animator.run(0.38 + i * 0.04, t => node.setPosition(
                start.x + (target.x - start.x) * t + Math.sin(i * 2) * 12 * t,
                startY + (target.y - startY) * t + Math.sin(t * Math.PI) * 115,
            ), () => node.destroy());
        }
    }

    // ---------- 拖杯子 ----------

    private canGrab(): boolean {
        const session = this.session;
        if (!session || !session.active) return false;
        const cup = session.cups[0];
        // 杯子还在滑向桌面时就按住，算它已经放好，直接开始拖。
        if (cup.state === 'placing') return session.settlePlacement(0);
        return cup.state !== 'stored' && cup.state !== 'sealing';
    }

    private onDragBegin() {
        this.hovered = null;
        DropZone.showHints(this.zones, true, null);
    }

    private updateHover() {
        const point = this.cup.dropPoint;
        const zone = DropZone.pick(this.zones, point.x, point.y);
        if (zone === this.hovered) return;
        this.hovered = zone;
        DropZone.showHints(this.zones, true, zone);
        this.bin.setOpen(zone === this.binZone);
    }

    private onDragCancel() {
        this.hovered = null;
        DropZone.showHints(this.zones, false, null);
        this.bin.setOpen(false);
    }

    private onDragEnd(info: DragEndInfo) {
        const session = this.session!;
        const world = this.cup.dropPoint;
        const zone = info.tap ? null : DropZone.pick(this.zones, world.x, world.y);
        const point = this.toEffects(world);
        this.hovered = null;
        DropZone.showHints(this.zones, false, null);

        let discarded = false;
        if (session.active) {
            if (zone === this.binZone) discarded = this.discard(point);
            else if (zone === this.machineZone) this.seal();
            else if (zone) this.deliver(this.customers.findIndex(customer => customer.dropZone === zone), point);
            else if (!info.tap) session.message = '拖到封盖机、客人或桌下垃圾桶。';
        }
        if (!discarded) this.bin.setOpen(false);
        // 没放成的杯子缓动飞回原位；已经交出去或丢掉的直接消失。
        this.cup.release(session.cups[0].state === 'stored' ? 0 : info.tap ? 0.08 : 0.16);
        // 立刻按新状态刷新一次，否则已经交出去的杯子会在原位多显示一帧。
        this.refresh(0);
    }

    private seal() {
        const session = this.session!;
        if (session.cups[0].state === 'ready') { session.message = '这杯已经封好啦，拖给对应的客人。'; return; }
        if (session.seal()) this.inMachine = true;
    }

    private discard(point: Vec3): boolean {
        const ghost = this.spawnGhost(point);
        if (!this.session!.discard()) { ghost.destroy(); return false; }
        this.inMachine = false;
        this.bin.swallow();
        const mouth = this.toEffects(this.bin.mouth.worldPosition);
        const scale = ghost.scale.x;
        this.animator.run(this.bin.swallowTime, t => {
            ghost.setPosition(point.x + (mouth.x - point.x) * t, point.y + (mouth.y - point.y) * t);
            ghost.setScale(scale * (1 - t), scale * (1 - t), 1);
        }, () => ghost.destroy());
        return true;
    }

    private deliver(slot: number, point: Vec3) {
        const session = this.session!;
        const customer = this.customers[slot];
        const before = session.money;
        const ghost = this.spawnGhost(point);
        if (!session.deliver(slot)) {
            ghost.destroy();
            customer.refuse();
            return;
        }
        this.inMachine = false;
        const end = this.toEffects(customer.worldPoint(customer.receiveOffsetY)), scale = ghost.scale.x;
        this.animator.run(0.5, t => {
            const ease = easeOutCubic(t), shrink = scale * (1 - t * 0.45);
            ghost.setPosition(point.x + (end.x - point.x) * ease, point.y + (end.y - point.y) * ease + Math.sin(t * Math.PI) * 25);
            ghost.setScale(shrink, shrink, 1);
        }, () => ghost.destroy());
        const reward = this.toEffects(customer.worldPoint(customer.rewardOffsetY));
        this.floatText(`+¥${session.money - before}${session.combo > 1 ? `  连击 ×${session.combo}` : ''}`, reward.x, reward.y);
    }

    private onSealed() {
        this.cup.pulse();
        const machine = this.toEffects(this.machinePoint.worldPosition);
        this.floatText('封好啦！', machine.x, machine.y + 128);
    }

    // ---------- 小动效 ----------

    /** 把世界坐标换算成特效层里的坐标。 */
    private toEffects(world: Readonly<Vec3>): Vec3 {
        return this.effects.getComponent(UITransform)!.convertToNodeSpaceAR(world as Vec3);
    }

    /** 在特效层复制一只和手里一模一样的杯子，用来播放「飞走」的动画。 */
    private spawnGhost(point: Vec3): Node {
        const cup = this.session!.cups[0];
        const source = this.cup.drink.node;
        const ghost = instantiate(source);
        this.effects.addChild(ghost);
        ghost.setPosition(point);
        ghost.setScale(source.scale);
        ghost.getComponent(DrinkView)!.show(cup.ingredients, cup.state === 'sealing' || cup.state === 'ready');
        return ghost;
    }

    /** 一行向上飘走并淡出的文字。 */
    private floatText(text: string, x: number, y: number) {
        const node = instantiate(this.floatTextTemplate.node);
        const label = node.getComponent(Label)!;
        const color = this.floatTextTemplate.color;
        node.active = true;
        label.string = text;
        node.setPosition(x, y);
        this.effects.addChild(node);
        this.animator.run(0.9, t => {
            node.setPosition(x, y + t * 55);
            label.color = new Color(color.r, color.g, color.b, Math.round(255 * Math.min(1, (1 - t) * 3)));
        }, () => node.destroy());
    }
}
