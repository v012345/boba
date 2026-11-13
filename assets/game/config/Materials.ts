import type { TextId } from './Texts';

/** 材料 ID 对应 [来源 Prefab, 单个材料 Prefab, 名称文本 ID]，路径相对 assets/resources。 */
const configs = {
    tea: ['prefabs/level/materials/trays/TeaPot', 'prefabs/level/materials/items/Tea', 'material.tea'],
    milk: ['prefabs/level/materials/trays/MilkJug', 'prefabs/level/materials/items/MilkJug', 'material.milk'],
    pearl: ['prefabs/level/materials/trays/PearlTray', 'prefabs/level/materials/items/Pearl', 'material.pearl'],
    jelly: ['prefabs/level/materials/trays/JellyTray', 'prefabs/level/materials/items/Jelly', 'material.jelly'],
    bone: ['prefabs/level/materials/trays/BoneTray', 'prefabs/level/materials/items/Bone', 'material.bone'],
    flesh: ['prefabs/level/materials/trays/FleshTray', 'prefabs/level/materials/items/Flesh', 'material.flesh'],
    organs: ['prefabs/level/materials/trays/OrgansTray', 'prefabs/level/materials/items/Organs', 'material.organs'],
    poop: ['prefabs/level/materials/trays/PoopTray', 'prefabs/level/materials/items/Poop', 'material.poop'],
} as const satisfies Readonly<Record<string, readonly [string, string, TextId]>>;

export type MaterialId = keyof typeof configs;

export interface MaterialConfig {
    readonly Id: MaterialId;
    /** 材料名称在文本表中的 ID。 */
    readonly NameTextId: TextId;
    /** 相对 assets/resources 的 Prefab 路径。 */
    readonly Prefab: string;
    /** 从来源取出的单个材料 Prefab。 */
    readonly ItemPrefab: string;
}

const materialConfigs: readonly MaterialConfig[] = Object.freeze(
    (Object.keys(configs) as MaterialId[]).map(Id => Object.freeze({ Id, Prefab: configs[Id][0], ItemPrefab: configs[Id][1], NameTextId: configs[Id][2] })),
);
const configsById = new Map(materialConfigs.map(cfg => [cfg.Id, cfg]));

export const Materials = {
    getCfg(id: MaterialId): MaterialConfig | undefined {
        return configsById.get(id);
    },
    getCfgs(): readonly MaterialConfig[] {
        return materialConfigs;
    },
};
