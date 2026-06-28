# Design Sync Notes — The Feast Factory UI

## Setup quirks

- **No standalone library package**: Components live in `apps/customer-web/components/ui/`, not a dedicated `packages/ui`. The converter is driven with an explicit `--entry apps/customer-web/components/ui/ds-entry.ts` that excludes Next.js-dependent components.
- **PKG_DIR resolves to `apps/customer-web`**: The converter walks up from the entry file and finds `apps/customer-web/package.json`. All config paths (`tsconfig`, `cssEntry`, `componentSrcMap`) are relative to that directory.
- **`tsconfig.json` path**: Must be `"tsconfig.json"` (relative to `apps/customer-web`), NOT `"apps/customer-web/tsconfig.json"`.
- **`cssEntry` path**: Points at `.ds-combined.css` (inside `apps/customer-web/`). This is a flat pre-processed file combining the Google Fonts `@import url(...)`, the compiled Tailwind output (`.ds-ui.css`), and a `:root` block defining `--font-sans`/`--font-heading`. It must be rebuilt after every Tailwind recompile — see step 2 of the re-sync command below. Do NOT point `cssEntry` at a file that uses relative `@import` statements (e.g. `@import "./.ds-ui.css"`) — the converter copies it verbatim as `_ds_bundle.css` and the relative path won't resolve in the design project.
- **No `.d.ts` files**: The package has no dist. All component types are provided via `dtsPropsFor` in config. If component signatures change, update `dtsPropsFor` too.
- **`StatePanel` and `AuthRequiredPanel` excluded**: They import `next/link`, which can't bundle outside Next.js. They are nulled in `componentSrcMap`.
- **Playwright installed in `.ds-sync/`**: Chromium is in `~/.cache/ms-playwright/`. Re-running on a fresh machine requires `npx playwright install chromium` inside `.ds-sync/`.
- **MUI Select children pattern**: The `Select` component takes `<option>` elements as children — it maps them to MUI `MenuItem` internally. Always provide children with `value` props, or the select renders blank.

## Re-sync command

```bash
# 1. Recompile Tailwind CSS (if components changed) then annotate --tw-* internals.
#    The annotation step is required every time the CSS is recompiled — it annotates
#    Tailwind's 125 reset/utility variables with /* @kind other */ so the design-system
#    token scanner skips them and counts only the 23 real :root brand tokens.
npx --prefix apps/customer-web tailwindcss -i apps/customer-web/app/globals.css -o apps/customer-web/.ds-ui.css --config apps/customer-web/tailwind.config.ts --content "apps/customer-web/components/ui/*.tsx"
node .design-sync/patch-tw-vars.mjs apps/customer-web/.ds-ui.css

# 2. Rebuild the combined CSS (REQUIRED every time after step 1).
#    cfg.cssEntry points at .ds-combined.css, which is a flat file that inlines:
#      - Google Fonts @import for Inter + Playfair Display (Next.js injects these at runtime;
#        the design project has no Next.js, so they must ship in the bundle CSS)
#      - The full Tailwind output from .ds-ui.css
#      - :root block setting --font-sans and --font-heading
#    This is what resolves [FONT_REMOTE] and eliminates [TOKENS_MISSING] for font vars.
printf '@import url("https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;0,800;0,900;1,400;1,500;1,600;1,700;1,800;1,900&family=Inter:wght@400;500;600;700&display=swap");\n\n' > apps/customer-web/.ds-combined.css
cat apps/customer-web/.ds-ui.css >> apps/customer-web/.ds-combined.css
printf '\n\n:root {\n  --font-sans: '"'"'Inter'"'"', ui-sans-serif, system-ui, sans-serif;\n  --font-heading: '"'"'Playfair Display'"'"', Georgia, serif;\n}\n' >> apps/customer-web/.ds-combined.css

# 3. Re-stage scripts (always — stale .ds-sync/ runs old converter)
cp -r "<skill-base-dir>"/{package-build,package-validate,package-capture,resync}.mjs "<skill-base-dir>"/lib "<skill-base-dir>"/storybook .ds-sync/

# 4. Fetch remote anchor
# (DesignSync get_file _ds_sync.json → .design-sync/.cache/remote-sync.json)

# 5. Run resync driver
node .ds-sync/resync.mjs --config .design-sync/config.json --node-modules ./node_modules \
  --entry ./apps/customer-web/components/ui/ds-entry.ts --out ./ds-bundle \
  --remote .design-sync/.cache/remote-sync.json
```

## Known render warns

- `DateField` — "Required" and "Empty" variants render identically (required flag is not visually distinct in the MUI date picker). Single-look component — intentional.

## Known validate warnings (non-blocking)

- `[TOKENS_MISSING]` for Tailwind internals only (`--tw-shadow`, `--tw-ring-*`, `--tw-translate-*`, `--tw-rotate`, etc.) — expected. These are Tailwind reset utilities that `patch-tw-vars.mjs` annotates as `/* @kind other */` so they are excluded from token counting but still flagged as missing by the validator. Safe to ignore every re-sync. `--font-sans` and `--font-heading` are NO LONGER missing — they are now defined in `.ds-combined.css` via the `:root` block.
- `[FONT_REMOTE]` for `"Inter"` and `"Playfair Display"` — informational, not a warning. Means the Google Fonts `@import url(...)` was detected in `_ds_bundle.css` and families are resolved at runtime. Expected and correct.
- `[RENDER_SKIPPED]` — render check was skipped (2026-06-28) because Playwright/Chromium was not installed on the machine. Install with: `cd .ds-sync && npm i playwright && npx playwright install chromium`. The components' source and previews had not changed since the last verified upload, so skipping was low-risk.

## Re-sync risks

- **`dtsPropsFor` in config can drift**: If component props change in the source `.tsx` files, the `dtsPropsFor` entries in `config.json` won't update automatically. Check them on any re-sync after an API change.
- **Authored previews tied to component API**: `.design-sync/previews/*.tsx` use specific props. If a component's API changes (e.g., `Select` switches from `<option>` children to a different pattern), previews will fail to build.
- **MUI emotion styles**: MUI injects styles at runtime via emotion. If MUI version changes or emotion breaks, previews may render unstyled — the render check will catch it.
- **CSS custom properties are the only styling bridge for layout**: The Tailwind content scope covers only the 9 UI component files. Utility classes like `bg-card`, `text-foreground`, `border-border` are NOT in the bundle CSS. Use `var(--*)` custom properties for layout glue in designs.
- **`ds-entry.ts` must be kept in sync with added components**: If new components are added to `components/ui/`, add them to `ds-entry.ts` AND to `componentSrcMap` in config, and author a preview.
