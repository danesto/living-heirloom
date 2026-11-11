/**
 * Numbered pins and region highlights, drawn as OpenSeadragon overlays.
 *
 * Pins are anchored to a point, so they keep their screen size at every zoom level;
 * highlights are anchored to a rectangle, so they scale with the image.
 */
import OpenSeadragon from 'openseadragon';

import { pinPosition, type DocumentPoint, type Region } from '../data/schema';
import { h } from '../ui/dom';
import { normalizedToViewport, regionToViewport } from '../viewer/coords';
import type { DocumentViewer } from '../viewer/viewer';

/** Callbacks from the pin layer. */
export interface PinHandlers {
  onSelect: (id: string) => void;
}

/** Controls for the pin layer. */
export interface PinLayer {
  /** Replace all pins (points must be in tour order; numbers follow that order). */
  setPoints: (
    points: readonly DocumentPoint[],
    label: (point: DocumentPoint, number: number) => string,
  ) => void;
  setSelected: (id: string | null) => void;
  setVisible: (visible: boolean) => void;
  /** Highlight a transcription line (or clear with `null`). */
  setLineRegion: (region: Region | null) => void;
}

/**
 * Create the pin layer on a viewer.
 *
 * @param viewer - The document viewer.
 * @param handlers - Selection callback.
 * @returns Controls for the layer.
 */
export function createPinLayer(viewer: DocumentViewer, handlers: PinHandlers): PinLayer {
  const { osd, imageSize } = viewer;
  const pointHighlight = h('div', { class: 'region region--point', 'aria-hidden': 'true' });
  const lineHighlight = h('div', { class: 'region region--line', 'aria-hidden': 'true' });
  const pins = new Map<string, HTMLButtonElement>();
  let points: readonly DocumentPoint[] = [];
  let selectedId: string | null = null;
  let hoveredId: string | null = null;

  const toRect = (region: Region): OpenSeadragon.Rect => {
    const rect = regionToViewport(region, imageSize);

    return new OpenSeadragon.Rect(rect.x, rect.y, rect.width, rect.height);
  };

  const placeHighlight = (element: HTMLElement, region: Region | null): void => {
    element.classList.toggle('is-visible', region !== null);

    if (region !== null) {
      osd.updateOverlay(element, toRect(region));
    }
  };

  const refreshPointHighlight = (): void => {
    const id = hoveredId ?? selectedId;
    const point = points.find((p) => p.id === id);

    placeHighlight(pointHighlight, point?.region ?? null);
  };

  osd.addOverlay({ element: pointHighlight, location: new OpenSeadragon.Rect(0, 0, 0, 0) });
  osd.addOverlay({ element: lineHighlight, location: new OpenSeadragon.Rect(0, 0, 0, 0) });

  const createPin = (point: DocumentPoint, number: number, label: string): HTMLButtonElement => {
    const pin = h(
      'button',
      { type: 'button', class: 'pin', 'aria-label': label, 'data-id': point.id },
      h('span', { class: 'pin__dot', 'aria-hidden': 'true' }, String(number)),
    );
    const hover = (id: string | null) => () => {
      hoveredId = id;
      refreshPointHighlight();
    };

    // Keep OpenSeadragon from treating presses on a pin as the start of a pan.
    pin.addEventListener('pointerdown', (event) => {
      event.stopPropagation();
    });
    pin.addEventListener('click', () => {
      handlers.onSelect(point.id);
    });
    pin.addEventListener('pointerenter', hover(point.id));
    pin.addEventListener('pointerleave', hover(null));
    pin.addEventListener('focus', () => {
      hover(point.id)();
      viewer.ensureVisible(pinPosition(point));
    });
    pin.addEventListener('blur', hover(null));

    return pin;
  };

  return {
    setPoints: (next, label) => {
      for (const pin of pins.values()) {
        osd.removeOverlay(pin);
      }

      pins.clear();
      points = next;

      next.forEach((point, index) => {
        const pin = createPin(point, index + 1, label(point, index + 1));
        const position = normalizedToViewport(pinPosition(point), imageSize);

        osd.addOverlay({
          element: pin,
          location: new OpenSeadragon.Point(position.x, position.y),
          placement: OpenSeadragon.Placement.CENTER,
          checkResize: false,
        });
        pins.set(point.id, pin);
      });

      for (const [id, pin] of pins) {
        pin.setAttribute('aria-current', String(id === selectedId));
      }

      refreshPointHighlight();
    },
    setSelected: (id) => {
      selectedId = id;

      for (const [pinId, pin] of pins) {
        pin.setAttribute('aria-current', String(pinId === id));
      }

      refreshPointHighlight();
    },
    setVisible: (visible) => {
      osd.element.classList.toggle('pins-hidden', !visible);
    },
    setLineRegion: (region) => {
      placeHighlight(lineHighlight, region);
    },
  };
}
