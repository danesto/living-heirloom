/**
 * Serbian Cyrillic → Latin (gajica) transliteration.
 *
 * Serbian has an exact one-to-one letter mapping (three Cyrillic letters become digraphs),
 * so all Serbian text is stored in Cyrillic and the Latin version is derived.
 */

const LOWER: Readonly<Record<string, string>> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  ђ: 'đ',
  е: 'e',
  ж: 'ž',
  з: 'z',
  и: 'i',
  ј: 'j',
  к: 'k',
  л: 'l',
  љ: 'lj',
  м: 'm',
  н: 'n',
  њ: 'nj',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  ћ: 'ć',
  у: 'u',
  ф: 'f',
  х: 'h',
  ц: 'c',
  ч: 'č',
  џ: 'dž',
  ш: 'š',
};

const DIGRAPH = /^(lj|nj|dž)$/;

/**
 * Transliterate Serbian Cyrillic text to Latin script.
 *
 * Capital digraph letters (Љ, Њ, Џ) become title case (`Lj`) before a lowercase letter
 * and all caps (`LJ`) inside an all-caps word. Non-Cyrillic characters pass through.
 *
 * @param text - Text in Serbian Cyrillic (may contain Latin, digits, punctuation).
 * @returns The text in Serbian Latin script.
 */
export function toLatin(text: string): string {
  const chars = Array.from(text);

  return chars
    .map((char, index) => {
      const lower = char.toLowerCase();
      const latin = LOWER[lower];

      if (latin === undefined) {
        return char;
      }

      if (char === lower) {
        return latin;
      }

      if (!DIGRAPH.test(latin)) {
        return latin.toUpperCase();
      }

      return isUpperContext(chars, index)
        ? latin.toUpperCase()
        : latin.charAt(0).toUpperCase() + latin.slice(1);
    })
    .join('');
}

/** True if the neighbouring letters are capitals, i.e. the word is written in all caps. */
function isUpperContext(chars: readonly string[], index: number): boolean {
  const neighbours = [chars[index + 1], chars[index - 1]].filter(
    (c): c is string => c !== undefined && c.toLowerCase() !== c.toUpperCase(),
  );
  const [first] = neighbours;

  if (first === undefined) {
    return false;
  }

  return first === first.toUpperCase();
}
