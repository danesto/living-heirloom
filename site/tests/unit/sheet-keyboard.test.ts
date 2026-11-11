import { describe, expect, it } from 'vitest';

import { clampHeight, snapHeight } from '../../src/panel/sheetMath';
import { keyToAction } from '../../src/viewer/keyboard';

describe('snapHeight', () => {
  const snaps = [100, 400, 800];

  it('snaps to the nearest height when released slowly', () => {
    expect(snapHeight(snaps, 380, 0)).toBe(400);
    expect(snapHeight(snaps, 200, 0)).toBe(100);
  });

  it('follows a fling past the nearest snap', () => {
    expect(snapHeight(snaps, 420, 2.5)).toBe(800);
    expect(snapHeight(snaps, 380, -2)).toBe(100);
  });
});

describe('clampHeight', () => {
  it('passes through heights inside the range and rubber-bands outside', () => {
    expect(clampHeight(300, 100, 800)).toBe(300);
    expect(clampHeight(900, 100, 800)).toBe(820);
    expect(clampHeight(50, 100, 800)).toBe(90);
  });
});

describe('keyToAction', () => {
  it('maps arrows to pans, faster with shift', () => {
    expect(keyToAction('ArrowLeft', false)).toEqual({ kind: 'pan', dx: -0.1, dy: 0 });
    expect(keyToAction('ArrowDown', true)).toEqual({ kind: 'pan', dx: 0, dy: 0.3 });
  });

  it('maps +/- (including unshifted =) to zoom and 0 to home', () => {
    expect(keyToAction('+', false)).toEqual({ kind: 'zoom', factor: 1.25 });
    expect(keyToAction('=', false)).toEqual({ kind: 'zoom', factor: 1.25 });
    expect(keyToAction('-', false)).toEqual({ kind: 'zoom', factor: 0.8 });
    expect(keyToAction('0', false)).toEqual({ kind: 'home' });
  });

  it('ignores other keys', () => {
    expect(keyToAction('a', false)).toBeNull();
  });
});
