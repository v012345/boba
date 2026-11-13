/** 关卡背景 ID 对应 SpriteFrame 路径，相对 assets/resources。 */
const config = {
    underworldStall: ['images/level-backgrounds/underworld-stall/spriteFrame', 36],
} as const;

export type LevelBackgroundId = keyof typeof config;
export interface LevelBackgroundConfig {
    readonly Id: LevelBackgroundId;
    readonly SpriteFrame: string;
    /** 前景顶部的 Y 坐标，以 1280×720 画面中心为原点。 */
    readonly ForegroundTopY: number;
}

const configs: readonly LevelBackgroundConfig[] = Object.freeze(
    (Object.keys(config) as LevelBackgroundId[]).map(Id => Object.freeze({ Id, SpriteFrame: config[Id][0], ForegroundTopY: config[Id][1] })),
);
const configsById = new Map(configs.map(cfg => [cfg.Id, cfg]));

export const LevelBackgrounds = {
    getCfg(id: LevelBackgroundId): LevelBackgroundConfig | undefined { return configsById.get(id); },
    getCfgs(): readonly LevelBackgroundConfig[] { return configs; },
};
