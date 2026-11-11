/**
 * Guided tour logic: the order of points (top to bottom) and previous/next navigation.
 */
import { pinPosition, type DocumentPoint } from '../data/schema';

/** Points whose pins are within this vertical distance count as one "row". */
const ROW_TOLERANCE = 0.02;

/**
 * Sort points in reading order: top to bottom by pin, left to right within a row.
 *
 * @param points - Points in any order.
 * @returns A new array in tour order.
 */
export function tourOrder(points: readonly DocumentPoint[]): DocumentPoint[] {
  return [...points].sort((a, b) => {
    const pa = pinPosition(a);
    const pb = pinPosition(b);

    if (Math.abs(pa.y - pb.y) > ROW_TOLERANCE) {
      return pa.y - pb.y;
    }

    return pa.x - pb.x;
  });
}

/** Where a point sits in the tour. */
export interface TourStep {
  /** Zero-based index in tour order. */
  index: number;
  total: number;
  previousId: string | null;
  nextId: string | null;
}

/**
 * Position of a point in the tour and its neighbours (no wrap-around).
 *
 * @param orderedIds - Point ids in tour order.
 * @param id - The current point id.
 * @returns The step, or `null` if `id` is not part of the tour.
 */
export function tourStep(orderedIds: readonly string[], id: string): TourStep | null {
  const index = orderedIds.indexOf(id);

  if (index === -1) {
    return null;
  }

  return {
    index,
    total: orderedIds.length,
    previousId: orderedIds[index - 1] ?? null,
    nextId: orderedIds[index + 1] ?? null,
  };
}
