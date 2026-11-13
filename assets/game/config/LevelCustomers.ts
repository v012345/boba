/** 关卡顾客 ID 对应的图片，路径相对 assets/resources。 */
const config = {
    wanderingGhost: 'images/customers/wandering-ghost/spriteFrame',
    ghostBride: 'images/customers/ghost-bride/spriteFrame',
    ghostScholar: 'images/customers/ghost-scholar/spriteFrame',
} as const;

export type LevelCustomerId = keyof typeof config;
export interface LevelCustomerConfig {
    readonly Id: LevelCustomerId;
    readonly Prefab: string;
    readonly SpriteFrame: string;
}

/** 三位顾客复用同一个 Prefab，通过 SpriteFrame 区分形象。 */
const CUSTOMER_PREFAB = 'prefabs/level/customers/Customer';
const configs: readonly LevelCustomerConfig[] = Object.freeze(
    (Object.keys(config) as LevelCustomerId[]).map(Id => Object.freeze({
        Id, Prefab: CUSTOMER_PREFAB, SpriteFrame: config[Id],
    })),
);
const configsById = new Map(configs.map(cfg => [cfg.Id, cfg]));

export const LevelCustomers = {
    getCfg(id: LevelCustomerId): LevelCustomerConfig | undefined { return configsById.get(id); },
    getCfgs(): readonly LevelCustomerConfig[] { return configs; },
};
