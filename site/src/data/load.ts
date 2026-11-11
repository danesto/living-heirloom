/**
 * Fetching and validating the content files.
 */
import type { z } from 'zod';

import {
  parseWith,
  pointsFileSchema,
  transcriptionFileSchema,
  type PointsFile,
  type TranscriptionFile,
} from './schema';

/** Thrown when a content file is missing or does not match its schema. */
export class DataError extends Error {
  /**
   * @param file - The file that failed.
   * @param details - One message per problem.
   */
  constructor(
    readonly file: string,
    readonly details: readonly string[],
  ) {
    super(`${file} is invalid:\n${details.join('\n')}`);
    this.name = 'DataError';
  }
}

/** Everything the app needs from `public/`. */
export interface Content {
  points: PointsFile;
  transcription: TranscriptionFile;
}

async function fetchValidated<T>(file: string, schema: z.ZodType<T>): Promise<T> {
  const response = await fetch(`${import.meta.env.BASE_URL}${file}`);

  if (!response.ok) {
    throw new DataError(file, [`HTTP ${String(response.status)}`]);
  }

  const json: unknown = await response.json();
  const result = parseWith(schema, json);

  if (!result.ok) {
    throw new DataError(file, result.errors);
  }

  return result.value;
}

/**
 * Load and validate `points.json` and `transcription.json`.
 *
 * @returns The validated content.
 * @throws {@link DataError} if a file is missing or invalid.
 */
export async function loadContent(): Promise<Content> {
  const [points, transcription] = await Promise.all([
    fetchValidated('points.json', pointsFileSchema),
    fetchValidated('transcription.json', transcriptionFileSchema),
  ]);

  return { points, transcription };
}
