import { describe, expect, it } from 'vitest';

import { toLatin } from '../../src/i18n/transliterate';

describe('toLatin', () => {
  it('maps every letter of the alphabet', () => {
    expect(toLatin('абвгдђежзијклљмнњопрстћуфхцчџш')).toBe('abvgdđežzijklljmnnjoprstćufhcčdžš');
  });

  it('keeps capitalisation, using title case for digraphs in normal words', () => {
    expect(toLatin('Његово Величанство')).toBe('Njegovo Veličanstvo');
    expect(toLatin('Љубав и Џак')).toBe('Ljubav i Džak');
  });

  it('uses all caps digraphs inside all-caps words', () => {
    expect(toLatin('КРАЉ СРБА')).toBe('KRALJ SRBA');
    expect(toLatin('ЊЕГОВО')).toBe('NJEGOVO');
  });

  it('passes through digits, punctuation and Latin letters', () => {
    expect(toLatin('К.О. № 7517, Александар I.')).toBe('K.O. № 7517, Aleksandar I.');
  });
});
