/**
 * Pure maths for the mobile bottom sheet: which snap point to settle on after a drag.
 */

/** How far ahead (ms) a fling is projected when choosing the snap point. */
const FLING_PROJECTION_MS = 180;

/**
 * Pick the snap height closest to where the drag would end with its current velocity.
 *
 * @param snaps - Allowed visible heights in px (any order, at least one).
 * @param height - Current visible height in px.
 * @param velocity - Growth speed in px/ms (positive = dragging up / growing).
 * @returns The chosen snap height.
 */
export function snapHeight(snaps: readonly number[], height: number, velocity: number): number {
  const projected = height + velocity * FLING_PROJECTION_MS;
  let best = snaps[0] ?? height;

  for (const snap of snaps) {
    if (Math.abs(snap - projected) < Math.abs(best - projected)) {
      best = snap;
    }
  }

  return best;
}

/**
 * Clamp a dragged height to the allowed range, with rubber-banding past the ends.
 *
 * @param height - Raw height from the pointer position.
 * @param min - Smallest snap height.
 * @param max - Largest snap height.
 * @returns The height to render.
 */
export function clampHeight(height: number, min: number, max: number): number {
  if (height > max) {
    return max + (height - max) * 0.2;
  }

  if (height < min) {
    return min - (min - height) * 0.2;
  }

  return height;
}
