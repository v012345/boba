/** 拖放落点判定的纯计算部分，不依赖引擎。 */

/** 矩形，x、y 是左下角。 */
export interface DropRect { x: number; y: number; width: number; height: number }

export interface DropCandidate<T> {
    rect: DropRect;
    /** 松手点在矩形外多远以内仍算命中。0 表示必须落在矩形内。 */
    snapRadius: number;
    value: T;
}

/** 点到矩形的距离，点在矩形内时为 0。 */
export function distanceToRect(rect: DropRect, x: number, y: number): number {
    const dx = Math.max(rect.x - x, 0, x - rect.x - rect.width);
    const dy = Math.max(rect.y - y, 0, y - rect.y - rect.height);
    return Math.sqrt(dx * dx + dy * dy);
}

/**
 * 选出点 (x, y) 命中的候选项。
 * 先找直接包含该点的（靠前的优先）；没有的话，再在各自的 snapRadius 范围内找最近的。
 * 这样「差一点」的松手仍然算数，而 snapRadius 为 0 的目标绝不会被误触。
 */
export function pickDrop<T>(candidates: DropCandidate<T>[], x: number, y: number): T | null {
    for (const candidate of candidates) {
        if (distanceToRect(candidate.rect, x, y) === 0) return candidate.value;
    }
    let best: T | null = null;
    let bestDistance = Infinity;
    for (const candidate of candidates) {
        if (candidate.snapRadius <= 0) continue;
        const distance = distanceToRect(candidate.rect, x, y);
        if (distance <= candidate.snapRadius && distance <= bestDistance) { best = candidate.value; bestDistance = distance; }
    }
    return best;
}
