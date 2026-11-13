/** 垃圾桶 ID 对应的 Prefab 路径，路径相对 assets/resources。 */
const config = {
    bin: 'prefabs/level/equipment/Bin',
} as const;

export type BinId = keyof typeof config;
export interface BinConfig {
    readonly Id: BinId;
    readonly Prefab: string;
}

const configs: readonly BinConfig[] = Object.freeze(
    (Object.keys(config) as BinId[]).map(Id => Object.freeze({ Id, Prefab: config[Id] })),
);
const configsById = new Map(configs.map(cfg => [cfg.Id, cfg]));

export const Bins = {
    getCfg(id: BinId): BinConfig | undefined { return configsById.get(id); },
    getCfgs(): readonly BinConfig[] { return configs; },
};
