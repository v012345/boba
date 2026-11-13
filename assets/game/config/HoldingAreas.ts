/** 暂存区 ID 对应的 Prefab 路径，相对 assets/resources。 */
const config = {
    holdingArea: 'prefabs/level/holding-area/HoldingArea',
} as const;

export type HoldingAreaId = keyof typeof config;
export interface HoldingAreaConfig {
    readonly Id: HoldingAreaId;
    readonly Prefab: string;
}

const configs: readonly HoldingAreaConfig[] = Object.freeze(
    (Object.keys(config) as HoldingAreaId[]).map(Id => Object.freeze({ Id, Prefab: config[Id] })),
);
const configsById = new Map(configs.map(cfg => [cfg.Id, cfg]));

export const HoldingAreas = {
    getCfg(id: HoldingAreaId): HoldingAreaConfig | undefined { return configsById.get(id); },
    getCfgs(): readonly HoldingAreaConfig[] { return configs; },
};
