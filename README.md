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

## 처음부터 설치 (실습생용)

이 저장소는 **슬라이드 생성기가 아니라 그 확인 화면**입니다. 먼저 upstream을
받아야 합니다.

준비물: Python 3.9+, git, Claude Code. macOS 기준입니다.

```bash
# 1. upstream (실제 PPT 파이프라인)
git clone https://github.com/byungjunjang/slide-master.git ~/dev/slide-master

# 2. 파이썬 의존성
python3 -m pip install flask

# 3. 이 저장소
git clone https://github.com/wedraw-ricky/wdb-ppt-ui.git ~/dev/wdb-ppt-ui

# 4. upstream 경로를 알려준다 (wdb-ui.config.json에 기록되고 gitignore됩니다)
cd ~/dev/wdb-ppt-ui
python3 install.py --ppt-master ~/dev/slide-master/.claude/skills/ppt-master
```

확인:

```bash
python3 server.py ~/dev/slide-master/projects/<프로젝트> --daemon
```

`--wire-stub`은 `~/.claude/skills/ppt-master/SKILL.md` 전역 스텁이 **이미 있을 때만**
씁니다. 전역 등록을 하지 않았다면 위처럼 `server.py`를 직접 부르면 됩니다.

### 서체

UI 미리보기용 Paperlogy는 저장소에 웹폰트로 들어 있어 따로 설치할 필요가 없습니다.
다만 **덱을 PPTX로 뽑을 때는** 쓰는 서체가 PC에 설치돼 있어야 합니다 — PPTX는
서체를 파일에 품지 않습니다.

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

## Deck templates

`decks/` holds deck templates this overlay adds to the ppt-master library.
`server.py` composes them with upstream's decks into `.decks-merged/`
(symlinks + a merged index) and points `_DECKS_DIR` there, so an overlay deck
shows up on the template card without a file ever being added to upstream.

| Deck | Pages | Source |
|---|---|---|
| `withby-green` | 9 | ported from the `withb-green-design` skill; archetypes A–I, coordinates measured from its original 19-slide PPTX |

## UI

The confirm page is a React 19 + HeroUI v3 + Tailwind v4 app in `ui/`, built
into `static/app/` and **committed**, so the page runs offline with no
`npm install` on the machine that serves it.

```bash
cd ui && npm install      # only to change the UI
npx vite build            # -> static/app/confirm.js + confirm.css
```

`ui/src/api.ts` holds the contract (state shape, stage payloads, validation)
separately from the components — that split is what let the port be verified by
diffing `result.json` against the previous vanilla page.

WDB tokens are mapped onto HeroUI's semantic CSS variables in `ui/src/theme.css`
(`--accent`, `--background`, `--surface`…), so every component inherits the
brand without per-component colour work.

The previous vanilla page is still in `static/` (`app.js`, `style.css`); point
`static/index.html` back at them to fall back.

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
