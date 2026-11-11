/**
 * OpenSeadragon setup and the small API the rest of the app uses to drive it.
 */
import OpenSeadragon from 'openseadragon';

import type { ImagePoint, Region } from '../data/schema';
import { prefersReducedMotion } from '../ui/dom';
import {
  normalizedToViewport,
  padRect,
  regionToViewport,
  viewportToNormalized,
  type ImageSize,
} from './coords';
import type { ViewerAction } from './keyboard';

/** Screen-space areas covered by floating UI, in CSS pixels. */
export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** Facade over OpenSeadragon exposing only what the app needs. */
export interface DocumentViewer {
  readonly osd: OpenSeadragon.Viewer;
  readonly imageSize: ImageSize;
  /** Zoom so the region fills the unobstructed part of the screen. */
  flyToRegion: (region: Region) => void;
  /** Show the whole document. */
  home: () => void;
  /** Apply a keyboard / button action. */
  perform: (action: ViewerAction) => void;
  /** Tell the viewer which parts of the screen are covered by panels. */
  setInsets: (insets: Insets) => void;
  /** Make sure a normalized point is on screen (e.g. a pin that received focus). */
  ensureVisible: (point: ImagePoint) => void;
  /** Convert a screen position (relative to the viewer element) to normalized coordinates. */
  toNormalized: (pixel: { x: number; y: number }) => ImagePoint;
}

/** How much space to leave around a region when flying to it, per side. */
const REGION_PADDING = 0.06;

/**
 * Create the viewer and resolve once the image is open.
 *
 * @param element - Container element (fills the screen).
 * @param tileSource - URL of the `.dzi` file.
 * @returns The viewer facade.
 */
export function createViewer(element: HTMLElement, tileSource: string): Promise<DocumentViewer> {
  const reducedMotion = prefersReducedMotion();
  const osd = OpenSeadragon({
    element,
    tileSources: tileSource,
    crossOriginPolicy: false,
    showNavigationControl: false,
    showNavigator: true,
    navigatorPosition: 'BOTTOM_LEFT',
    navigatorAutoFade: false,
    navigatorSizeRatio: 0.14,
    keyboardNavEnabled: false,
    visibilityRatio: 0.6,
    constrainDuringPan: true,
    minZoomImageRatio: 0.8,
    maxZoomPixelRatio: 2,
    preserveImageSizeOnResize: true,
    animationTime: reducedMotion ? 0 : 1.1,
    springStiffness: 7,
    gestureSettingsMouse: { clickToZoom: false, dblClickToZoom: true },
    gestureSettingsTouch: { pinchRotate: false, flickEnabled: !reducedMotion },
  });

  return new Promise((resolve, reject) => {
    osd.addOnceHandler('open-failed', (event) => {
      reject(new Error(`Could not open ${tileSource}: ${event.message}`));
    });
    osd.addOnceHandler('open', () => {
      const item = osd.world.getItemAt(0);
      const content = item.getContentSize();

      resolve(createFacade(osd, { width: content.x, height: content.y }));
    });
  });
}

function createFacade(osd: OpenSeadragon.Viewer, imageSize: ImageSize): DocumentViewer {
  const viewport = osd.viewport;
  const immediately = (): boolean => prefersReducedMotion();

  return {
    osd,
    imageSize,
    flyToRegion: (region) => {
      const rect = padRect(regionToViewport(region, imageSize), REGION_PADDING);

      viewport.fitBounds(
        new OpenSeadragon.Rect(rect.x, rect.y, rect.width, rect.height),
        immediately(),
      );
    },
    home: () => {
      viewport.goHome(immediately());
    },
    perform: (action) => {
      if (action.kind === 'home') {
        viewport.goHome(immediately());

        return;
      }

      if (action.kind === 'zoom') {
        viewport.zoomBy(action.factor, undefined, immediately());
      } else {
        const bounds = viewport.getBounds();

        viewport.panBy(
          new OpenSeadragon.Point(action.dx * bounds.width, action.dy * bounds.height),
          immediately(),
        );
      }

      viewport.applyConstraints(immediately());
    },
    setInsets: (insets) => {
      viewport.setMargins(insets);
    },
    ensureVisible: (point) => {
      const target = normalizedToViewport(point, imageSize);
      const bounds = viewport.getBounds();
      const inside =
        target.x > bounds.x &&
        target.x < bounds.x + bounds.width &&
        target.y > bounds.y &&
        target.y < bounds.y + bounds.height;

      if (!inside) {
        viewport.panTo(new OpenSeadragon.Point(target.x, target.y), immediately());
      }
    },
    toNormalized: (pixel) => {
      const point = viewport.pointFromPixel(new OpenSeadragon.Point(pixel.x, pixel.y));

      return viewportToNormalized(point, imageSize);
    },
  };
}
