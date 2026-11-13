/** 工作台 ID 对应的 Prefab 路径，路径相对 assets/resources。 */
const config = {
    workbench: 'prefabs/level/Workbench',
} as const;

export type WorkbenchId = keyof typeof config;
export interface WorkbenchConfig {
    readonly Id: WorkbenchId;
    readonly Prefab: string;
}

const configs: readonly WorkbenchConfig[] = Object.freeze(
    (Object.keys(config) as WorkbenchId[]).map(Id => Object.freeze({ Id, Prefab: config[Id] })),
);
const configsById = new Map(configs.map(cfg => [cfg.Id, cfg]));

export const Workbenches = {
    getCfg(id: WorkbenchId): WorkbenchConfig | undefined { return configsById.get(id); },
    getCfgs(): readonly WorkbenchConfig[] { return configs; },
};
