/**
 * The info panel: a side panel on desktop and a draggable bottom sheet on phones.
 * Hosts the table of contents, point details and the transcription.
 */
import type { DocumentPoint, TranscriptionFile } from '../data/schema';
import { ui } from '../i18n/i18n';
import type { AppState, PanelView, Store } from '../state/store';
import { h, icon, isMobileLayout } from '../ui/dom';
import { createSheet, type Sheet } from './sheet';
import {
  markActiveLine,
  renderPoint,
  renderToc,
  renderTranscription,
  type ViewActions,
} from './views';

/** Controls for the panel. */
export interface Panel {
  readonly element: HTMLElement;
  readonly sheet: Sheet;
  /** Screen rectangle covered by the panel, or `null` when closed. */
  coveredRect: () => DOMRect | null;
}

/** Inputs for {@link createPanel}. */
export interface PanelOptions {
  store: Store;
  points: readonly DocumentPoint[];
  transcription: TranscriptionFile;
  dev: boolean;
  actions: ViewActions;
  /** Called when the covered screen area may have changed. */
  onLayoutChange: () => void;
}

const TABS: readonly {
  view: Exclude<PanelView, 'closed' | 'point'>;
  key: 'contents' | 'transcription';
}[] = [
  { view: 'toc', key: 'contents' },
  { view: 'transcription', key: 'transcription' },
];

/**
 * Create the panel and keep it in sync with the store.
 *
 * @param options - Data, store and callbacks.
 * @returns Controls for the panel.
 */
export function createPanel(options: PanelOptions): Panel {
  const { store } = options;
  const handle = h(
    'button',
    { type: 'button', class: 'sheet-handle' },
    h('span', { class: 'sheet-handle__bar', 'aria-hidden': 'true' }),
  );
  const tabs = h('div', { class: 'tabs' });
  const close = h('button', { type: 'button', class: 'icon-button' }, icon('close'));
  const header = h('div', { class: 'panel__header' }, tabs, close);
  const grip = h('div', { class: 'panel__grip' }, handle, header);
  const body = h('div', { class: 'panel__body' });
  const element = h(
    'aside',
    { id: 'panel', class: 'panel', 'aria-labelledby': 'panel-heading', tabindex: '-1' },
    grip,
    body,
  );

  const sheet = createSheet(element, grip, handle, body, {
    onResize: options.onLayoutChange,
    onDismiss: () => {
      store.set({ view: 'closed' });
    },
  });

  close.addEventListener('click', () => {
    store.set({ view: 'closed', selectedId: null, lineId: null });
  });

  const tabButtons = TABS.map(({ view }) => {
    const button = h('button', { type: 'button', class: 'tab', 'data-view': view });

    button.addEventListener('click', () => {
      store.set({ view, selectedId: null, lineId: null });
    });
    tabs.append(button);

    return button;
  });

  const renderLabels = (state: Readonly<AppState>): void => {
    TABS.forEach(({ view, key }, index) => {
      const button = tabButtons[index];

      if (button !== undefined) {
        button.textContent = ui(key, state.script);
        button.setAttribute(
          'aria-pressed',
          String(state.view === view || (view === 'toc' && state.view === 'point')),
        );
      }
    });
    close.setAttribute('aria-label', ui('close', state.script));
    close.title = ui('close', state.script);
    handle.setAttribute('aria-label', ui('sheetHandle', state.script));
  };

  const renderBody = (state: Readonly<AppState>): void => {
    const hadFocus = body.contains(document.activeElement);
    const ctx = {
      script: state.script,
      points: options.points,
      transcription: options.transcription,
      lineId: state.lineId,
      dev: options.dev,
      actions: options.actions,
    };
    const point = options.points.find((p) => p.id === state.selectedId);
    const view =
      state.view === 'point' && point !== undefined
        ? renderPoint(ctx, point)
        : state.view === 'transcription'
          ? renderTranscription(ctx)
          : renderToc(ctx);

    body.replaceChildren(view);
    body.scrollTop = 0;

    // The control the user activated was replaced: move focus to the new heading.
    if (hadFocus) {
      view.querySelector<HTMLElement>('#panel-heading')?.focus();
    }
  };

  const update = (state: Readonly<AppState>, previous: Readonly<AppState> | null): void => {
    const open = state.view !== 'closed';

    element.hidden = !open;
    element.dataset['view'] = state.view;
    renderLabels(state);

    if (!open) {
      options.onLayoutChange();

      return;
    }

    const contentChanged =
      previous?.view !== state.view ||
      previous.script !== state.script ||
      (state.view === 'point' && previous.selectedId !== state.selectedId);

    if (contentChanged) {
      renderBody(state);
    } else if (previous.lineId !== state.lineId) {
      markActiveLine(body, state.lineId);
    }

    const opened = previous === null || previous.view === 'closed';

    if (isMobileLayout()) {
      // Reveal content when something is picked; otherwise keep the current height.
      const picked = state.selectedId !== previous?.selectedId || state.lineId !== previous.lineId;

      if (opened) {
        sheet.snapTo(state.view === 'toc' && previous === null ? 'peek' : 'half');
      } else if (picked && sheet.snap() === 'peek') {
        sheet.snapTo('half');
      } else if (previous.view !== state.view && sheet.snap() === 'peek') {
        sheet.snapTo('half');
      }
    }

    options.onLayoutChange();
  };

  store.subscribe((state, previous) => {
    update(state, previous);
  });
  update(store.get(), null);

  window.matchMedia('(max-width: 899px)').addEventListener('change', () => {
    sheet.refresh();
    options.onLayoutChange();
  });

  return {
    element,
    sheet,
    coveredRect: () => (element.hidden ? null : element.getBoundingClientRect()),
  };
}
