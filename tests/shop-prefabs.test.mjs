// Asset integrity checks for the modular shop. Run: node tests/shop-prefabs.test.mjs
// These inspect Creator's serialized assets; the editor preview remains the visual check.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const project = fileURLToPath(new URL('../', import.meta.url));
const assetsRoot = path.join(project, 'assets');
function filesBelow(directory) {
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
        const name = path.join(directory, entry.name);
        return entry.isDirectory() ? filesBelow(name) : [name];
    });
}
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const assetFiles = filesBelow(assetsRoot);
const metadata = new Map(assetFiles.filter(file => file.endsWith('.meta')).map(file => [read(file).uuid, file.slice(0, -5)]));
const prefabRoot = path.join(assetsRoot, 'resources/prefabs/shop');
const prefabFiles = filesBelow(prefabRoot).filter(file => file.endsWith('.prefab'));
prefabFiles.push(path.join(assetsRoot, 'resources/prefabs/view/Shop.prefab'));
const prefabData = new Map(prefabFiles.map(file => [file, read(file)]));
const ref = (data, value) => value == null ? null : data[value.__id__];
const prefab = name => prefabData.get(path.join(prefabRoot, `${name}.prefab`));
const root = data => ref(data, data[0].data);
const rootInfo = data => ref(data, root(data)._prefab);
const uuid = name => read(path.join(prefabRoot, `${name}.prefab.meta`)).uuid;
const instances = data => data.filter(value => value?.__type__ === 'cc.Node' && ref(data, value._prefab)?.instance);
const instanceAsset = (data, node) => ref(data, node._prefab).asset.__uuid__;
function walkValues(value, visit) {
    if (value && typeof value === 'object') {
        visit(value);
        Object.values(value).forEach(child => walkValues(child, visit));
    }
}
function compressed(uuid) {
    const hex = uuid.replaceAll('-', '');
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let result = hex.slice(0, 5);
    for (let i = 5; i < 32; i += 3) {
        const n = parseInt(hex.slice(i, i + 3), 16);
        result += alphabet[n >> 6] + alphabet[n & 63];
    }
    return result;
}
const scripts = new Map([...metadata].filter(([, file]) => file.endsWith('.ts')).map(([id, file]) => [compressed(id), file]));
const components = (data, node = root(data)) => node._components.map(component => ref(data, component));
const scriptComponent = (data, name) => data.find(item => scripts.get(item?.__type__)?.endsWith(`${name}.ts`));
function ownedNode(data, componentField) {
    const object = ref(data, componentField);
    return object.__type__ === 'cc.Node' ? object : ref(data, object.node);
}
function isDescendant(data, node, parent) {
    while (node) {
        if (node === parent) return true;
        node = ref(data, node._parent);
    }
    return false;
}
function fileIds(data) {
    return new Set(data.filter(item => ['cc.PrefabInfo', 'cc.CompPrefabInfo'].includes(item?.__type__)).map(item => item.fileId));
}
function overrides(data, node) {
    const info = ref(data, node._prefab);
    const instance = ref(data, info.instance);
    return Object.fromEntries(instance.propertyOverrides.map(reference => {
        const override = ref(data, reference);
        return [override.propertyPath.join('.'), override.value];
    }));
}
function instanceOf(data, name) {
    return instances(data).filter(node => instanceAsset(data, node) === uuid(name));
}

let count = 0;
function test(name, run) { run(); count++; console.log(`✓ ${name}`); }

test('All local references and external assets resolve, including moved script UUIDs', () => {
    for (const [file, data] of prefabData) {
        assert.equal(data[0].__type__, 'cc.Prefab', file);
        assert.equal(root(data).__type__, 'cc.Node', file);
        walkValues(data, value => {
            if ('__id__' in value) assert.ok(Number.isInteger(value.__id__) && value.__id__ >= 0 && value.__id__ < data.length, `${file}: dangling reference ${value.__id__}`);
            if ('__uuid__' in value) {
                const asset = metadata.get(value.__uuid__.split('@')[0]);
                assert.ok(asset && fs.existsSync(asset), `${file}: missing asset ${value.__uuid__}`);
            }
        });
        for (const value of data) {
            if (value?.node && value.__type__ && !value.__type__.startsWith('cc.') && !value.__type__.startsWith('sp.')) {
                assert.ok(scripts.has(value.__type__), `${file}: missing component script ${value.__type__}`);
            }
        }
    }
});

test('Standalone objects have neutral root transforms and own their internal nodes', () => {
    for (const [file, data] of prefabData) {
        const node = root(data);
        assert.equal(node._parent, null, file);
        assert.deepEqual([node._lpos.x, node._lpos.y, node._lpos.z], [0, 0, 0], file);
        assert.deepEqual([node._lscale.x, node._lscale.y, node._lscale.z], [1, 1, 1], file);
        const seen = new Set();
        function visit(current) {
            assert.ok(!seen.has(current), `${file}: cyclic/duplicate hierarchy`);
            seen.add(current);
            for (const reference of current._children || []) {
                const child = ref(data, reference);
                assert.equal(ref(data, child._parent), current, `${file}: wrong parent`);
                visit(child);
            }
        }
        visit(node);
        assert.equal(seen.size, data.filter(value => value?.__type__ === 'cc.Node').length, `${file}: orphan node`);
    }
});

test('Native nested prefab records reference shared assets and valid override targets', () => {
    for (const [file, data] of prefabData) {
        const nested = instances(data);
        const expansionRoots = (rootInfo(data).nestedPrefabInstanceRoots || []).map(reference => ref(data, reference));
        assert.equal(expansionRoots.length, nested.length, file);
        for (const node of nested) {
            assert.ok(expansionRoots.includes(node), `${file}: unregistered nested instance`);
            const info = ref(data, node._prefab);
            const asset = prefabData.get(metadata.get(info.asset.__uuid__));
            assert.ok(asset, `${file}: nested prefab dependency must be present`);
            assert.equal(info.fileId, rootInfo(asset).fileId, `${file}: nested root fileId`);
            assert.equal(ref(data, info.root), node, `${file}: nested root reference`);
            for (const reference of ref(data, info.instance).propertyOverrides) {
                const override = ref(data, reference);
                const target = ref(data, override.targetInfo);
                assert.equal(target.localID.length, 1, file);
                assert.ok(fileIds(asset).has(target.localID[0]), `${file}: invalid property override target`);
            }
        }
        for (const reference of rootInfo(data).targetOverrides || []) {
            const override = ref(data, reference);
            const source = ref(data, override.source);
            assert.ok(source && override.propertyPath[0] in source, `${file}: invalid binding source`);
            const targetInstance = ref(data, override.target);
            assert.ok(nested.includes(targetInstance), `${file}: target must be a nested instance`);
            const targetAsset = prefabData.get(metadata.get(instanceAsset(data, targetInstance)));
            const target = ref(data, override.targetInfo);
            assert.ok(fileIds(targetAsset).has(target.localID[0]), `${file}: invalid component binding`);
        }
    }
});

test('Equipment owns its drop zones, cup anchors and status displays', () => {
    const requirements = [
        ['equipment/Bin', 'BinView', ['skeleton', 'mouth', 'dropZone']],
        ['equipment/Sealer', 'SealerView', ['machine', 'label', 'progress', 'cupPoint', 'dropZone']],
        ['equipment/CupSupply', 'CupSupplyView', ['button', 'label', 'cupPoint']],
        ['equipment/Workstation', 'WorkstationView', ['detail', 'status', 'cupPoint']],
        ['customers/Customer', 'CustomerView', ['portrait', 'title', 'patience', 'dropZone']],
    ];
    for (const [name, script, fields] of requirements) {
        const data = prefab(name);
        const component = scriptComponent(data, script);
        assert.ok(component, `${name}: ${script} missing`);
        assert.ok(components(data).includes(component), `${name}: component must be on the reusable root`);
        for (const field of fields) {
            assert.ok(component[field], `${name}: missing ${field}`);
            assert.ok(isDescendant(data, ownedNode(data, component[field]), root(data)), `${name}: ${field} escapes the object`);
        }
    }
    const sealer = prefab('equipment/Sealer');
    const point = ref(sealer, scriptComponent(sealer, 'SealerView').cupPoint);
    assert.deepEqual([point._lpos.x, point._lpos.y], [0, -46], 'sealing cup position stays attached to the machine');
});

test('Customer orders and draggable cups reuse the same Drink prefab', () => {
    for (const [name, script, field] of [['customers/Customer', 'CustomerView', 'order'], ['drinks/Cup', 'CupView', 'drink']]) {
        const data = prefab(name);
        assert.equal(instanceOf(data, 'drinks/Drink').length, 1, name);
        assert.equal(scriptComponent(data, 'DrinkView'), undefined, `${name}: must not contain a copied Drink implementation`);
        const source = scriptComponent(data, script);
        const binding = rootInfo(data).targetOverrides.map(reference => ref(data, reference)).find(value => value.propertyPath[0] === field);
        assert.ok(binding && ref(data, binding.source) === source, `${name}: shared Drink must bind back to its owner`);
    }
    const cup = prefab('drinks/Cup');
    const grab = ref(cup, scriptComponent(cup, 'CupView').grab);
    assert.equal(ref(cup, grab.target), root(cup), 'drag target remains the whole Cup');
});

test('Layouts compose shared equipment with 2, 3 and 4 distinct customer stations', () => {
    for (const [name, capacity] of [['SmallShop', 2], ['StandardShop', 3], ['LargeShop', 4]]) {
        const data = prefab(`layouts/${name}`);
        const customers = instanceOf(data, 'customers/Customer');
        assert.equal(customers.length, capacity, name);
        assert.equal(new Set(customers.map(node => overrides(data, node).position.x)).size, capacity, name);
        for (const item of ['equipment/Bin', 'equipment/Sealer', 'equipment/CupSupply', 'equipment/Workstation', 'drinks/Cup']) {
            assert.equal(instanceOf(data, item).length, 1, `${name}: ${item}`);
        }
        for (const item of ['environment/Background', 'environment/Counter']) {
            const node = instanceOf(data, item)[0];
            assert.equal(ref(data, node._parent), root(data), `${name}: theme target must be a direct child`);
            assert.equal(overrides(data, node).name, path.basename(item), `${name}: theme target name`);
        }
        assert.equal(instanceOf(data, 'ingredients/JellyTray').length, name === 'SmallShop' ? 0 : 1, name);
        const layout = scriptComponent(data, 'ShopLayout');
        assert.ok(layout, name);
        assert.equal(ref(data, layout.effects)._name, 'Effects');
        assert.equal(layout.dropletPrefab.__uuid__, uuid('fx/IngredientDrop'));
        assert.equal(layout.floatTextPrefab.__uuid__, uuid('fx/FloatingText'));
    }
});

test('Standard layout preserves the established object positions and the entry asset UUID', () => {
    const standard = prefab('layouts/StandardShop');
    for (const [item, position] of [
        ['environment/Background', [0, 0]], ['environment/Counter', [0, -81]], ['environment/Shelf', [0, -256]],
        ['equipment/Bin', [-420, -249]], ['equipment/Sealer', [125, -70]], ['equipment/CupSupply', [0, -254]],
        ['equipment/Workstation', [-115, -88]], ['drinks/Cup', [-115, -88]],
    ]) {
        const point = overrides(standard, instanceOf(standard, item)[0]).position;
        assert.deepEqual([point.x, point.y], position, item);
    }
    const shellFile = path.join(assetsRoot, 'resources/prefabs/view/Shop.prefab');
    const shell = prefabData.get(shellFile);
    assert.equal(read(`${shellFile}.meta`).uuid, '1d7d2e85-48e0-4f69-957a-cfe19c0cdaad');
    assert.equal(instanceOf(shell, 'layouts/StandardShop').length, 1);
    assert.ok(scriptComponent(shell, 'ShopView'));
    assert.equal(root(shell)._children.length, 1, 'entry shell delegates its contents to a shared layout');
});

console.log(`\n${count} shop prefab checks passed.`);
