/**
 * Deep links: the URL hash holds the selected point id (e.g. `#pecat`).
 */

/**
 * Read a point id from a URL hash.
 *
 * @param hash - `location.hash`, with or without the leading `#`.
 * @param knownIds - Valid point ids.
 * @returns The id if the hash names a known point, otherwise `null`.
 */
export function idFromHash(hash: string, knownIds: ReadonlySet<string>): string | null {
  const id = decodeURIComponent(hash.replace(/^#/, '')).trim().toLowerCase();

  return knownIds.has(id) ? id : null;
}

/**
 * Build the hash for a selection.
 *
 * @param id - Selected point id, or `null` for none.
 * @returns `#id`, or an empty string.
 */
export function hashForId(id: string | null): string {
  return id === null ? '' : `#${encodeURIComponent(id)}`;
}
