/**
 * Developer mode (`?dev` in the URL): place and adjust pins and regions by clicking on the
 * document, then copy the updated JSON into `public/points.json` / `transcription.json`.
 */
import type {
  DocumentPoint,
  ImagePoint,
  PointsFile,
  Region,
  TranscriptionFile,
} from '../data/schema';
import { h } from '../ui/dom';
import { regionFromCorners, regionToPixels, round4 } from '../viewer/coords';
import type { DocumentViewer } from '../viewer/viewer';

/** Callbacks so the rest of the app shows edits live. */
export interface DevModeHooks {
  onPointsChanged: (points: readonly DocumentPoint[]) => void;
  onLineRegion: (region: Region) => void;
}

type Target = { kind: 'point'; id: string } | { kind: 'line'; id: string };
type Mode = 'pin' | 'region';

/**
 * Whether dev mode is requested via the URL.
 *
 * @param search - `location.search`.
 * @returns `true` for `?dev` / `?dev=1`.
 */
export function isDevMode(search: string): boolean {
  const value = new URLSearchParams(search).get('dev');

  return value !== null && value !== '0' && value !== 'false';
}

/**
 * Mount the dev tools.
 *
 * @param viewer - The document viewer.
 * @param pointsFile - Points data (copied; the original is not mutated).
 * @param transcriptionFile - Transcription data (copied).
 * @param hooks - Live-update callbacks.
 * @returns The dev panel element.
 */
export function mountDevMode(
  viewer: DocumentViewer,
  pointsFile: PointsFile,
  transcriptionFile: TranscriptionFile,
  hooks: DevModeHooks,
): HTMLElement {
  const points = structuredClone(pointsFile);
  const transcription = structuredClone(transcriptionFile);
  const lines = transcription.sections.flatMap((section) => section.lines);
  let target: Target = { kind: 'point', id: points.points[0]?.id ?? '' };
  let mode: Mode = 'pin';
  let firstCorner: ImagePoint | null = null;

  const select = h(
    'select',
    { 'aria-label': 'Target' },
    h(
      'optgroup',
      { label: 'points.json' },
      ...points.points.map((p) => h('option', { value: `point:${p.id}` }, p.id)),
    ),
    h(
      'optgroup',
      { label: 'transcription.json' },
      ...lines.map((l) => h('option', { value: `line:${l.id}` }, l.id)),
    ),
  );
  const modeSelect = h(
    'select',
    { 'aria-label': 'Mode' },
    h('option', { value: 'pin' }, 'click = pin'),
    h('option', { value: 'region' }, 'click ×2 = region'),
  );
  const cursor = h('output', { class: 'dev__cursor' }, '–');
  const status = h('p', { class: 'dev__status' });
  const output = h('textarea', {
    class: 'dev__json',
    rows: 8,
    readonly: true,
    'aria-label': 'JSON',
  });
  const copy = h('button', { type: 'button', class: 'button' }, 'Copy JSON');

  const json = (): string =>
    target.kind === 'point'
      ? JSON.stringify(points, null, 2)
      : JSON.stringify(transcription, null, 2);

  const describe = (): void => {
    const region =
      target.kind === 'point'
        ? points.points.find((p) => p.id === target.id)?.region
        : lines.find((l) => l.id === target.id)?.region;
    const px = region === undefined ? '' : JSON.stringify(regionToPixels(region, viewer.imageSize));

    status.textContent = `${target.kind} "${target.id}" region px ${px}${firstCorner === null ? '' : ' – click the opposite corner'}`;
    output.value = json();
  };

  select.addEventListener('change', () => {
    const [kind, id] = select.value.split(':');

    target = kind === 'line' ? { kind: 'line', id: id ?? '' } : { kind: 'point', id: id ?? '' };
    firstCorner = null;
    describe();
  });
  modeSelect.addEventListener('change', () => {
    mode = modeSelect.value === 'region' ? 'region' : 'pin';
    firstCorner = null;
    describe();
  });
  copy.addEventListener('click', () => {
    void navigator.clipboard.writeText(json()).then(() => {
      copy.textContent = 'Copied ✓';
      window.setTimeout(() => (copy.textContent = 'Copy JSON'), 1500);
    });
  });

  const apply = (at: ImagePoint): void => {
    const point = { x: round4(at.x), y: round4(at.y) };

    if (mode === 'pin') {
      const item = points.points.find((p) => p.id === target.id);

      if (target.kind === 'point' && item !== undefined) {
        item.pin = point;
        hooks.onPointsChanged(points.points);
      }

      describe();

      return;
    }

    if (firstCorner === null) {
      firstCorner = point;
      describe();

      return;
    }

    const region = regionFromCorners(firstCorner, point);

    firstCorner = null;

    if (target.kind === 'point') {
      const item = points.points.find((p) => p.id === target.id);

      if (item !== undefined) {
        item.region = region;
        hooks.onPointsChanged(points.points);
      }
    } else {
      const line = lines.find((l) => l.id === target.id);

      if (line !== undefined) {
        line.region = region;
        hooks.onLineRegion(region);
      }
    }

    describe();
  };

  viewer.osd.addHandler('canvas-click', (event) => {
    if (!event.quick) {
      return;
    }

    event.preventDefaultAction = true;
    apply(viewer.toNormalized(event.position));
  });

  viewer.osd.element.addEventListener('pointermove', (event) => {
    const rect = viewer.osd.element.getBoundingClientRect();
    const at = viewer.toNormalized({ x: event.clientX - rect.left, y: event.clientY - rect.top });

    cursor.textContent = `x ${at.x.toFixed(4)}  y ${at.y.toFixed(4)}`;
  });

  describe();

  return h(
    'section',
    { class: 'dev', 'aria-label': 'Developer tools' },
    h('strong', {}, 'DEV'),
    select,
    modeSelect,
    cursor,
    status,
    output,
    copy,
  );
}
