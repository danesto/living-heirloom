/**
 * Minimal observable store holding the UI state shared between modules.
 */

/** Which writing system Serbian text is shown in. */
export type Script = 'cyrl' | 'latn';

/** What the info panel / bottom sheet currently shows. */
export type PanelView = 'closed' | 'toc' | 'point' | 'transcription';

/** Shared UI state. */
export interface AppState {
  /** Selected point id (also reflected in the URL hash). */
  selectedId: string | null;
  /** Highlighted transcription line id. */
  lineId: string | null;
  view: PanelView;
  script: Script;
  pinsVisible: boolean;
}

/** Called with the new and previous state after every change. */
export type Listener = (state: Readonly<AppState>, previous: Readonly<AppState>) => void;

/** Read/update/subscribe access to the app state. */
export interface Store {
  get: () => Readonly<AppState>;
  set: (patch: Partial<AppState>) => void;
  subscribe: (listener: Listener) => () => void;
}

/**
 * Create a store. Listeners run synchronously after each change that alters a value.
 *
 * @param initial - Starting state.
 * @returns The store.
 */
export function createStore(initial: AppState): Store {
  let state: Readonly<AppState> = { ...initial };
  const listeners = new Set<Listener>();

  return {
    get: () => state,
    set: (patch) => {
      const next = { ...state, ...patch };
      const changed = (Object.keys(patch) as (keyof AppState)[]).some(
        (key) => next[key] !== state[key],
      );

      if (!changed) {
        return;
      }

      const previous = state;

      state = next;

      for (const listener of listeners) {
        listener(state, previous);
      }
    },
    subscribe: (listener) => {
      listeners.add(listener);

      return () => listeners.delete(listener);
    },
  };
}
