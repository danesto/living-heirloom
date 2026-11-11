import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative base so the static build works from any sub-path (GitHub Pages project sites).
  base: './',
  build: {
    target: 'es2022',
    sourcemap: true,
  },
  test: {
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    environment: 'node',
    passWithNoTests: true,
  },
});
