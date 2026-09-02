# WDB Confirm UI

A drop-in front-end for the **ppt-master** Strategist confirmation page
(`byungjunjang/slide-master`, SKILL.md Step 4).

Upstream is never modified. `server.py` imports upstream's confirm server and
redirects three things at it, then hands control straight back — so the lock
file, port search, `--daemon` / `--wait` / `--shutdown` lifecycle, the `/api/*`
routes, and the `recommendations.json` → `result.json` contract are all
inherited verbatim.

| Redirect | Why |
|---|---|
| `server.__file__` | upstream re-spawns its own file as the serving child; every other `__file__` use there is an import-time constant, so reassigning it after import steers only that spawn |
| `_CATALOGS_PATH` | module-level constant — `/api/catalogs` would otherwise keep serving upstream's copy |
| `app.static_folder` + static view | serve our files, fall back to upstream for everything we don't override (`style_previews/` stays current automatically) |

## Install

```bash
python3 install.py --ppt-master ~/dev/workspaces/pptskill/.claude/skills/ppt-master
```

Add `--wire-stub ~/.claude/skills/ppt-master/SKILL.md` to make the global skill
stub launch this overlay instead of upstream's confirm server.

Resolution order for the ppt-master path: `WDB_UI_PPT_MASTER_DIR` env var →
`wdb-ui.config.json` (gitignored) → a clear error.

## Run

Same arguments as upstream:

```bash
python3 server.py <project_path> --daemon --wait
python3 server.py <project_path> --shutdown
```

## Bundled font

`static/fonts/` carries five weights of **Paperlogy** as `woff2` (SIL OFL 1.1 —
see `static/fonts/NOTICE.md`), so the page renders in the deck typeface on any
machine, offline, without a local install. `@font-face` lists `local()` first,
so an installed copy is used with no download.

This applies to the HTML page only — the SVG slide pipeline forbids
`@font-face` and is unaffected.

## Layout

```
server.py     entry point + the three redirects
install.py    writes wdb-ui.config.json, optionally wires the global stub
static/       index.html · app.js · style.css · catalogs.json
```

Files absent from `static/` fall through to upstream, so this repo only carries
what it actually changes.
