// 框架里不依赖引擎的部分（事件总线、状态机、动画驱动、落点判定）的测试，直接用 Node 运行 TypeScript 源码。
// 用到引擎的部分（App、资源、界面、拖拽组件、流程）不在这里测，需要在 Creator 预览里验证。
// 运行：node tests/framework.test.mjs
import './ts-loader.mjs';
import assert from 'node:assert/strict';
import { test } from 'node:test';

const { EventBus } = await import('../assets/framework/core/EventBus.ts');
const { StateMachine } = await import('../assets/framework/fsm/StateMachine.ts');
const { Animator, easeOutCubic, easeOutQuad } = await import('../assets/framework/fx/Animator.ts');
const { pickDrop, distanceToRect } = await import('../assets/framework/input/DropPick.ts');

test('动画：按给定时间推进，结束时以 t=1 收尾并调用 done', () => {
    const animator = new Animator();
    const seen = [];
    animator.run(1, t => seen.push(t), () => seen.push('done'));
    animator.update(0.25);
    animator.update(0.5);
    assert.equal(animator.running, 1);
    animator.update(0.5);
    assert.deepEqual(seen, [0.25, 0.75, 1, 'done']);
    assert.equal(animator.running, 0);
    animator.update(1);
    assert.deepEqual(seen, [0.25, 0.75, 1, 'done']);
});

test('动画：不调用 update 就不前进；时长为 0 的立即完成', () => {
    const animator = new Animator();
    const seen = [];
    animator.run(0, t => seen.push(t), () => seen.push('done'));
    assert.deepEqual(seen, [1, 'done']);
    animator.run(0.3, t => seen.push(t));
    assert.deepEqual(seen, [1, 'done']);
    assert.equal(animator.running, 1);
});

test('动画：回调里登记的新动画下一帧才开始，clear 之后不再回调', () => {
    const animator = new Animator();
    const seen = [];
    animator.run(0.1, () => {}, () => animator.run(1, t => seen.push(['chained', t])));
    animator.run(1, t => seen.push(['other', t]));
    animator.update(0.5);
    assert.deepEqual(seen, [['other', 0.5]]);
    animator.update(0.25);
    assert.deepEqual(seen, [['other', 0.5], ['other', 0.75], ['chained', 0.25]]);

    animator.run(1, () => { animator.clear(); seen.push('cleared'); });
    animator.update(0.1);
    assert.equal(animator.running, 0);
    animator.update(1);
    // 这一帧里排在 clear 之前的两个动画照常推进了一次，之后全部停止。
    assert.deepEqual(seen.slice(3), [['other', 0.85], ['chained', 0.35], 'cleared']);
});

test('动画：缓动函数从 0 到 1，且先快后慢', () => {
    for (const ease of [easeOutCubic, easeOutQuad]) {
        assert.equal(ease(0), 0);
        assert.equal(ease(1), 1);
        assert.ok(ease(0.5) > 0.5);
    }
});

test('落点：点在矩形内命中，靠前的优先；矩形外按 snapRadius 就近吸附', () => {
    const bin = { rect: { x: -515, y: -309, width: 190, height: 118 }, snapRadius: 52, value: 'bin' };
    const machine = { rect: { x: 22, y: -177, width: 206, height: 210 }, snapRadius: 52, value: 'machine' };
    const customer = { rect: { x: -565, y: 48, width: 350, height: 220 }, snapRadius: 0, value: 'customer' };
    const all = [bin, machine, customer];
    assert.equal(pickDrop(all, 125, -116), 'machine');
    assert.equal(pickDrop(all, -420, -249), 'bin');
    assert.equal(pickDrop(all, -390, 140), 'customer');
    assert.equal(pickDrop(all, 0, 140), null);
    assert.equal(pickDrop(all, 0, 310), null);
    // 设备接受「差一点」的松手，顾客必须准确命中。
    assert.equal(pickDrop(all, 238, -190), 'machine');
    assert.equal(pickDrop(all, -538, -250), 'bin');
    assert.equal(pickDrop(all, -115, -88), null);
    assert.equal(pickDrop(all, -390, 30), null);
    assert.equal(pickDrop([], 0, 0), null);
    // 两个都在吸附范围内时取更近的；重叠时取靠前的。
    const left = { rect: { x: 0, y: 0, width: 10, height: 10 }, snapRadius: 50, value: 'left' };
    const right = { rect: { x: 40, y: 0, width: 10, height: 10 }, snapRadius: 50, value: 'right' };
    assert.equal(pickDrop([left, right], 30, 5), 'right');
    assert.equal(pickDrop([left, right], 18, 5), 'left');
    assert.equal(pickDrop([left, { ...right, rect: left.rect }], 5, 5), 'left');
    assert.equal(distanceToRect(left.rect, 13, 14), 5);
});

test('事件：emit 把数据交给所有监听者，回调里的 this 是 target', () => {
    const bus = new EventBus();
    const seen = [];
    const target = { name: 'hud' };
    bus.on('money', function (payload) { seen.push([this, payload]); }, target);
    bus.on('money', payload => seen.push(['second', payload]));
    bus.emit('money', { money: 18 });
    assert.deepEqual(seen, [[target, { money: 18 }], ['second', { money: 18 }]]);
});

test('事件：没人监听时 emit 不报错', () => {
    new EventBus().emit('nobody');
});

test('事件：off 需要 handler 与 target 都一致', () => {
    const bus = new EventBus();
    let count = 0;
    const handler = () => { count++; };
    const target = {};
    bus.on('tick', handler, target);
    bus.off('tick', handler);
    bus.emit('tick');
    assert.equal(count, 1);
    bus.off('tick', handler, target);
    bus.emit('tick');
    assert.equal(count, 1);
});

test('事件：once 只触发一次，即使回调里又 emit 了同一个事件', () => {
    const bus = new EventBus();
    let count = 0;
    bus.once('open', () => { count++; if (count === 1) bus.emit('open'); });
    bus.emit('open');
    bus.emit('open');
    assert.equal(count, 1);
});

test('事件：offTarget 只清掉该对象的监听', () => {
    const bus = new EventBus();
    const seen = [];
    const view = {};
    bus.on('a', () => seen.push('view a'), view);
    bus.on('b', () => seen.push('view b'), view);
    bus.on('a', () => seen.push('other a'));
    bus.offTarget(view);
    bus.offTarget(undefined);
    bus.emit('a');
    bus.emit('b');
    assert.deepEqual(seen, ['other a']);
});

test('事件：emit 途中被取消的监听不再触发，途中新增的下一轮才触发', () => {
    const bus = new EventBus();
    const seen = [];
    const late = () => seen.push('late');
    const added = () => seen.push('added');
    bus.on('go', () => { seen.push('first'); bus.off('go', late); bus.on('go', added); });
    bus.on('go', late);
    bus.emit('go');
    assert.deepEqual(seen, ['first']);
    bus.emit('go');
    assert.deepEqual(seen, ['first', 'first', 'added']);
});

function recorder(log, name) {
    return {
        enter: (ctx, from) => log.push(`${name}.enter from=${from} ctx=${ctx.id}`),
        update: (ctx, dt) => log.push(`${name}.update ${dt}`),
        exit: (ctx, to) => log.push(`${name}.exit to=${to}`),
    };
}

test('状态机：先退出旧状态再进入新状态，update 只驱动当前状态', () => {
    const log = [];
    const fsm = new StateMachine({ id: 7 });
    fsm.add('a', recorder(log, 'a')).add('b', recorder(log, 'b'));
    assert.equal(fsm.current, null);
    fsm.update(1);
    fsm.change('a');
    fsm.update(0.5);
    fsm.change('b');
    fsm.update(0.25);
    assert.equal(fsm.is('b'), true);
    assert.deepEqual(log, [
        'a.enter from=null ctx=7', 'a.update 0.5',
        'a.exit to=b', 'b.enter from=a ctx=7', 'b.update 0.25',
    ]);
});

test('状态机：切到当前状态会重新进入', () => {
    const log = [];
    const fsm = new StateMachine({ id: 1 });
    fsm.add('a', recorder(log, 'a'));
    fsm.change('a');
    fsm.change('a');
    assert.deepEqual(log, ['a.enter from=null ctx=1', 'a.exit to=a', 'a.enter from=a ctx=1']);
});

test('状态机：未注册和重复注册都报错，且不影响当前状态', () => {
    const fsm = new StateMachine(null);
    fsm.add('a', {});
    fsm.change('a');
    assert.throws(() => fsm.change('missing'), /状态未注册：missing/);
    assert.throws(() => fsm.add('a', {}), /状态重复注册：a/);
    assert.equal(fsm.current, 'a');
});

test('状态机：enter 里再切换，会等本次切换完成后接着切', () => {
    const log = [];
    const fsm = new StateMachine({ id: 0 });
    fsm.add('loading', {
        enter: () => { log.push('loading.enter'); fsm.change('menu'); log.push('loading.enter done'); },
        exit: (ctx, to) => log.push(`loading.exit to=${to}`),
    });
    fsm.add('menu', { enter: (ctx, from) => log.push(`menu.enter from=${from}`) });
    fsm.change('loading');
    assert.equal(fsm.current, 'menu');
    assert.deepEqual(log, ['loading.enter', 'loading.enter done', 'loading.exit to=menu', 'menu.enter from=loading']);
});

test('状态机：回调抛错后仍然可以继续切换', () => {
    const fsm = new StateMachine(null);
    fsm.add('bad', { enter: () => { throw new Error('boom'); } }).add('ok', {});
    assert.throws(() => fsm.change('bad'), /boom/);
    fsm.change('ok');
    assert.equal(fsm.current, 'ok');
});

test('状态机：change 附带的数据交给新状态的 enter，排队的切换也不丢数据', () => {
    const seen = [];
    const fsm = new StateMachine(null);
    fsm.add('playing', { enter: () => fsm.change('result', { money: 160 }) });
    fsm.add('result', { enter: (ctx, from, data) => seen.push([from, data]) });
    fsm.change('result', { money: 20 });
    fsm.change('result');
    fsm.change('playing');
    assert.deepEqual(seen, [[null, { money: 20 }], ['result', undefined], ['playing', { money: 160 }]]);
});
