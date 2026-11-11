/**
 * Pure coordinate conversions between the three systems used in the app:
 *
 * - **normalized** (data files): 0–1 on both axes, relative to the image.
 * - **image pixels**: 0–width, 0–height of the current master image.
 * - **viewport** (OpenSeadragon): the image spans x 0–1 and y 0–(height / width).
 */
import type { ImagePoint, Region } from '../data/schema';

/** Pixel size of the displayed image. */
export interface ImageSize {
  width: number;
  height: number;
}

/** A rectangle in viewport units. */
export interface ViewportRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Height of the image in OpenSeadragon viewport units (its width is always 1).
 *
 * @param size - Image size in pixels.
 * @returns `height / width`.
 */
export function aspectRatio(size: ImageSize): number {
  return size.height / size.width;
}

/**
 * Convert a normalized image point to viewport coordinates.
 *
 * @param point - Normalized point.
 * @param size - Image size in pixels.
 * @returns The point in viewport units.
 */
export function normalizedToViewport(point: ImagePoint, size: ImageSize): ImagePoint {
  return { x: point.x, y: point.y * aspectRatio(size) };
}

/**
 * Convert a viewport point to normalized image coordinates (clamped to the image).
 *
 * @param point - Point in viewport units.
 * @param size - Image size in pixels.
 * @returns The normalized point.
 */
export function viewportToNormalized(point: ImagePoint, size: ImageSize): ImagePoint {
  return { x: clamp01(point.x), y: clamp01(point.y / aspectRatio(size)) };
}

/**
 * Convert a normalized region to a viewport rectangle.
 *
 * @param region - Normalized region.
 * @param size - Image size in pixels.
 * @returns The rectangle in viewport units.
 */
export function regionToViewport(region: Region, size: ImageSize): ViewportRect {
  const aspect = aspectRatio(size);

  return { x: region.x, y: region.y * aspect, width: region.width, height: region.height * aspect };
}

/**
 * Convert a normalized region to image pixels (for display in dev mode).
 *
 * @param region - Normalized region.
 * @param size - Image size in pixels.
 * @returns The region in whole pixels.
 */
export function regionToPixels(region: Region, size: ImageSize): Region {
  return {
    x: Math.round(region.x * size.width),
    y: Math.round(region.y * size.height),
    width: Math.round(region.width * size.width),
    height: Math.round(region.height * size.height),
  };
}

/**
 * Grow a rectangle by a fraction of its size on every side, so a fly-to target has some
 * breathing room around it.
 *
 * @param rect - Rectangle in any unit.
 * @param fraction - Padding per side, as a fraction of the larger side.
 * @returns The padded rectangle.
 */
export function padRect(rect: ViewportRect, fraction: number): ViewportRect {
  const pad = Math.max(rect.width, rect.height) * fraction;

  return {
    x: rect.x - pad,
    y: rect.y - pad,
    width: rect.width + 2 * pad,
    height: rect.height + 2 * pad,
  };
}

/**
 * Normalized region spanned by two corner points clicked in any order.
 *
 * @param a - First corner.
 * @param b - Opposite corner.
 * @returns The region, rounded to 4 decimals (≈ 0.1 px on a 1000 px image).
 */
export function regionFromCorners(a: ImagePoint, b: ImagePoint): Region {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);

  return {
    x: round4(x),
    y: round4(y),
    width: round4(Math.max(Math.abs(a.x - b.x), 0.001)),
    height: round4(Math.max(Math.abs(a.y - b.y), 0.001)),
  };
}

/**
 * Round to 4 decimals, the precision stored in the data files.
 *
 * @param value - Any number.
 * @returns The rounded number.
 */
export function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
