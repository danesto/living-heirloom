/**
 * Mobile bottom sheet: the panel slides up from the bottom and can be dragged between
 * three heights (peek, half, full). Only active in the phone layout.
 */
import { isMobileLayout } from '../ui/dom';
import { clampHeight, snapHeight } from './sheetMath';

/** Named resting heights of the sheet. */
export type SheetSnap = 'peek' | 'half' | 'full';

/** Controls for the bottom sheet. */
export interface Sheet {
  snapTo: (snap: SheetSnap) => void;
  /** Current snap (meaningful in the phone layout only). */
  snap: () => SheetSnap;
  /** Visible height in px once the current animation finishes (0 in desktop layout). */
  visibleHeight: () => number;
  /** Recompute sizes after a layout change. */
  refresh: () => void;
}

/** Callbacks from the sheet. */
export interface SheetHandlers {
  /** The visible height changed (after a drag or snap). */
  onResize: () => void;
  /** The user dragged the sheet down past the smallest height. */
  onDismiss: () => void;
}

const DRAG_THRESHOLD_PX = 6;
const DISMISS_RATIO = 0.6;

/**
 * Turn the panel into a draggable bottom sheet on phones.
 *
 * @param panel - The panel element.
 * @param grip - Drag area (the handle strip and the header).
 * @param handle - Handle button (keyboard: cycles the snap heights).
 * @param body - Scrollable content (made `inert` while only the header peeks out).
 * @param handlers - Callbacks.
 * @returns Controls for the sheet.
 */
export function createSheet(
  panel: HTMLElement,
  grip: HTMLElement,
  handle: HTMLButtonElement,
  body: HTMLElement,
  handlers: SheetHandlers,
): Sheet {
  let current: SheetSnap = 'peek';
  let height = 0;

  const peekHeight = (): number => grip.offsetHeight + 4;
  // The sheet animates its height; its maximum comes from CSS (`--sheet-max`).
  const fullHeight = (): number => {
    const max = Number.parseFloat(getComputedStyle(panel).maxHeight);

    return Number.isFinite(max) ? max : window.innerHeight * 0.85;
  };
  const heights = (): Record<SheetSnap, number> => {
    const full = fullHeight();
    const peek = Math.min(peekHeight(), full);

    return { peek, half: Math.max(peek, Math.round(full * 0.55)), full };
  };

  const render = (px: number): void => {
    height = px;
    panel.style.setProperty('--sheet-visible', `${String(Math.round(px))}px`);
  };

  const apply = (snap: SheetSnap): void => {
    current = snap;

    if (!isMobileLayout()) {
      panel.style.removeProperty('--sheet-visible');
      body.inert = false;
      handle.setAttribute('aria-expanded', 'true');

      return;
    }

    render(heights()[snap]);
    body.inert = snap === 'peek';
    handle.setAttribute('aria-expanded', String(snap !== 'peek'));
    handlers.onResize();
  };

  handle.addEventListener('click', () => {
    const order: SheetSnap[] = ['peek', 'half', 'full'];

    apply(order[(order.indexOf(current) + 1) % order.length] ?? 'peek');
  });

  let drag: {
    startY: number;
    startHeight: number;
    lastY: number;
    lastT: number;
    velocity: number;
    active: boolean;
  } | null = null;

  grip.addEventListener('pointerdown', (event) => {
    if (!isMobileLayout() || event.button !== 0) {
      return;
    }

    drag = {
      startY: event.clientY,
      startHeight: height,
      lastY: event.clientY,
      lastT: event.timeStamp,
      velocity: 0,
      active: false,
    };
  });

  grip.addEventListener('pointermove', (event) => {
    if (drag === null) {
      return;
    }

    if (!drag.active && Math.abs(event.clientY - drag.startY) > DRAG_THRESHOLD_PX) {
      drag.active = true;
      grip.setPointerCapture(event.pointerId);
      panel.classList.add('is-dragging');
    }

    if (drag.active) {
      const dt = Math.max(1, event.timeStamp - drag.lastT);

      drag.velocity = (drag.lastY - event.clientY) / dt;
      drag.lastY = event.clientY;
      drag.lastT = event.timeStamp;
      const { peek, full } = heights();

      render(clampHeight(drag.startHeight + drag.startY - event.clientY, peek, full));
    }
  });

  const endDrag = (): void => {
    if (drag === null) {
      return;
    }

    const wasActive = drag.active;
    const velocity = drag.velocity;

    drag = null;
    panel.classList.remove('is-dragging');

    if (!wasActive) {
      return;
    }

    // Swallow the click that follows a drag so header buttons don't fire. Browsers don't
    // always send one, so stop listening shortly after.
    const swallow = (event: Event): void => {
      event.stopPropagation();
    };

    grip.addEventListener('click', swallow, { capture: true, once: true });
    window.setTimeout(() => {
      grip.removeEventListener('click', swallow, { capture: true });
    }, 300);

    const snaps = heights();

    if (height + velocity * 180 < snaps.peek * DISMISS_RATIO) {
      handlers.onDismiss();

      return;
    }

    const target = snapHeight(Object.values(snaps), height, velocity);
    const name = (Object.keys(snaps) as SheetSnap[]).find((key) => snaps[key] === target) ?? 'peek';

    apply(name);
  };

  grip.addEventListener('pointerup', endDrag);
  grip.addEventListener('pointercancel', endDrag);

  return {
    snapTo: apply,
    snap: () => current,
    visibleHeight: () => (isMobileLayout() ? height : 0),
    refresh: () => {
      apply(current);
    },
  };
}
