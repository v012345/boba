import type { MaterialId } from './Materials';

export interface LevelMaterial {
    readonly Id: MaterialId;
    /** 以关卡页面中心为原点。 */
    readonly X: number;
    readonly Y: number;
}

export interface LevelMaterialsConfig {
    readonly Id: string;
    readonly Materials: readonly LevelMaterial[];
}

/** 每关只填写 [材料 ID, X, Y]；材料 ID 对应 Materials.ts 中的配置。 */
const config: Readonly<Record<string, readonly (readonly [MaterialId, number, number])[]>> = {
    level_001: [
        ['tea', -240, 0],
        ['milk', 0, 0],
        ['pearl', 240, 0],
    ],
    level_002: [
        ['bone', -240, 0],
        ['organs', 0, 0],
        ['flesh', 240, 0],
    ],
    level_003: [
        ['poop', -240, 0],
        ['bone', 0, 0],
        ['organs', 240, 0],
    ],
    level_004: [
        ['flesh', -240, 100],
        ['bone', 0, 100],
        ['poop', 240, 100],
        ['organs', 0, -120],
    ],
    level_005: [
        ['organs', -300, 80],
        ['flesh', -100, 80],
        ['bone', 100, 80],
        ['poop', 300, 80],
    ],
};

const configs: readonly LevelMaterialsConfig[] = Object.freeze(Object.keys(config).map(Id =>
    Object.freeze({
        Id,
        Materials: Object.freeze(config[Id].map(([materialId, X, Y]) => Object.freeze({ Id: materialId, X, Y }))),
    }),
));
const configsById = new Map(configs.map(cfg => [cfg.Id, cfg]));

export const LevelMaterials = {
    /** 未配置时沿用第一关配置。 */
    getCfg(id: string): LevelMaterialsConfig | undefined {
        return configsById.get(id) ?? configsById.get('level_001');
    },
    getCfgs(): readonly LevelMaterialsConfig[] {
        return configs;
    },
};
