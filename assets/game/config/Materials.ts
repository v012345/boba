/** 材料 ID 对应 [来源 Prefab, 单个材料 Prefab]，路径相对 assets/resources。 */
const configs = {
    tea: ['prefabs/level/materials/trays/TeaPot', 'prefabs/level/materials/items/Tea'],
    milk: ['prefabs/level/materials/trays/MilkJug', 'prefabs/level/materials/items/MilkJug'],
    pearl: ['prefabs/level/materials/trays/PearlTray', 'prefabs/level/materials/items/Pearl'],
    jelly: ['prefabs/level/materials/trays/JellyTray', 'prefabs/level/materials/items/Jelly'],
    bone: ['prefabs/level/materials/trays/BoneTray', 'prefabs/level/materials/items/Bone'],
    flesh: ['prefabs/level/materials/trays/FleshTray', 'prefabs/level/materials/items/Flesh'],
    organs: ['prefabs/level/materials/trays/OrgansTray', 'prefabs/level/materials/items/Organs'],
    poop: ['prefabs/level/materials/trays/PoopTray', 'prefabs/level/materials/items/Poop'],
} as const;

export type MaterialId = keyof typeof configs;

export interface MaterialConfig {
    readonly Id: MaterialId;
    /** 相对 assets/resources 的 Prefab 路径。 */
    readonly Prefab: string;
    /** 从来源取出的单个材料 Prefab。 */
    readonly ItemPrefab: string;
}

const materialConfigs: readonly MaterialConfig[] = Object.freeze(
    (Object.keys(configs) as MaterialId[]).map(Id => Object.freeze({ Id, Prefab: configs[Id][0], ItemPrefab: configs[Id][1] })),
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
