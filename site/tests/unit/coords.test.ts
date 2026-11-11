import { describe, expect, it } from 'vitest';

import {
  normalizedToViewport,
  padRect,
  regionFromCorners,
  regionToPixels,
  regionToViewport,
  viewportToNormalized,
} from '../../src/viewer/coords';

const size = { width: 1000, height: 1500 };

describe('coordinate conversion', () => {
  it('scales y by the aspect ratio in viewport space', () => {
    expect(normalizedToViewport({ x: 0.5, y: 1 }, size)).toEqual({ x: 0.5, y: 1.5 });
  });

  it('round-trips normalized → viewport → normalized', () => {
    const point = { x: 0.25, y: 0.75 };

    expect(viewportToNormalized(normalizedToViewport(point, size), size)).toEqual(point);
  });

  it('clamps viewport points outside the image', () => {
    expect(viewportToNormalized({ x: -0.2, y: 2 }, size)).toEqual({ x: 0, y: 1 });
  });

  it('converts regions to viewport and pixel space', () => {
    const region = { x: 0.1, y: 0.2, width: 0.3, height: 0.4 };

    expect(regionToViewport(region, size)).toEqual({
      x: 0.1,
      y: 0.30000000000000004,
      width: 0.3,
      height: 0.6000000000000001,
    });
    expect(regionToPixels(region, size)).toEqual({ x: 100, y: 300, width: 300, height: 600 });
  });

  it('pads rectangles evenly by the larger side', () => {
    expect(padRect({ x: 1, y: 1, width: 2, height: 1 }, 0.5)).toEqual({
      x: 0,
      y: 0,
      width: 4,
      height: 3,
    });
  });

  it('builds a region from corners clicked in any order', () => {
    expect(regionFromCorners({ x: 0.6, y: 0.1 }, { x: 0.2, y: 0.5 })).toEqual({
      x: 0.2,
      y: 0.1,
      width: 0.4,
      height: 0.4,
    });
  });
});
