# VNPT Design System docsite

Static documentation generated from the Figma semantic snapshot and original token ZIP. The UI follows the Spectrum UI docs reference; FAQ is excluded.

## Local development

Requires Node.js 20.11 or later. Build dependencies are pinned in package-lock.json. A prebuilt site runs with Node alone; a fresh GitHub clone must build it first.

```sh
node scripts/serve.mjs --no-build
```

For editing and rebuilding on the current Mac, restore dependencies from the included npm cache:

```sh
npm ci --offline --cache vendor/npm-cache
npm run dev
```

Open http://localhost:4173/docs/components/alert.

```sh
npm run build
npm run check
```

## Source and generated files

- `source/inventory.json`: all 60 source pages, 420 token identities / 506 values, 87 styles, component catalogue and resolved dependencies.
- `source/*code-contexts.json` and `source/live-contexts/`: saved Figma code references for exact variant tuples.
- `source/badge-layer-specs.json`, `source/additional-preview-scenes.json`, `source/sf-symbol-map.json`: exact layer metrics and supplementary source leaves.
- `scripts/build-previews.mjs`, `preview-css.mjs`, `scene-preview.mjs`: compile the saved Figma references into standalone browser code without runtime Tailwind or React.
- `vendor/npm-cache/`: build dependencies cached for offline restore on this Mac; excluded from Vercel uploads.
- `public/source-previews/`: 112 labelled Figma reference screenshots.
- `public/assets/`: exact SVG/raster assets used by adapters and source prototypes; temporary URLs are replaced with local files.
- `public/prototype-previews/`: 40 native PNG exports with transparency, without the canvas background.
- `public/gallery/` and `source/asset-gallery.json`: 1,379 individual images across Logo & App icon (8), Screenshots on Store (33), Icons (1,244), and Illustrations (94), with native files, resolution metadata and web thumbnails.
- Assets pages show images, Figma links and native PNG/JPG download sizes. Smaller downloads are generated from the master file; files are never enlarged beyond the available export.
- Sidebar groups form a single-open accordion. Integrations, Guidelines & History and Supplemental are omitted from the sidebar; machine-readable endpoints remain available. The right rail has only the table of contents.
- `src/`: templates, CSS and browser interactions.
- `scripts/build.mjs`: generates 68 documentation routes, public JSON endpoints, `llms.txt`, `llms-full.txt`, `agents.md` and CSS token mappings.
- `dist/`: reproducible output; overwritten by build.

All source text remains available with source node IDs. Component specifications preserve actual variants, props, dimensions, root styles and variable/style references. The semantic snapshot is not a complete native Figma file or leaf-geometry/rich-text export.

Component documentation targets iOS Swift and Android Kotlin/Java. All 40 pages show Preview / Code / Copy Prompt. All 571 actual Figma variants render from local HTML/CSS/JavaScript, using exact leaf SVG/raster assets rather than a whole-component screenshot. The Code tab fetches the same file displayed in the preview iframe. Multi-state components have Usage grids, filtering and View code actions. Bottomsheet uses a light gray preview canvas. Sourced usage rules, root design specs/token bindings and component-specific accessibility guidance are retained. Fake package badges and package installation commands are omitted.

These are executable browser previews. Native implementation uses the selected design spec in the app framework; no Swift/Kotlin/Java SDK is published. Figma GLASS effects and system font rendering still require comparison in the native app.

- `/data/component-index.json`: all 40 component/application pages.
- `/data/components/{slug}.json`: 571 actual component variants with root geometry, exact binding paths, mode values, alias chains, original Figma property names/IDs and source links.
- `/data/component-variants/{slug}/{node-id}.json`: small per-variant files loaded on demand by the UI.
- `/context/{slug}.md`: portable agent context. The Copy agent context action uses the currently selected variant and brand.
- `/data/previews/{slug}.json`: all actual code preview cases, source URLs, dimensions and asset lists.
- `/previews/{slug}/{node-id}.html`: the exact code shown by the Code tab. HTML source downloads reference local `/assets/` paths; copy the manifest assets too when moving them to another project.
- `/data/preview-coverage.json`: build coverage for 40 pages / 571 variants.
- `/data/component-assets/{slug}.json`: all local files used by the published previews and retained prototypes. This is not a full Figma leaf-layer export.
- `/data/pages/{page-id}.json` and `/llms-source-archive.txt`: retained raw source/archive data.

Native framework choices, pt/dp/sp policies and production component source are not provided. No Swift/Kotlin/Java SDK or native API is claimed. Child-layer typography/role mappings cannot be inferred from page-wide occurrences; use the Figma variant node for these. Legacy `/code/*.tsx` and `/components/*.html` are retained as web visual references. New live previews use `/previews/`.

`public/brand/vnpt-app-icon.png` is the exact user-supplied VNPT icon, used by the header, favicon and Apple touch icon.

## Vercel

Production: https://vnpt-design-system.vercel.app

Project: `quoctuan161299-3982s-projects/vnpt-design-system`. Updated on October 1, 2026 after review approval.

Use this `docsite/` directory as project root. `vercel.json` sets `npm run build`, output directory `dist`, and clean URLs. Sitemap and robots.txt use `SITE_URL` when supplied, otherwise Vercel's production domain automatically.

This local backup includes the project metadata but not the CLI login session. To deploy to the existing account, sign in again and use the `.vercel/project.json` link:

```sh
NO_UPDATE_NOTIFIER=1 npx vercel@61.1.0 login --global-config ../work/vercel-auth
NO_UPDATE_NOTIFIER=1 npx vercel@61.1.0 deploy --prod --archive=tgz --global-config ../work/vercel-auth
```

To continue under a different Vercel account, sign in to that account, preserve the old link and link a new project before deployment:

```sh
mv .vercel .vercel-previous
NO_UPDATE_NOTIFIER=1 npx vercel@61.1.0 link --yes --project vnpt-design-system --global-config ../work/vercel-auth
NO_UPDATE_NOTIFIER=1 npx vercel@61.1.0 deploy --prod --archive=tgz --global-config ../work/vercel-auth
```

New CLI authentication is stored outside the deploy root in `../work/vercel-auth`; the backup script excludes it. `.vercelignore` excludes generated output, local environment files and CLI project metadata. Public access, component routes, the four asset galleries, token JSON, agent resources and production sitemap were checked without authentication. Local build and preview do not require any login.

## Source caveats retained in the site

- VNPT and VIBE CLUB are brand modes. Light/Dark are primitive palettes.
- `Grid/4 Col` actually defines 12 columns; canvas grid guidance has a separate 4/6/12 layout rule.
- All local text styles are SF Pro Display; Android token is Inter Tight.
- Draft and WIP content is labelled. COMPLETED text is scoped source evidence.
- Alias key matches do not merge remote snapshots; one style lookup returns null.
- Alert's component description and canvas description differ in scope; both are preserved for review.

Snapshot provenance and agent rules are in `dist/data/manifest.json` and `dist/agents.md`.

For another platform, run `npm ci` if its esbuild binary is not in the offline cache. Public npm installation requires no previous account.

The repository omits `dist/`, `node_modules/`, Vercel login files and backup archives. Build output is regenerated with `npm run build`; source snapshots, token ZIP, assets and the offline npm cache are committed.
