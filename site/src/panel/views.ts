/**
 * Panel contents: table of contents, point details (with tour navigation) and the
 * transcription. Each renderer returns a fresh element; the panel swaps them in.
 */
import type { DocumentPoint, TranscriptionFile } from '../data/schema';
import { inScript, languageTag, localize, ui } from '../i18n/i18n';
import type { Script } from '../state/store';
import { tourStep } from '../tour/tour';
import { h, icon } from '../ui/dom';

/** User intents the views can trigger. */
export interface ViewActions {
  selectPoint: (id: string) => void;
  startTour: () => void;
  showLine: (id: string) => void;
}

/** Everything a view needs to render. */
export interface ViewContext {
  script: Script;
  /** Points in tour order (numbers follow this order). */
  points: readonly DocumentPoint[];
  transcription: TranscriptionFile;
  lineId: string | null;
  /** Show author notes (`verify`). */
  dev: boolean;
  actions: ViewActions;
}

const HEADING_ID = 'panel-heading';

function heading(text: string): HTMLHeadingElement {
  return h('h2', { id: HEADING_ID, class: 'panel__title', tabindex: '-1' }, text);
}

function verifyNotes(notes: readonly string[] | undefined, ctx: ViewContext): HTMLElement | null {
  if (!ctx.dev || notes === undefined || notes.length === 0) {
    return null;
  }

  return h(
    'aside',
    { class: 'verify' },
    h('h3', {}, ui('verifyHeading', ctx.script)),
    h('ul', {}, ...notes.map((note) => h('li', {}, inScript(note, ctx.script)))),
  );
}

/**
 * Table of contents: every point, numbered in tour order.
 *
 * @param ctx - View context.
 * @returns The view element.
 */
export function renderToc(ctx: ViewContext): HTMLElement {
  const items = ctx.points.map((point, index) => {
    const button = h(
      'button',
      { type: 'button', class: 'toc__item' },
      h('span', { class: 'badge', 'aria-hidden': 'true' }, String(index + 1)),
      h('span', {}, localize(point.title, ctx.script)),
    );

    button.addEventListener('click', () => {
      ctx.actions.selectPoint(point.id);
    });

    return h('li', {}, button);
  });
  const tour = h(
    'button',
    { type: 'button', class: 'button button--primary' },
    icon('play'),
    ui('tour', ctx.script),
  );

  tour.addEventListener('click', ctx.actions.startTour);

  return h(
    'div',
    { class: 'view view--toc' },
    heading(ui('contents', ctx.script)),
    tour,
    h('ol', { class: 'toc' }, ...items),
  );
}

/**
 * Details of one point, with previous/next tour navigation.
 *
 * @param ctx - View context.
 * @param point - The selected point.
 * @returns The view element.
 */
export function renderPoint(ctx: ViewContext, point: DocumentPoint): HTMLElement {
  const ids = ctx.points.map((p) => p.id);
  const step = tourStep(ids, point.id);
  const number = (step?.index ?? 0) + 1;
  const total = step?.total ?? ids.length;
  const stepText = `${ui('pointLabel', ctx.script)} ${String(number)} ${ui('stepOf', ctx.script)} ${String(total)}`;

  const navButton = (
    targetId: string | null | undefined,
    kind: 'previous' | 'next',
  ): HTMLButtonElement => {
    const label = ui(kind, ctx.script);
    const button = h(
      'button',
      {
        type: 'button',
        class: `button tour-nav__${kind}`,
        disabled: targetId === null || targetId === undefined,
      },
      kind === 'previous' ? icon('prev') : null,
      h('span', {}, label),
      kind === 'next' ? icon('next') : null,
    );

    if (targetId !== null && targetId !== undefined) {
      button.addEventListener('click', () => {
        ctx.actions.selectPoint(targetId);
      });
    }

    return button;
  };

  const isLast = step?.nextId === null;

  return h(
    'article',
    { class: 'view view--point', 'data-id': point.id },
    h('p', { class: 'eyebrow' }, stepText),
    heading(localize(point.title, ctx.script)),
    ...point.body.map((paragraph) => h('p', {}, localize(paragraph, ctx.script))),
    verifyNotes(point.verify, ctx),
    h(
      'nav',
      { class: 'tour-nav', 'aria-label': ui('tour', ctx.script) },
      navButton(step?.previousId, 'previous'),
      h(
        'span',
        { class: 'tour-nav__count', 'aria-hidden': 'true' },
        `${String(number)} / ${String(total)}`,
      ),
      navButton(step?.nextId, 'next'),
    ),
    isLast ? h('p', { class: 'tour-end' }, ui('endOfTour', ctx.script)) : null,
  );
}

/**
 * The transcription, line by line, with modern explanations. Lines are buttons that
 * zoom to their place on the document.
 *
 * @param ctx - View context.
 * @returns The view element.
 */
export function renderTranscription(ctx: ViewContext): HTMLElement {
  const lang = languageTag(ctx.script);
  const sections = ctx.transcription.sections.map((section) => {
    const lines = section.lines.map((line) => {
      const button = h(
        'button',
        {
          type: 'button',
          class: line.placeholder === true ? 'line line--placeholder' : 'line',
          'data-line': line.id,
          'aria-pressed': String(line.id === ctx.lineId),
        },
        h('span', { class: 'line__text', lang }, inScript(line.text, ctx.script)),
        line.gloss === undefined
          ? null
          : h('span', { class: 'line__gloss' }, localize(line.gloss, ctx.script)),
      );

      button.addEventListener('click', () => {
        ctx.actions.showLine(line.id);
      });

      return h('li', {}, button);
    });

    return h(
      'section',
      { class: 'transcription__section' },
      h('h3', {}, localize(section.title, ctx.script)),
      h('ol', { class: 'lines' }, ...lines),
    );
  });

  return h(
    'div',
    { class: 'view view--transcription' },
    heading(ui('transcription', ctx.script)),
    h('p', { class: 'muted' }, localize(ctx.transcription.intro, ctx.script)),
    verifyNotes(ctx.transcription.verify, ctx),
    ...sections,
  );
}

/**
 * Mark the active transcription line without re-rendering (keeps scroll position).
 *
 * @param root - The panel body.
 * @param lineId - Active line id, or `null`.
 */
export function markActiveLine(root: HTMLElement, lineId: string | null): void {
  for (const button of root.querySelectorAll<HTMLButtonElement>('[data-line]')) {
    button.setAttribute('aria-pressed', String(button.dataset['line'] === lineId));
  }
}
