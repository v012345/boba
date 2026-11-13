/** 容器 ID 对应的 Prefab 路径，路径相对 assets/resources。 */
const config = {
    bowlStack: 'prefabs/level/containers/BowlStack',
    cupStack: 'prefabs/level/containers/CupStack',
} as const;

export type ContainerId = keyof typeof config;
export interface ContainerConfig {
    readonly Id: ContainerId;
    readonly Prefab: string;
}

const configs: readonly ContainerConfig[] = Object.freeze(
    (Object.keys(config) as ContainerId[]).map(Id => Object.freeze({ Id, Prefab: config[Id] })),
);
const configsById = new Map(configs.map(cfg => [cfg.Id, cfg]));

export const Containers = {
    getCfg(id: ContainerId): ContainerConfig | undefined { return configsById.get(id); },
    getCfgs(): readonly ContainerConfig[] { return configs; },
};
