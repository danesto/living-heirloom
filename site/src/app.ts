/**
 * Application wiring: loads content, creates the viewer and UI modules, and connects
 * them through the shared store.
 */
import { loadContent } from './data/load';
import type { DocumentPoint, TranscriptionLine } from './data/schema';
import { isDevMode } from './dev/devMode';
import { languageTag, localize, ui } from './i18n/i18n';
import { createPanel, type Panel } from './panel/panel';
import { createPinLayer } from './pins/pins';
import { hashForId, idFromHash } from './state/hash';
import { createStore, type AppState, type Script } from './state/store';
import { tourOrder } from './tour/tour';
import { h, isMobileLayout, required } from './ui/dom';
import { createToolbar } from './ui/toolbar';
import { keyToAction } from './viewer/keyboard';
import { createViewer, type DocumentViewer } from './viewer/viewer';

const SCRIPT_STORAGE_KEY = 'spomenica.script';
const INSET_MARGIN = 12;

function storedScript(): Script {
  try {
    return localStorage.getItem(SCRIPT_STORAGE_KEY) === 'latn' ? 'latn' : 'cyrl';
  } catch {
    return 'cyrl';
  }
}

function storeScript(script: Script): void {
  try {
    localStorage.setItem(SCRIPT_STORAGE_KEY, script);
  } catch {
    // Storage unavailable (private mode): the choice just isn't remembered.
  }
}

function isTypingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  );
}

/**
 * Start the app inside the page skeleton from `index.html`.
 *
 * @returns Resolves once the document is shown.
 */
export async function startApp(): Promise<void> {
  const viewerElement = required('#viewer');
  const uiRoot = required('#ui');
  const status = required('#status');
  // Dev mode exists only on the local dev server (`pnpm dev`); production builds drop it.
  const dev = import.meta.env.DEV && isDevMode(location.search);
  const store = createStore({
    selectedId: null,
    lineId: null,
    view: 'toc',
    script: storedScript(),
    pinsVisible: true,
  });

  document.documentElement.lang = languageTag(store.get().script);
  status.textContent = ui('loading', store.get().script);

  const [content, openedViewer] = await Promise.all([
    loadContent(),
    createViewer(viewerElement, `${import.meta.env.BASE_URL}tiles/spomenica.dzi`),
  ]);

  const activeViewer: DocumentViewer = openedViewer;

  let ordered = tourOrder(content.points.points);
  const knownIds = new Set(ordered.map((p) => p.id));
  const findPoint = (id: string | null): DocumentPoint | undefined =>
    ordered.find((p) => p.id === id);
  const findLine = (id: string | null): TranscriptionLine | undefined =>
    content.transcription.sections.flatMap((s) => s.lines).find((line) => line.id === id);

  const selectPoint = (id: string): void => {
    store.set({ selectedId: id, lineId: null, view: 'point' });
  };
  const startTour = (): void => {
    const first = ordered[0];

    if (first !== undefined) {
      selectPoint(first.id);
    }
  };

  // --- Pins -----------------------------------------------------------------------------
  const pins = createPinLayer(activeViewer, { onSelect: selectPoint });
  const pinLabel = (point: DocumentPoint, number: number): string =>
    `${String(number)}. ${localize(point.title, store.get().script)}`;

  pins.setPoints(ordered, pinLabel);

  // --- Toolbar & panel ------------------------------------------------------------------
  const toolbar = createToolbar(store, {
    openContents: () => {
      store.set({
        view: store.get().view === 'toc' ? 'closed' : 'toc',
        selectedId: null,
        lineId: null,
      });
    },
    openTranscription: () => {
      store.set({
        view: store.get().view === 'transcription' ? 'closed' : 'transcription',
        selectedId: null,
      });
    },
    startTour,
    home: () => {
      activeViewer.home();
    },
    zoom: (factor) => {
      activeViewer.perform({ kind: 'zoom', factor });
    },
  });

  // The panel reports layout changes while it is being created, before `panel` is set.
  let panel: Panel | null = null;
  const updateInsets = (): void => {
    if (panel === null) {
      return;
    }

    const top = toolbar.element.getBoundingClientRect().bottom + INSET_MARGIN;
    const insets = { top, right: INSET_MARGIN, bottom: INSET_MARGIN, left: INSET_MARGIN };

    if (isMobileLayout()) {
      insets.bottom += panel.sheet.visibleHeight();
    } else {
      const covered = panel.coveredRect();

      if (covered !== null) {
        insets.right = window.innerWidth - covered.left + INSET_MARGIN;
      }

      insets.left = toolbar.zoomControls.getBoundingClientRect().right + INSET_MARGIN;
    }

    activeViewer.setInsets(insets);
  };

  panel = createPanel({
    store,
    points: ordered,
    transcription: content.transcription,
    dev,
    actions: {
      selectPoint,
      startTour,
      showLine: (id) => {
        store.set({ lineId: id, selectedId: null, view: 'transcription' });
      },
    },
    onLayoutChange: updateInsets,
  });

  const help = h('p', { id: 'viewer-help', class: 'sr-only' });
  const announcer = h('p', { class: 'sr-only', 'aria-live': 'polite', 'aria-atomic': 'true' });

  uiRoot.append(toolbar.element, toolbar.zoomControls, panel.element, help, announcer);
  // Sheet heights can only be measured once the panel is in the document.
  panel.sheet.refresh();

  const canvas = activeViewer.osd.canvas;

  canvas.setAttribute('role', 'application');
  canvas.setAttribute('aria-describedby', 'viewer-help');

  // --- Dev mode -------------------------------------------------------------------------
  if (import.meta.env.DEV && dev) {
    const { mountDevMode } = await import('./dev/devMode');

    uiRoot.append(
      mountDevMode(activeViewer, content.points, content.transcription, {
        onPointsChanged: (points) => {
          ordered = tourOrder(points);
          pins.setPoints(ordered, pinLabel);
          const selected = findPoint(store.get().selectedId);

          if (selected !== undefined) {
            pins.setSelected(selected.id);
          }
        },
        onLineRegion: (region) => {
          pins.setLineRegion(region);
        },
      }),
    );
  }

  // --- React to state changes -----------------------------------------------------------
  const renderStatic = (state: Readonly<AppState>): void => {
    document.documentElement.lang = languageTag(state.script);
    canvas.setAttribute('aria-label', ui('viewerLabel', state.script));
    help.textContent = ui('viewerHelp', state.script);
  };

  const onChange = (state: Readonly<AppState>, previous: Readonly<AppState>): void => {
    if (state.script !== previous.script) {
      renderStatic(state);
      storeScript(state.script);
      pins.setPoints(ordered, pinLabel);
    }

    if (state.pinsVisible !== previous.pinsVisible) {
      pins.setVisible(state.pinsVisible);
    }

    if (state.selectedId !== previous.selectedId) {
      pins.setSelected(state.selectedId);
      history.replaceState(
        null,
        '',
        hashForId(state.selectedId) || `${location.pathname}${location.search}`,
      );
      const point = findPoint(state.selectedId);

      if (point !== undefined) {
        const number = ordered.indexOf(point) + 1;

        announcer.textContent = `${ui('pointLabel', state.script)} ${String(number)}: ${localize(point.title, state.script)}`;
        // Let the panel settle first so the fly-to uses the final free screen area.
        requestAnimationFrame(() => {
          activeViewer.flyToRegion(point.region);
        });
      }
    }

    if (state.lineId !== previous.lineId) {
      const line = findLine(state.lineId);

      pins.setLineRegion(line?.region ?? null);

      if (line !== undefined) {
        requestAnimationFrame(() => {
          activeViewer.flyToRegion(line.region);
        });
      }
    }
  };

  store.subscribe(onChange);
  renderStatic(store.get());

  // --- Keyboard -------------------------------------------------------------------------
  document.addEventListener('keydown', (event) => {
    if (
      event.defaultPrevented ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey ||
      isTypingTarget(event.target)
    ) {
      return;
    }

    if (event.key === 'Escape' && store.get().view !== 'closed') {
      store.set({ view: 'closed', selectedId: null, lineId: null });
      canvas.focus();

      return;
    }

    const target = event.target;
    const onViewer =
      target === document.body || (target instanceof Node && viewerElement.contains(target));

    if (!onViewer) {
      return;
    }

    const action = keyToAction(event.key, event.shiftKey);

    if (action !== null) {
      event.preventDefault();
      activeViewer.perform(action);
    }
  });

  // --- Deep links -----------------------------------------------------------------------
  window.addEventListener('hashchange', () => {
    const id = idFromHash(location.hash, knownIds);

    if (id !== null) {
      selectPoint(id);
    }
  });
  window.addEventListener('resize', updateInsets);

  updateInsets();
  status.remove();
  const initial = idFromHash(location.hash, knownIds);

  if (initial === null) {
    activeViewer.home();
  } else {
    selectPoint(initial);
  }
}
