# Albanska spomenica — interactive deep-zoom presentation

## Goal
Bring my great-grandfather's Albanska spomenica certificate (paper document, 1921) to life as a
small website: a very high-resolution image you can zoom and pan, with interactive pins that
explain each part of the document. Must work well on phones and desktop.

## Source material
- `source/placeholder.jpeg`: a phone photo of the framed document. Low quality: ~1600x1200,
  WhatsApp-compressed, rotated 90°, shot through glass (glare on the right), purple color cast
  and dark vignette. Use it ONLY as a placeholder to build the pipeline and the site.
- A proper scan (1200+ dpi, TIFF) will replace it later. Everything must work by just swapping
  the source file and re-running the pipeline.
- Do NOT use AI upscaling to invent detail. This is a historical document: only real detail.
  Mild denoise/sharpen is fine.

## Part 1: image pipeline (Python)
Script(s) in `pipeline/`, runnable with one command:
1. Rotate to upright, detect the document edges, correct perspective (OpenCV).
2. Remove color cast / vignette, normalize white balance so the paper looks like aged paper,
   reduce glare where possible.
3. Export a master image (TIFF/PNG) + a small preview.
4. Generate Deep Zoom tiles (DZI) with libvips (`vips dzsave`, pyvips is fine) into `site/tiles/`.
Must handle very large inputs (multi-gigapixel) without loading everything into RAM where possible.

## Part 2: website (`site/`)
TypeScript + Vite + OpenSeadragon (with `@types/openseadragon`). No UI framework needed.
The build output is a fully static site, deployable to GitHub Pages / Netlify.
Point data in `site/public/points.json`, validated at load time against a typed schema.

Layout and navigation:
- Viewer fills the whole screen; UI floats above it.
- Desktop: info panel on the right. Mobile: bottom sheet that can be dragged up.
- List of all points (table of contents); click flies to that region.
- Guided tour with previous/next, going through the document top to bottom.
- "Show whole document" button always visible. Minimap on desktop only.
- Deep links per point via plain hash (e.g. `#pecat`).
- Toggle to hide pins.

Pins:
- Numbered circles that keep the same screen size at any zoom; touch target at least 44x44 px.
- Each point has a region (rectangle in image coordinates); highlight the region on hover/select.
- Coordinates stored normalized (0–1) so they survive replacing the placeholder with the scan.
- Simple dev mode to place/adjust pins by clicking and copy the JSON.

Transcription:
- Panel with the transcription of the text (pre-reform Cyrillic as written) plus a modern
  explanation. Clicking a line zooms to that line in the image.
- Cyrillic / Latin toggle; English later.

Accessibility and polish:
- Full keyboard support (arrows pan, +/- zoom, Tab through pins), aria labels, visible focus.
- Respect `prefers-reduced-motion` (jump instead of fly).
- Light and dark mode. Serif font with good Cyrillic support (Noto Serif or PT Serif).
- `touch-action: none` on the viewer so gestures don't scroll the page; respect iPhone safe areas.
- Test on a real phone, run Lighthouse.

## Draft transcription (to verify against the real scan)
Uncertain readings are marked [?]. The handwritten name and unit are NOT yet read; leave a
placeholder for me to fill in.

> Његово Величанство
> Александар I.
> по милости Божјој и вољи народној
> Краљ Срба, Хрвата и Словенаца
>
> Благоволео је указом Својим од 6. Новембра 1921 год. ФА № 2321 [?], на предлог
> Министра Војног и Морнарице, а на основу Указа од 3. Априла 1920 год. ФА № 15153 [?],
> за верности Отаџбини 1915 год. одликовати Свога ратног друга:
> [handwritten in red ink: rank, name, unit — TO BE FILLED IN]
>
> Албанском Споменицом,
> што му овим потврђује.
>
> К.О. № 7517 [?]
> 23. Новембра 1921 год. у Београду.
>
> Канцелар Краљевских Ордена, Генерал: [signature]
> Секретар Канцеларије Краљевских Ордена: [signature]

## Planned points (pins)
1. Medal with ribbon (top center): the Albanska spomenica itself
2. Heading: King Alexander I, Kingdom of Serbs, Croats and Slovenes
3. Decree text: decree dates and numbers, "loyalty to the fatherland 1915"
4. Handwritten recipient: my great-grandfather (personal story to be added by me)
5. "Албанском Споменицом": what the medal commemorates (retreat through Albania 1915/16)
6. Record number and date/place of issue
7. Signatures of the Chancellery of Royal Orders
8. Decorative frame: laurel branches and ornamental border
9. Embossed seal area (bottom right)

Historical explanations must be based on reliable sources (e.g. Military Museum Belgrade,
academic literature). Don't state uncertain facts as certain; flag them for me to check.

## Code quality and standards
Maintainability matters more than cleverness. Set up all tooling in the first step, before
writing features, and keep every check passing.

TypeScript (site):
- `strict: true` in tsconfig, plus `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`.
  No `any`; use `unknown` and narrow it.
- ESLint (flat config) with `typescript-eslint` `strictTypeChecked` + `stylisticTypeChecked`.
- Prettier for formatting; `eslint-config-prettier` so they don't conflict.
- Blank lines between logical blocks, enforced with `@stylistic/padding-line-between-statements`
  (blank line before `return`, after variable declaration groups, around `if`/`for`/`try` blocks).
- Small modules with one responsibility each (e.g. `viewer/`, `pins/`, `panel/`, `tour/`,
  `transcription/`, `data/`). Pure logic separated from DOM code so it can be unit tested.
- Explicit return types on exported functions; TSDoc comments on exported APIs.
- Vitest for unit tests (coordinate conversion, data validation, tour navigation).

Python (pipeline):
- PEP 8, formatted and linted with Ruff (`ruff format`, `ruff check` with a broad rule set,
  including `I`, `B`, `UP`, `N`, `D` with Google-style docstrings).
- Full type hints, checked with mypy in strict mode.
- Each processing step a separate, testable function; config (paths, dpi, tile size) in one
  place, not hard-coded. pytest for tests.
- Dependencies pinned in `pyproject.toml`.

Project-wide:
- `.editorconfig` (UTF-8, LF, 2 spaces for TS/JSON/CSS, 4 for Python).
- Pre-commit hooks running format + lint + type check on staged files.
- GitHub Actions CI running lint, type check, tests and build on every push.
- Conventional Commits for commit messages; README with setup and run instructions.
- Pin exact dependency versions via lockfiles.

## Working style
- Build in small steps; show me the result after each step.
- Start with: project structure → pipeline on the placeholder → basic viewer → pins → mobile UI
  → transcription panel → tour → accessibility pass.
