/**
 * UI strings and localized-text lookup.
 *
 * Serbian is the only language for now; strings are written in Cyrillic and shown in Latin
 * via {@link toLatin}. Adding English later means adding an `en` table and a language
 * setting; every caller already goes through {@link localize} / {@link ui}.
 */
import type { LocalizedText } from '../data/schema';
import type { Script } from '../state/store';
import { toLatin } from './transliterate';

const SR = {
  appTitle: 'Албанска споменица',
  appSubtitle: 'Повеља из 1921. године',
  loading: 'Учитавање документа…',
  loadError: 'Документ није могуће учитати.',
  contents: 'Садржај',
  transcription: 'Транскрипција',
  tour: 'Обилазак',
  wholeDocument: 'Цео документ',
  showPins: 'Прикажи ознаке',
  hidePins: 'Сакриј ознаке',
  zoomIn: 'Увећај',
  zoomOut: 'Умањи',
  close: 'Затвори',
  previous: 'Претходна',
  next: 'Следећа',
  stepOf: 'од',
  pointLabel: 'Ознака',
  skipToContents: 'Прескочи на садржај',
  viewerLabel: 'Скенирани документ',
  viewerHelp:
    'Стрелице померају приказ, тастери + и - мењају увећање, 0 приказује цео документ. Тастером Tab прелазите преко ознака.',
  sheetHandle: 'Промени величину панела',
  verifyHeading: 'Проверити (видљиво само у развојном режиму)',
  endOfTour: 'Крај обиласка',
} as const;

/** Key of a UI string. */
export type UiKey = keyof typeof SR;

/** Label of the script toggle, always written in the script it switches *to*. */
export const SCRIPT_TOGGLE_LABEL: Readonly<Record<Script, string>> = {
  cyrl: 'Latinica',
  latn: 'Ћирилица',
};

/**
 * Render Serbian Cyrillic text in the requested script.
 *
 * @param text - Text in Serbian Cyrillic.
 * @param script - Target script.
 * @returns The text in that script.
 */
export function inScript(text: string, script: Script): string {
  return script === 'latn' ? toLatin(text) : text;
}

/**
 * Pick the display string for localized content.
 *
 * @param text - Localized text from a data file.
 * @param script - Script for Serbian text.
 * @returns The string to display.
 */
export function localize(text: LocalizedText, script: Script): string {
  return inScript(text.sr, script);
}

/**
 * Look up a UI string.
 *
 * @param key - String key.
 * @param script - Script for Serbian text.
 * @returns The string to display.
 */
export function ui(key: UiKey, script: Script): string {
  return inScript(SR[key], script);
}

/**
 * BCP 47 language tag for the `lang` attribute.
 *
 * @param script - Current script.
 * @returns `sr-Cyrl` or `sr-Latn`.
 */
export function languageTag(script: Script): string {
  return script === 'latn' ? 'sr-Latn' : 'sr-Cyrl';
}
