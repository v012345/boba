import type { MaterialId } from './Materials';

/** 订单只指定材料 ID；重复 ID 表示需要多份。 */
const config = {
    milkTea: ['tea', 'milk'],
    pearlMilkTea: ['tea', 'milk', 'pearl'],
} as const satisfies Readonly<Record<string, readonly MaterialId[]>>;

export type LevelOrderId = keyof typeof config;
export interface LevelOrderConfig {
    readonly Id: LevelOrderId;
    readonly Materials: readonly MaterialId[];
}

const configs: readonly LevelOrderConfig[] = Object.freeze(
    (Object.keys(config) as LevelOrderId[]).map(Id => Object.freeze({ Id, Materials: Object.freeze([...config[Id]]) })),
);
const configsById = new Map(configs.map(cfg => [cfg.Id, cfg]));

export const LevelOrders = {
    getCfg(id: LevelOrderId): LevelOrderConfig | undefined { return configsById.get(id); },
    getCfgs(): readonly LevelOrderConfig[] { return configs; },
};
