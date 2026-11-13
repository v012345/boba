/** 材料 ID 对应的 Prefab 路径，路径相对 assets/resources。 */
const configs = {
    tea: 'prefabs/level/materials/TeaPot',
    milk: 'prefabs/level/materials/MilkJug',
    pearl: 'prefabs/level/materials/PearlTray',
    jelly: 'prefabs/level/materials/JellyTray',
    bone: 'prefabs/level/materials/Bone',
    flesh: 'prefabs/level/materials/Flesh',
    organs: 'prefabs/level/materials/Organs',
    poop: 'prefabs/level/materials/Poop',
} as const;

export type MaterialId = keyof typeof configs;

export interface MaterialConfig {
    readonly Id: MaterialId;
    /** 相对 assets/resources 的 Prefab 路径。 */
    readonly Prefab: string;
}

const materialConfigs: readonly MaterialConfig[] = Object.freeze(
    (Object.keys(configs) as MaterialId[]).map(Id => Object.freeze({ Id, Prefab: configs[Id] })),
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
