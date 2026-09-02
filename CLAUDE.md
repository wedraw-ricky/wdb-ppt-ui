# CLAUDE.md — WDB Confirm UI

## Design System

Read `DESIGN.md` before any visual or UI change. Colours, type, layout and the
interaction rules are defined there. Do not deviate without saying so.

The rule that matters most: **show the thing being chosen, never describe it in
a list.** This screen decides visual outcomes, so every picker renders evidence
— a real thumbnail, a true-ratio shape, a diagram. A free-text field always gets
preset chips above it.

## Architecture

- `server.py` wraps upstream's confirm server and redirects three things at it
  (`__file__`, `_CATALOGS_PATH`, `static_folder`). Upstream is never modified.
- `ui/` is the React 19 + HeroUI v3 + Tailwind v4 source. Build with
  `cd ui && npx vite build` → `static/app/` (committed, so it runs offline).
- `ui/src/api.ts` is the contract with the pipeline: state shape, stage
  payloads, validation, typography normalisation. **Changing it can break deck
  generation** — verify `result.json` still carries every field in
  `scripts/docs/confirm_ui.md` before shipping.
- `static/app.js` / `static/style.css` are the previous vanilla page, kept as a
  fallback. Repoint `static/index.html` to revert.

## Review

After changing `ui/src/` or `static/`, run the `ui-design-review` agent before
rebuilding.
