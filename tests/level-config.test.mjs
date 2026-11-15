import './ts-loader.mjs';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';

const { Levels } = await import('../assets/game/config/Levels.ts');
const { LevelContent } = await import('../assets/game/config/LevelContent.ts');
const { LevelOrders } = await import('../assets/game/config/LevelOrders.ts');
const { LevelCustomers } = await import('../assets/game/config/LevelCustomers.ts');
const { LevelBackgrounds } = await import('../assets/game/config/LevelBackgrounds.ts');
const { Materials } = await import('../assets/game/config/Materials.ts');
const { Containers } = await import('../assets/game/config/Containers.ts');
const { Workbenches } = await import('../assets/game/config/Workbenches.ts');
const { Bins } = await import('../assets/game/config/Bins.ts');
const { HoldingAreas } = await import('../assets/game/config/HoldingAreas.ts');
const { Texts } = await import('../assets/game/config/Texts.ts');

const resource = (path, ext) => {
    const file = resolve('assets/resources', path + ext);
    assert.ok(existsSync(file), `资源不存在：${file}`);
    assert.ok(existsSync(file + '.meta'), `资源缺少 meta：${file}`);
};
const image = path => {
    assert.ok(path.endsWith('/spriteFrame'), `SpriteFrame 路径无效：${path}`);
    resource(path.slice(0, -'/spriteFrame'.length), '.png');
};

test('选关配置 ID 唯一，关卡图和 Spine 资源存在', () => {
    const levels = Levels.getCfgs();
    assert.ok(levels.length > 0);
    assert.equal(new Set(levels.map(level => level.Id)).size, levels.length);
    for (const level of levels) {
        assert.equal(Levels.getCfg(level.Id), level);
        assert.ok(Number.isFinite(level.X) && Number.isFinite(level.Y), level.Id);
        if (level.IsSpine) {
            resource(level.FilePath, '.skel');
            resource(level.FilePath, '.atlas');
            resource(level.FilePath, '.png');
        } else image(level.FilePath);
    }
});

test('关卡内容的引用有效，订单材料可以在该关取得', () => {
    for (const level of LevelContent.getCfgs()) {
        assert.ok(Levels.getCfg(level.Id), `选关中不存在 ${level.Id}`);
        assert.ok(LevelBackgrounds.getCfg(level.Background), level.Id);
        assert.ok(Workbenches.getCfg(level.Workbench.Id), level.Id);
        assert.ok(Bins.getCfg(level.Bin.Id), level.Id);
        assert.ok(level.Containers.length, `${level.Id} 没有容器`);
        for (const container of level.Containers) assert.ok(Containers.getCfg(container.Id), container.Id);
        for (const material of level.Materials) assert.ok(Materials.getCfg(material.Id), material.Id);
        if (level.HoldingArea) {
            assert.ok(HoldingAreas.getCfg(level.HoldingArea.Id));
            assert.ok(Number.isInteger(level.HoldingArea.Capacity) && level.HoldingArea.Capacity > 0);
        }
        const available = new Set(level.Materials.map(material => material.Id));
        for (const customer of level.Customers) {
            assert.ok(LevelCustomers.getCfg(customer.Id), customer.Id);
            const order = LevelOrders.getCfg(customer.OrderId);
            assert.ok(order, customer.OrderId);
            assert.ok(order.Materials.length, `空订单：${order.Id}`);
            for (const id of order.Materials) assert.ok(available.has(id), `${level.Id} 的订单 ${order.Id} 缺少材料 ${id}`);
        }
    }
});

test('配置引用的关卡资源和材料文本存在', () => {
    for (const cfg of Materials.getCfgs()) {
        resource(cfg.Prefab, '.prefab');
        resource(cfg.ItemPrefab, '.prefab');
        assert.ok(Texts.get(cfg.NameTextId), cfg.NameTextId);
    }
    for (const cfg of Containers.getCfgs()) {
        resource(cfg.Prefab, '.prefab');
        resource(cfg.ItemPrefab, '.prefab');
    }
    for (const group of [Workbenches, Bins, HoldingAreas, LevelCustomers]) {
        for (const cfg of group.getCfgs()) resource(cfg.Prefab, '.prefab');
    }
    for (const cfg of LevelCustomers.getCfgs()) image(cfg.SpriteFrame);
    for (const cfg of LevelBackgrounds.getCfgs()) {
        image(cfg.SpriteFrame);
        assert.ok(cfg.ForegroundTopY > -360 && cfg.ForegroundTopY <= 360);
    }
    for (const order of LevelOrders.getCfgs()) {
        for (const id of order.Materials) assert.ok(Materials.getCfg(id), `${order.Id}: ${id}`);
    }
});

test('未配置的关卡当前回退到第一关', () => {
    assert.equal(LevelContent.getCfg('level_006'), LevelContent.getCfg('level_001'));
    assert.equal(LevelContent.getCfg('__missing__'), LevelContent.getCfg('level_001'));
});
