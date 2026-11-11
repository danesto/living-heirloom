import { describe, expect, it } from 'vitest';

import pointsJson from '../../public/points.json';
import transcriptionJson from '../../public/transcription.json';

import {
  parseWith,
  pinPosition,
  pointsFileSchema,
  transcriptionFileSchema,
} from '../../src/data/schema';

const validPoint = {
  id: 'pecat',
  title: { sr: 'Печат' },
  body: [{ sr: 'Текст.' }],
  region: { x: 0.4, y: 0.8, width: 0.2, height: 0.1 },
};

describe('points schema', () => {
  it('accepts valid data', () => {
    expect(parseWith(pointsFileSchema, { points: [validPoint] }).ok).toBe(true);
  });

  it('rejects regions outside the image with a readable path', () => {
    const result = parseWith(pointsFileSchema, {
      points: [{ ...validPoint, region: { x: 0.9, y: 0.1, width: 0.2, height: 0.1 } }],
    });

    expect(result).toEqual({
      ok: false,
      errors: ['points.0.region: region must lie inside the image'],
    });
  });

  it('rejects coordinates that are not normalized', () => {
    const result = parseWith(pointsFileSchema, {
      points: [{ ...validPoint, pin: { x: 120, y: 0.5 } }],
    });

    expect(result.ok).toBe(false);
  });

  it('rejects duplicate ids, non-slug ids and unknown fields', () => {
    expect(parseWith(pointsFileSchema, { points: [validPoint, validPoint] }).ok).toBe(false);
    expect(parseWith(pointsFileSchema, { points: [{ ...validPoint, id: 'Печат' }] }).ok).toBe(
      false,
    );
    expect(parseWith(pointsFileSchema, { points: [{ ...validPoint, colour: 'red' }] }).ok).toBe(
      false,
    );
  });

  it('rejects non-objects', () => {
    expect(parseWith(pointsFileSchema, null)).toEqual({
      ok: false,
      errors: [expect.stringContaining('(root)')],
    });
  });

  it('defaults the pin to the region center', () => {
    expect(pinPosition(validPoint)).toEqual({ x: 0.5, y: 0.8500000000000001 });
  });
});

describe('shipped data files', () => {
  it('points.json is valid', () => {
    expect(parseWith(pointsFileSchema, pointsJson)).toMatchObject({ ok: true });
  });

  it('transcription.json is valid', () => {
    expect(parseWith(transcriptionFileSchema, transcriptionJson)).toMatchObject({ ok: true });
  });
});
