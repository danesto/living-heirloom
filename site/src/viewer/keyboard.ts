/**
 * Keyboard shortcuts for the viewer, as a pure key → action mapping.
 */

/** Something the viewer can do in response to a key. */
export type ViewerAction =
  { kind: 'pan'; dx: number; dy: number } | { kind: 'zoom'; factor: number } | { kind: 'home' };

/** Fraction of the visible area panned per arrow-key press (Shift pans further). */
const PAN_STEP = 0.1;
const PAN_STEP_FAST = 0.3;
const ZOOM_STEP = 1.25;

/**
 * Map a keyboard event to a viewer action.
 *
 * @param key - `KeyboardEvent.key`.
 * @param shift - Whether Shift is held.
 * @returns The action, or `null` if the key is not a viewer shortcut.
 */
export function keyToAction(key: string, shift: boolean): ViewerAction | null {
  const step = shift ? PAN_STEP_FAST : PAN_STEP;

  switch (key) {
    case 'ArrowLeft':
      return { kind: 'pan', dx: -step, dy: 0 };
    case 'ArrowRight':
      return { kind: 'pan', dx: step, dy: 0 };
    case 'ArrowUp':
      return { kind: 'pan', dx: 0, dy: -step };
    case 'ArrowDown':
      return { kind: 'pan', dx: 0, dy: step };
    case '+':
    case '=':
      return { kind: 'zoom', factor: ZOOM_STEP };
    case '-':
    case '_':
      return { kind: 'zoom', factor: 1 / ZOOM_STEP };
    case '0':
    case 'Home':
      return { kind: 'home' };
    default:
      return null;
  }
}
