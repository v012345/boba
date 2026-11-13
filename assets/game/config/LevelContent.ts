import type { MaterialId } from './Materials';
import type { ContainerId } from './Containers';

export interface LevelMaterial {
    readonly Id: MaterialId;
    /** 以关卡页面中心为原点。 */
    readonly X: number;
    readonly Y: number;
}

export interface LevelContainer {
    readonly Id: ContainerId;
    readonly X: number;
    readonly Y: number;
}

export interface LevelContentConfig {
    readonly Id: string;
    readonly Materials: readonly LevelMaterial[];
    readonly Containers: readonly LevelContainer[];
}

/** 每关依次填写材料和容器，每项为 [ID, X, Y]，坐标以页面中心为原点。 */
type Placement<Id extends string> = readonly [Id, number, number];
const config: Readonly<Record<string, readonly [
    materials: readonly Placement<MaterialId>[],
    containers: readonly Placement<ContainerId>[],
]>> = {
    level_001: [[
        ['tea', -240, 0],
        ['milk', 0, 0],
        ['pearl', 240, 0],
    ], [['bowlStack', -450, -200],['cupStack', 450, -200]]],
    level_002: [[
        ['bone', -240, 0],
        ['organs', 0, 0],
        ['flesh', 240, 0],
    ], [['bowlStack', -450, -200]]],
    level_003: [[
        ['poop', -240, 0],
        ['bone', 0, 0],
        ['organs', 240, 0],
    ], [['bowlStack', -450, -200]]],
    level_004: [[
        ['flesh', -240, 100],
        ['bone', 0, 100],
        ['poop', 240, 100],
        ['organs', 0, -120],
    ], [['bowlStack', -450, -200]]],
    level_005: [[
        ['organs', -300, 80],
        ['flesh', -100, 80],
        ['bone', 100, 80],
        ['poop', 300, 80],
    ], [['bowlStack', -450, -200]]],
};

const configs: readonly LevelContentConfig[] = Object.freeze(Object.keys(config).map(Id =>
    Object.freeze({
        Id,
        Materials: Object.freeze(config[Id][0].map(([materialId, X, Y]) => Object.freeze({ Id: materialId, X, Y }))),
        Containers: Object.freeze(config[Id][1].map(([containerId, X, Y]) => Object.freeze({ Id: containerId, X, Y }))),
    }),
));
const configsById = new Map(configs.map(cfg => [cfg.Id, cfg]));

export const LevelContent = {
    /** 未配置时沿用第一关配置。 */
    getCfg(id: string): LevelContentConfig | undefined {
        return configsById.get(id) ?? configsById.get('level_001');
    },
    getCfgs(): readonly LevelContentConfig[] {
        return configs;
    },
};
