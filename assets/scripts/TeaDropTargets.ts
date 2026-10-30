/** Root UI coordinates (1280x720). Shared by hit testing and drop-zone feedback. */
export interface DropRect { x: number; y: number; width: number; height: number }
export interface DropTarget { kind: 'trash' | 'machine' | 'customer'; slot: number; rect: DropRect }
const TRASH: DropRect = { x: -515, y: -309, width: 190, height: 118 };
const MACHINE: DropRect = { x: 22, y: -177, width: 206, height: 210 };
export function dropZones(occupied: boolean[]): DropTarget[] {
    const zones: DropTarget[] = [
        { kind: 'trash', slot: 0, rect: TRASH },
        { kind: 'machine', slot: 0, rect: MACHINE },
    ];
    occupied.forEach((present, slot) => {
        if (present) zones.push({ kind: 'customer', slot, rect: { x: -565 + slot * 390, y: 48, width: 350, height: 220 } });
    });
    return zones;
}
function inside(rect: DropRect, x: number, y: number) {
    return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
}
function gap(rect: DropRect, x: number, y: number) {
    const dx = Math.max(rect.x - x, 0, x - rect.x - rect.width);
    const dy = Math.max(rect.y - y, 0, y - rect.y - rect.height);
    return Math.sqrt(dx * dx + dy * dy);
}
export function findDropTarget(x: number, y: number, occupied: boolean[]): DropTarget | null {
    return dropZones(occupied).find(target => inside(target.rect, x, y)) || null;
}
/**
 * Forgiving pick for the release point: fixed equipment (bin, sealer) accepts a
 * release a little outside its rect so a nearly-right drop still counts.
 * Customers stay exact, otherwise a near miss could become the wrong order.
 */
export function findSnapTarget(x: number, y: number, occupied: boolean[], radius: number): DropTarget | null {
    let best: DropTarget | null = null, bestGap = radius;
    dropZones(occupied).forEach(target => {
        if (target.kind === 'customer') return;
        const distance = gap(target.rect, x, y);
        if (distance <= bestGap) { best = target; bestGap = distance; }
    });
    return best;
}
