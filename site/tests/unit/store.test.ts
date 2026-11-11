import { describe, expect, it, vi } from 'vitest';

import { idFromHash, hashForId } from '../../src/state/hash';
import { createStore, type AppState } from '../../src/state/store';

const initial: AppState = {
  selectedId: null,
  lineId: null,
  view: 'closed',
  script: 'cyrl',
  pinsVisible: true,
};

describe('store', () => {
  it('notifies listeners with new and previous state', () => {
    const store = createStore(initial);
    const listener = vi.fn();

    store.subscribe(listener);

    store.set({ selectedId: 'pecat' });

    expect(store.get().selectedId).toBe('pecat');
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ selectedId: 'pecat' }),
      expect.objectContaining({ selectedId: null }),
    );
  });

  it('skips notifications when nothing changed', () => {
    const store = createStore(initial);
    const listener = vi.fn();

    store.subscribe(listener);

    store.set({ view: 'closed' });

    expect(listener).not.toHaveBeenCalled();
  });

  it('unsubscribes', () => {
    const store = createStore(initial);
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    unsubscribe();

    store.set({ pinsVisible: false });

    expect(listener).not.toHaveBeenCalled();
  });
});

describe('hash', () => {
  const ids = new Set(['pecat', 'medalja']);

  it('reads known ids, case-insensitively, with or without #', () => {
    expect(idFromHash('#pecat', ids)).toBe('pecat');
    expect(idFromHash('MEDALJA', ids)).toBe('medalja');
  });

  it('ignores unknown or empty hashes', () => {
    expect(idFromHash('#nema', ids)).toBeNull();
    expect(idFromHash('', ids)).toBeNull();
  });

  it('builds hashes', () => {
    expect(hashForId('pecat')).toBe('#pecat');
    expect(hashForId(null)).toBe('');
  });
});
