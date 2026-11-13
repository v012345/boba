/** 关卡背景 ID 对应 SpriteFrame 路径，相对 assets/resources。 */
const config = {
    underworldStall: 'images/level-backgrounds/underworld-stall/spriteFrame',
} as const;

export type LevelBackgroundId = keyof typeof config;
export interface LevelBackgroundConfig {
    readonly Id: LevelBackgroundId;
    readonly SpriteFrame: string;
}

const configs: readonly LevelBackgroundConfig[] = Object.freeze(
    (Object.keys(config) as LevelBackgroundId[]).map(Id => Object.freeze({ Id, SpriteFrame: config[Id] })),
);
const configsById = new Map(configs.map(cfg => [cfg.Id, cfg]));

export const LevelBackgrounds = {
    getCfg(id: LevelBackgroundId): LevelBackgroundConfig | undefined { return configsById.get(id); },
    getCfgs(): readonly LevelBackgroundConfig[] { return configs; },
};
