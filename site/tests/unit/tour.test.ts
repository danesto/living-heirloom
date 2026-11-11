import { describe, expect, it } from 'vitest';

import type { DocumentPoint } from '../../src/data/schema';
import { tourOrder, tourStep } from '../../src/tour/tour';

function point(id: string, x: number, y: number): DocumentPoint {
  return {
    id,
    title: { sr: id },
    body: [{ sr: id }],
    region: { x: x - 0.01, y: y - 0.01, width: 0.02, height: 0.02 },
  };
}

describe('tourOrder', () => {
  it('goes top to bottom, then left to right within a row', () => {
    const points = [
      point('bottom', 0.5, 0.9),
      point('right', 0.8, 0.5),
      point('top', 0.5, 0.1),
      point('left', 0.2, 0.51),
    ];

    expect(tourOrder(points).map((p) => p.id)).toEqual(['top', 'left', 'right', 'bottom']);
  });

  it('prefers an explicit pin over the region center', () => {
    const late = { ...point('late', 0.5, 0.1), pin: { x: 0.5, y: 0.95 } };

    expect(tourOrder([late, point('mid', 0.5, 0.5)]).map((p) => p.id)).toEqual(['mid', 'late']);
  });

  it('does not mutate its input', () => {
    const points = [point('b', 0.5, 0.9), point('a', 0.5, 0.1)];

    tourOrder(points);

    expect(points.map((p) => p.id)).toEqual(['b', 'a']);
  });
});

describe('tourStep', () => {
  const ids = ['a', 'b', 'c'];

  it('reports neighbours in the middle', () => {
    expect(tourStep(ids, 'b')).toEqual({ index: 1, total: 3, previousId: 'a', nextId: 'c' });
  });

  it('does not wrap at the ends', () => {
    expect(tourStep(ids, 'a')?.previousId).toBeNull();
    expect(tourStep(ids, 'c')?.nextId).toBeNull();
  });

  it('returns null for unknown ids', () => {
    expect(tourStep(ids, 'x')).toBeNull();
  });
});
