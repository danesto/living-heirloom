/**
 * Tiny helpers for building DOM without a framework. Text is always set via
 * `textContent`, never `innerHTML`, so data files cannot inject markup.
 */

type Attributes = Record<string, string | number | boolean | null | undefined>;
type Child = Node | string | null | undefined | false;

/**
 * Create an element with attributes and children.
 *
 * `true` sets a boolean attribute, `false`/`null`/`undefined` omit it. Strings become text.
 *
 * @param tag - Element tag name.
 * @param attributes - Attributes to set (`class`, `aria-*`, `data-*`, ...).
 * @param children - Child nodes or text.
 * @returns The new element.
 */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attributes: Attributes = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);

  for (const [name, value] of Object.entries(attributes)) {
    if (value === true) {
      element.setAttribute(name, '');
    } else if (value !== false && value !== null && value !== undefined) {
      element.setAttribute(name, String(value));
    }
  }

  for (const child of children) {
    if (child !== null && child !== undefined && child !== false) {
      element.append(child);
    }
  }

  return element;
}

/**
 * Find a required element, failing loudly if the page markup is out of sync with the code.
 *
 * @param selector - CSS selector.
 * @param root - Element to search in.
 * @returns The element.
 */
export function required(selector: string, root: ParentNode = document): HTMLElement {
  const element = root.querySelector<HTMLElement>(selector);

  if (element === null) {
    throw new Error(`Missing element: ${selector}`);
  }

  return element;
}

/** Names of the inline icons. */
export type IconName =
  'list' | 'text' | 'play' | 'pin' | 'expand' | 'plus' | 'minus' | 'close' | 'prev' | 'next';

const ICON_PATHS: Readonly<Record<IconName, string>> = {
  list: 'M4 6h16M4 12h16M4 18h16',
  text: 'M5 5h14M5 9.5h14M5 14h9M5 18.5h11',
  play: 'M8 5.5v13l10-6.5z',
  pin: 'M12 21s-6-5.6-6-11a6 6 0 0 1 12 0c0 5.4-6 11-6 11zm0-8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  expand: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  close: 'M6 6l12 12M18 6L6 18',
  prev: 'M15 5l-7 7 7 7',
  next: 'M9 5l7 7-7 7',
};

/**
 * Create a decorative inline SVG icon (hidden from assistive technology).
 *
 * @param name - Icon name.
 * @returns The SVG element.
 */
export function icon(name: IconName): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  const path = document.createElementNS(ns, 'path');

  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.classList.add('icon');
  path.setAttribute('d', ICON_PATHS[name]);
  svg.append(path);

  return svg;
}

/**
 * Whether the user asked the OS to minimize motion.
 *
 * @returns `true` if animations should be skipped.
 */
export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Media query for the phone layout (bottom sheet, no minimap). */
export const MOBILE_QUERY = '(max-width: 899px)';

/**
 * Whether the phone layout is active.
 *
 * @returns `true` below the desktop breakpoint.
 */
export function isMobileLayout(): boolean {
  return window.matchMedia(MOBILE_QUERY).matches;
}
