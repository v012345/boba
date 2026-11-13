import type { MaterialId } from './Materials';
import type { ContainerId } from './Containers';
import type { WorkbenchId } from './Workbenches';
import type { BinId } from './Bins';
import type { HoldingAreaId } from './HoldingAreas';
import type { LevelBackgroundId } from './LevelBackgrounds';

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

export interface LevelWorkbench {
    readonly Id: WorkbenchId;
    readonly X: number;
    readonly Y: number;
}

export interface LevelBin {
    readonly Id: BinId;
    readonly X: number;
    readonly Y: number;
}

export interface LevelHoldingArea {
    readonly Id: HoldingAreaId;
    readonly X: number;
    readonly Y: number;
    readonly Capacity: number;
}

export interface LevelContentConfig {
    readonly Id: string;
    readonly Background: LevelBackgroundId;
    readonly Materials: readonly LevelMaterial[];
    readonly Containers: readonly LevelContainer[];
    readonly Workbench: LevelWorkbench;
    readonly Bin: LevelBin;
    readonly HoldingArea?: LevelHoldingArea;
}

/** 每关依次填写材料、容器、工作台、垃圾桶、背景 ID 和可选暂存区；暂存区格式为 [ID, X, Y, 容量]。坐标以页面中心为原点。 */
type Placement<Id extends string> = readonly [Id, number, number];
const config: Readonly<Record<string, readonly [
    materials: readonly Placement<MaterialId>[],
    containers: readonly Placement<ContainerId>[],
    workbench: Placement<WorkbenchId>,
    bin: Placement<BinId>,
    background: LevelBackgroundId,
    holdingArea?: readonly [HoldingAreaId, number, number, number],
]>> = {
    level_001: [[
        ['tea', -240, 0],
        ['milk', 0, 0],
        ['pearl', 240, 0],
    ], [['bowlStack', -450, -200],['cupStack', 450, -200]], ['workbench', 0, -200], ['bin', 550, -200], 'underworldStall', ['holdingArea', 0, 150, 2]],
    level_002: [[
        ['bone', -240, 0],
        ['organs', 0, 0],
        ['flesh', 240, 0],
    ], [['bowlStack', -450, -200]], ['workbench', 0, -200], ['bin', 550, -200], 'underworldStall'],
    level_003: [[
        ['poop', -240, 0],
        ['bone', 0, 0],
        ['organs', 240, 0],
    ], [['bowlStack', -450, -200]], ['workbench', 0, -200], ['bin', 550, -200], 'underworldStall'],
    level_004: [[
        ['flesh', -240, 100],
        ['bone', 0, 100],
        ['poop', 240, 100],
        ['organs', 0, -120],
    ], [['bowlStack', -450, -200]], ['workbench', 0, -200], ['bin', 550, -200], 'underworldStall'],
    level_005: [[
        ['organs', -300, 80],
        ['flesh', -100, 80],
        ['bone', 100, 80],
        ['poop', 300, 80],
    ], [['bowlStack', -450, -200]], ['workbench', 0, -200], ['bin', 550, -200], 'underworldStall'],
};

const configs: readonly LevelContentConfig[] = Object.freeze(Object.keys(config).map(Id => {
        const holdingArea = config[Id][5];
        if (holdingArea && (!Number.isInteger(holdingArea[3]) || holdingArea[3] < 1)) {
            throw new Error(`关卡 ${Id} 的暂存区容量必须是大于零的整数`);
        }
        return Object.freeze({
            Id,
            Background: config[Id][4],
            Materials: Object.freeze(config[Id][0].map(([materialId, X, Y]) => Object.freeze({ Id: materialId, X, Y }))),
            Containers: Object.freeze(config[Id][1].map(([containerId, X, Y]) => Object.freeze({ Id: containerId, X, Y }))),
            Workbench: Object.freeze({ Id: config[Id][2][0], X: config[Id][2][1], Y: config[Id][2][2] }),
            Bin: Object.freeze({ Id: config[Id][3][0], X: config[Id][3][1], Y: config[Id][3][2] }),
            HoldingArea: holdingArea ? Object.freeze({ Id: holdingArea[0], X: holdingArea[1], Y: holdingArea[2], Capacity: holdingArea[3] }) : undefined,
        });
}));
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
