import { _decorator, Button, Color, instantiate, Label, Node, Prefab, UITransform, Vec3 } from 'cc';
import { Animator, easeOutCubic } from '../../framework/fx/Animator';
import { Draggable, DragEndInfo } from '../../framework/input/Draggable';
import { DropZone } from '../../framework/input/DropZone';
import { RoundRect } from '../../framework/ui/RoundRect';
import { UIPanel } from '../../framework/ui/UIPanel';
import { app } from '../GameApp';
import { Ingredient, TeaGame } from '../logic/TeaGame';
import type { ShopDefinition } from '../config/Shops';
import { ShopLayout } from './shop/ShopLayout';
import { BinView } from './level/equipment/BinView';
import { SealerView } from './shop/equipment/SealerView';
import { CupSupplyView } from './shop/equipment/CupSupplyView';
import { WorkstationView } from './shop/equipment/WorkstationView';
import { CupView } from './shop/drinks/CupView';
import { CustomerView } from './shop/customers/CustomerView';
import { DrinkView } from './shop/drinks/DrinkView';
import { IngredientTray } from './level/materials/IngredientTray';


const { ccclass } = _decorator;

export interface ShopParams {
    /** 当前这一局的规则对象。 */
    session: TeaGame;
    shop: ShopDefinition;
    layoutPrefab: Prefab;
    /** 所有组件绑定完成后才开始营业计时。 */
    onReady?: () => void;
}

/**
 * 店铺页面入口。具体摆放在 prefabs/shop/layouts，物件各自管理内部节点。
 *
 * 它是规则和画面之间的桥：
 * - 玩家的操作（点配料、取杯、拖杯子）在这里翻译成对规则的调用；
 * - 规则的状态每帧读一次用来刷新画面，离散的时刻（顾客进出、封好）通过事件收到。
 * 所有动画都由这里的 update 推进，暂停或结束时整个画面一起冻结。
 */
@ccclass('ShopView')
export class ShopView extends UIPanel<ShopParams> {
    static prefab = 'prefabs/view/Shop';

    private customers: CustomerView[] = [];
    private cup: CupView = null!;
    private bin: BinView = null!;
    private sealer: SealerView = null!;
    private supply: CupSupplyView = null!;
    private station: WorkstationView = null!;
    private trays: IngredientTray[] = [];
    private layout: ShopLayout = null!;

    private get binZone(): DropZone { return this.bin.dropZone; }
    private get machineZone(): DropZone { return this.sealer.dropZone; }
    private get effects(): Node { return this.layout.effects; }

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
        // 壳中的标准布局用于编辑器预览。运行时始终使用所选资产，复制布局后改名也不会选错。
        const preview = this.getComponentInChildren(ShopLayout);
        if (preview) { preview.node.active = false; preview.node.destroy(); }
        const node = instantiate(params.layoutPrefab);
        this.node.addChild(node);
        const layout = node.getComponent(ShopLayout);
        if (!layout) throw new Error(`${params.layoutPrefab.name} 缺少 ShopLayout 组件`);
        this.layout = layout;
        const parts = layout.configure(params.shop);
        this.customers = parts.customers;
        this.cup = parts.cup;
        this.bin = parts.bin;
        this.sealer = parts.sealer;
        this.supply = parts.supply;
        this.station = parts.station;
        this.trays = parts.trays;
        const session = params.session;
        if (session.customers.length !== this.customers.length) throw new Error('店铺规则和布局的客位数量不一致');
        this.session = session;
        this.customers.forEach((customer, slot) => customer.bind(session, slot));
        // 顺序即优先级：范围重叠时靠前的优先。
        this.zones = [this.binZone, this.machineZone, ...this.customers.map(customer => customer.dropZone)];
        this.updateRestPoints();

        app.events.on('customer:arrived', ({ slot }) => this.customers[slot].arrive(), this);
        app.events.on('customer:left', ({ slot, served }) => this.customers[slot].leave(served), this);
        app.events.on('cup:sealed', this.onSealed, this);

        this.supply.button.node.on(Button.EventType.CLICK, this.takeCup, this);
        this.trays.forEach(tray => tray.node.on(Button.EventType.CLICK, () => this.addIngredient(tray), this));
        const grab = this.cup.grab;
        grab.canBegin = () => this.canGrab();
        grab.node.on(Draggable.EventType.BEGIN, this.onDragBegin, this);
        grab.node.on(Draggable.EventType.END, this.onDragEnd, this);
        grab.node.on(Draggable.EventType.CANCEL, this.onDragCancel, this);

        this.refresh(0);
        this.cup.snap();
        params.onReady?.();
    }

    onClose() {
        app.events.offTarget(this);
        if (this.cup) {
            this.cup.grab.cancel();
            this.cup.grab.canBegin = null;
            this.cup.grab.node.targetOff(this);
        }
        this.supply?.button.node.targetOff(this);
        this.trays.forEach(tray => tray.node.targetOff(this));
        this.session = null;
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
        this.updateRestPoints();
        const cup = session.cups[0];
        const stored = cup.state === 'stored', placing = cup.state === 'placing', sealing = cup.state === 'sealing';
        if (stored || placing) this.inMachine = false;

        // 杯子该停在哪：封盖机里，或制作位上；刚取出的杯子从杯摞滑向制作位。
        if (this.inMachine) {
            this.cup.setRest(this.machineRest.x, this.machineRest.y, this.sealer.cupScale);
        } else {
            const station = this.stationRest, supply = this.supplyRest;
            const travel = placing ? Math.pow(cup.remaining / session.placeDuration, 2) : 0;
            this.cup.setRest(station.x + (supply.x - station.x) * travel, station.y + (supply.y - station.y) * travel, 1);
        }
        this.cup.node.active = !stored;
        this.cup.tick(dt);
        this.cup.drink.show(cup.ingredients, sealing || cup.state === 'ready', sealing ? this.clock : undefined);
        if (this.cup.dragging) this.updateHover();

        this.station.show(cup);
        this.supply.show(stored);
        this.sealer.show(cup, this.inMachine, session.sealDuration);
    }

    /** 锚点跟随物件摆放；布局缩放或窗口变化后仍用正确的杯子父节点坐标。 */
    private updateRestPoints(): void {
        const cupSpace = this.cup.node.parent!.getComponent(UITransform)!;
        cupSpace.convertToNodeSpaceAR(this.station.cupPoint.worldPosition, this.stationRest);
        cupSpace.convertToNodeSpaceAR(this.sealer.cupPoint.worldPosition, this.machineRest);
        cupSpace.convertToNodeSpaceAR(this.supply.cupPoint.worldPosition, this.supplyRest);
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
            const node = instantiate(this.layout.dropletPrefab);
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
        const scale = ghost.scale.clone();
        this.animator.run(this.bin.swallowTime, t => {
            ghost.setPosition(point.x + (mouth.x - point.x) * t, point.y + (mouth.y - point.y) * t);
            ghost.setScale(scale.x * (1 - t), scale.y * (1 - t), scale.z);
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
        const end = this.toEffects(customer.worldPoint(customer.receiveOffsetY)), scale = ghost.scale.clone();
        this.animator.run(0.5, t => {
            const ease = easeOutCubic(t), shrink = 1 - t * 0.45;
            ghost.setPosition(point.x + (end.x - point.x) * ease, point.y + (end.y - point.y) * ease + Math.sin(t * Math.PI) * 25);
            ghost.setScale(scale.x * shrink, scale.y * shrink, scale.z);
        }, () => ghost.destroy());
        const reward = this.toEffects(customer.worldPoint(customer.rewardOffsetY));
        this.floatText(`+¥${session.money - before}${session.combo > 1 ? `  连击 ×${session.combo}` : ''}`, reward.x, reward.y);
    }

    private onSealed() {
        this.cup.pulse();
        const machine = this.toEffects(this.sealer.cupPoint.worldPosition);
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
        ghost.setWorldScale(source.worldScale);
        ghost.setWorldRotation(source.worldRotation);
        ghost.getComponent(DrinkView)!.show(cup.ingredients, cup.state === 'sealing' || cup.state === 'ready');
        return ghost;
    }

    /** 一行向上飘走并淡出的文字。 */
    private floatText(text: string, x: number, y: number) {
        const node = instantiate(this.layout.floatTextPrefab);
        const label = node.getComponent(Label)!;
        const color = label.color.clone();
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
