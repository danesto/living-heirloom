/**
 * Floating toolbar (title + main actions) and the desktop zoom buttons.
 */
import { SCRIPT_TOGGLE_LABEL, ui, type UiKey } from '../i18n/i18n';
import type { AppState, Store } from '../state/store';
import { h, icon, type IconName } from './dom';

/** Actions triggered from the toolbar. */
export interface ToolbarActions {
  openContents: () => void;
  openTranscription: () => void;
  startTour: () => void;
  home: () => void;
  zoom: (factor: number) => void;
}

/** The toolbar's elements. */
export interface Toolbar {
  readonly element: HTMLElement;
  readonly zoomControls: HTMLElement;
}

interface ButtonSpec {
  key: UiKey;
  iconName: IconName;
  onClick: () => void;
  className?: string;
}

function toolButton(spec: ButtonSpec): HTMLButtonElement {
  const button = h(
    'button',
    { type: 'button', class: `tool ${spec.className ?? ''}`.trim() },
    icon(spec.iconName),
    h('span', { class: 'tool__label' }),
  );

  button.addEventListener('click', spec.onClick);

  return button;
}

function setLabel(button: HTMLButtonElement, text: string): void {
  const label = button.querySelector('.tool__label');

  if (label !== null) {
    label.textContent = text;
  }

  button.title = text;
}

/**
 * Create the toolbar and keep its labels and pressed states in sync with the store.
 *
 * @param store - App state.
 * @param actions - Callbacks.
 * @returns The toolbar elements.
 */
export function createToolbar(store: Store, actions: ToolbarActions): Toolbar {
  const title = h('h1', { class: 'brand__title' });
  const subtitle = h('p', { class: 'brand__subtitle' });
  const skip = h('a', { class: 'skip-link', href: '#panel' });

  skip.addEventListener('click', (event) => {
    event.preventDefault();

    if (store.get().view === 'closed') {
      store.set({ view: 'toc' });
    }

    document.getElementById('panel')?.focus();
  });

  const contents = toolButton({ key: 'contents', iconName: 'list', onClick: actions.openContents });
  const transcription = toolButton({
    key: 'transcription',
    iconName: 'text',
    onClick: actions.openTranscription,
  });
  const tour = toolButton({ key: 'tour', iconName: 'play', onClick: actions.startTour });
  const pins = toolButton({
    key: 'hidePins',
    iconName: 'pin',
    onClick: () => {
      store.set({ pinsVisible: !store.get().pinsVisible });
    },
  });
  const script = h(
    'button',
    { type: 'button', class: 'tool tool--script' },
    h('span', { class: 'tool__glyph', 'aria-hidden': 'true' }),
    h('span', { class: 'tool__label' }),
  );

  script.addEventListener('click', () => {
    store.set({ script: store.get().script === 'cyrl' ? 'latn' : 'cyrl' });
  });
  const home = toolButton({
    key: 'wholeDocument',
    iconName: 'expand',
    onClick: actions.home,
    className: 'tool--home',
  });

  const zoomIn = toolButton({
    key: 'zoomIn',
    iconName: 'plus',
    onClick: () => {
      actions.zoom(1.5);
    },
  });
  const zoomOut = toolButton({
    key: 'zoomOut',
    iconName: 'minus',
    onClick: () => {
      actions.zoom(1 / 1.5);
    },
  });
  const zoomControls = h('div', { class: 'zoom-controls', role: 'group' }, zoomIn, zoomOut);

  const actionsGroup = h(
    'div',
    { class: 'toolbar__actions', role: 'toolbar' },
    contents,
    transcription,
    tour,
    pins,
    script,
    home,
  );
  const element = h(
    'header',
    { class: 'toolbar' },
    skip,
    h('div', { class: 'brand' }, title, subtitle),
    actionsGroup,
  );

  const render = (state: Readonly<AppState>): void => {
    const s = state.script;

    title.textContent = ui('appTitle', s);
    subtitle.textContent = ui('appSubtitle', s);
    skip.textContent = ui('skipToContents', s);
    document.title = `${ui('appTitle', s)} – ${ui('appSubtitle', s)}`;
    actionsGroup.setAttribute('aria-label', ui('appTitle', s));
    zoomControls.setAttribute('aria-label', `${ui('zoomIn', s)} / ${ui('zoomOut', s)}`);

    setLabel(contents, ui('contents', s));
    setLabel(transcription, ui('transcription', s));
    setLabel(tour, ui('tour', s));
    setLabel(pins, ui(state.pinsVisible ? 'hidePins' : 'showPins', s));
    setLabel(home, ui('wholeDocument', s));
    setLabel(zoomIn, ui('zoomIn', s));
    setLabel(zoomOut, ui('zoomOut', s));
    setLabel(script, SCRIPT_TOGGLE_LABEL[s]);
    script.setAttribute('lang', s === 'cyrl' ? 'sr-Latn' : 'sr-Cyrl');
    const glyph = script.querySelector('.tool__glyph');

    if (glyph !== null) {
      glyph.textContent = s === 'cyrl' ? 'Lat' : 'Ћир';
    }

    contents.setAttribute('aria-pressed', String(state.view === 'toc' || state.view === 'point'));
    transcription.setAttribute('aria-pressed', String(state.view === 'transcription'));
    pins.setAttribute('aria-pressed', String(!state.pinsVisible));
  };

  store.subscribe((state) => {
    render(state);
  });
  render(store.get());

  return { element, zoomControls };
}
