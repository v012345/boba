/** 容器 ID 对应的 Prefab 路径，路径相对 assets/resources。 */
const config = {
    bowlStack: ['prefabs/level/containers/BowlStack', 'prefabs/level/containers/Bowl'],
    cupStack: ['prefabs/level/containers/CupStack', 'prefabs/level/containers/Cup'],
} as const;

export type ContainerId = keyof typeof config;
export interface ContainerConfig {
    readonly Id: ContainerId;
    readonly Prefab: string;
    /** 点击这一摞时取出的单个容器。 */
    readonly ItemPrefab: string;
}

const configs: readonly ContainerConfig[] = Object.freeze(
    (Object.keys(config) as ContainerId[]).map(Id => Object.freeze({ Id, Prefab: config[Id][0], ItemPrefab: config[Id][1] })),
);
const configsById = new Map(configs.map(cfg => [cfg.Id, cfg]));

export const Containers = {
    getCfg(id: ContainerId): ContainerConfig | undefined { return configsById.get(id); },
    getCfgs(): readonly ContainerConfig[] { return configs; },
};
