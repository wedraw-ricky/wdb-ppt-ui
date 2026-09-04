# CLAUDE.md

This repository holds both halves of the deck service: the **pipeline** under
`.claude/skills/` and the **confirm UI** under `ui/` + `static/`. One clone, no
cross-repo path configuration.

> **Origin**: the pipeline is Hugo He's `ppt-master`, adapted for Korean use by
> byungjunjang as `slide-master`, and vendored here under MIT. WeDraw added the
> confirm UI and the planning stage. See [`README.md`](README.md) 만든 사람들
> and [`LICENSE`](LICENSE). This repository no longer tracks upstream; consult
> https://github.com/byungjunjang/slide-master directly when you want to see
> what changed there.

## What is whose

Nothing here merges back upstream, so every file in this repository may be
changed. What differs is the *cost* of changing it.

| Area | Author | Notes |
|---|---|---|
| SVG / direct-PPTX pipeline — `scripts/`, most `references/`, `templates/`, `workflows/` | Vendored (Hugo He → byungjunjang) | Ours to edit, but it is a large body of working code with conventions of its own |
| Planning stage — `planner.md` · `storyline.md` · `report-format.md`, `plan_spec.py` · `outline.py` · `render_plan_doc.py` · `report_form.py`, `templates/report_forms/`, SKILL.md Steps 3.5–3.7 | WeDraw | New work; change it whenever the thinking changes |
| Confirm UI — `ui/`, `static/`, [`DESIGN.md`](DESIGN.md) | WeDraw | Same |
| This file, [`AGENTS.md`](AGENTS.md), [`docs/rules/`](docs/rules/), `docs/00-pm` · `01-plan` · `02-design` | WeDraw | Same |

**Hard rule — two kinds of rule, two different bars**:

- A rule that records a **decision** — `DESIGN.md`, `report-format.md`, this file —
  is rewritten whenever the decision changes. That is what it is for.
- A rule that **describes existing code** — `docs/rules/code-style.md`, the marker
  in [`docs/rules/prompt-style.md`](docs/rules/prompt-style.md) — cannot be
  rewritten alone. Change it without migrating the code it describes and the
  document starts lying about the repository. Migrate first, or scope the rule.

## Confirm UI (WeDraw)

The React confirm page lives in `ui/` and builds into `static/app/`. `server.py`
serves it and the pipeline's own `confirm_ui` routes. Design rules and the
decision log live in [`DESIGN.md`](DESIGN.md); read it before any UI change.

**Hard rule**: a rule applied to one confirmation stage applies to all of them.

---


> **Cross-harness (dual-host)**: [`AGENTS.md`](AGENTS.md) is the Codex-side execution-rules layer — it references this file as SSOT and only adds enforcement, so content edits here do not need mirroring there. `.codex/skills/` holds **generated** Codex discovery stubs: after editing any `.claude/skills/<name>/SKILL.md` frontmatter, run `python3 .claude/skills/ppt-master/scripts/sync_codex_stubs.py` (never hand-edit stubs; `preflight.py` fails while they are stale). Skill content itself lives only in `.claude/skills/`.

**Route before full-load (mandatory)**: for a presentation request, first read
[`.claude/skills/ppt-master/workflows/routing.md`](.claude/skills/ppt-master/workflows/routing.md).
Select the route there, then read only the selected execution owner(s) in full.
Do not preload the main SVG skill for a direct-PPTX route. For a repository edit,
read the owner of the contract being changed; the main skill is authoritative only
for the main SVG family and the shared SVG steps that explicitly invoke it.

## Project Overview

PPT Master is a presentation workflow package with SVG-authoring and direct-PPTX
route families. The main SVG family uses Strategist → Image_Generator → Executor
to convert source documents into editable DrawingML. Direct-PPTX routes preserve
an existing PowerPoint package and use their own execution gates.

**Main SVG Pipeline**: `Source Document → Create Project → [Template] → Strategist confirmation stage → [Image_Generator] → Executor Live Preview → Quality Check → Post-processing → Export PPTX`

**Route selection authority**:
[`.claude/skills/ppt-master/workflows/routing.md`](.claude/skills/ppt-master/workflows/routing.md)
owns the complete matrix and wins over every summary below.

| Selected family | Full execution owner(s) |
|---|---|
| New SVG-authored deck or PPTX re-architecture | [Main `ppt-master/SKILL.md`](.claude/skills/ppt-master/SKILL.md) |
| Existing PPTX, strict 1:1 wording/page preservation with visual redesign | [`beautify-pptx.md`](.claude/skills/ppt-master/workflows/beautify-pptx.md), then the main skill only at its explicit shared-SVG handoff |
| Raw PPTX template plus new material/topic | [`ppt-template-fill/SKILL.md`](.claude/skills/ppt-template-fill/SKILL.md) only |
| Finished PPTX, stable visible content/layout, add notes/audio/timing/transitions | [`native-enhance-pptx/SKILL.md`](.claude/skills/native-enhance-pptx/SKILL.md), then its required execution workflow |
| Reusable template creation or another standalone workflow | The selected workflow; load another owner only at an explicit handoff |

An ambiguous PPTX optimization request stays in the router until its one
discriminator question resolves whether the deck is 1:1 beautify or
re-architectable source. Do not load either full owner before that answer.

## Execution Ownership

- The selected skill or workflow owns its confirmations, preflight, validation,
  recovery, export, and completion gates. This root file adds none.
- Shared scripts do not transfer gate ownership between SVG and direct-PPTX
  families.
- Topic research, template creation, and post-route workflows load the next
  owner only when their own procedure declares a handoff.

## Font Policy (install-local, standing preference)

Decks and documents are different products and do not share a font rule.

| Product | Rule |
|---|---|
| SVG-authored deck | **Pretendard**, fixed (below) |
| Direct-PPTX route | Source fonts preserved unless the selected owner says otherwise |
| 기획서 · 보고서 `.docx` | The **report form** decides — [`templates/report_forms/*.json`](.claude/skills/ppt-master/templates/report_forms/). `khnp` uses Pretendard, `bok` uses 맑은 고딕 / 한컴바탕. The deck lock does not reach a document |

- Every SVG-authored deck uses **Pretendard** as the fixed font family — do not propose or pick other families unless the user explicitly asks in the current conversation. Hierarchy comes from weight/size, not family switching. Direct-PPTX routes preserve source fonts unless their selected owner says otherwise. Full contract: [`strategist.md §g` install-local font lock](.claude/skills/ppt-master/references/strategist.md).
- Stack: `Pretendard, "Malgun Gothic", sans-serif`; intermediate weights use installed family names (`"Pretendard Medium"`, `"Pretendard SemiBold"`, etc.).
- Font files are bundled at [`.claude/skills/ppt-master/assets/fonts/Pretendard/`](.claude/skills/ppt-master/assets/fonts/Pretendard/) (SIL OFL) and installed user-level on this machine. PPTX does not embed fonts — decks shared to other machines need Pretendard installed there.

## Required Conventions

- **Repo-wide style rules** — when editing prompt files under [`.claude/skills/ppt-master/references/`](.claude/skills/ppt-master/references/), Python under [`.claude/skills/ppt-master/scripts/`](.claude/skills/ppt-master/scripts/), or any other code/prose in the repo, follow the matching style rule in [`docs/rules/`](docs/rules/).
- **Markdown language consistency** — Markdown files under `.claude/skills/ppt-master/workflows/`, `.claude/skills/ppt-master/references/`, and `docs/` are currently single-language per directory. New files mirror the language of their siblings; do not mix English scaffolding with Chinese paragraphs (or vice versa) inside one file. Chat replies are unaffected.

## Compatibility Boundary

- This repository is a workflow/skill package, not an app or service scaffold.
- Do NOT assume generic-project conventions like `.worktrees/` or mandatory branch setup unless the user explicitly requests them.
- **Tests are scoped, not banned.** The vendored pipeline ships none and stays that way — [`docs/rules/code-style.md §11`](docs/rules/code-style.md) describes what is there, and a suite for it means migrating hundreds of files. WeDraw-authored code (the planning stage and the confirm UI, listed under *What is whose*) may carry lightweight tests where a contract is machine-checkable; two defects that reached a rendered document — a `status:` value silently truncated, and an option line parsed as a footnote — were each a one-line test. They live in [`tests/`](tests/) — `python3 -m unittest discover -s tests` and `node --test --experimental-strip-types tests/*.test.mts`, neither of which installs anything.
- On conflict with a generic coding skill, prioritize the selected repo-local
  execution owner. The main [`ppt-master/SKILL.md`](.claude/skills/ppt-master/SKILL.md)
  has that role only when routing selected the main SVG family or an explicit
  shared-SVG handoff.

## Execution Pointers

Commands and defaults belong to the selected owner; use these pointers instead
of treating a root-level command list as a gate checklist.

| Work | Runtime authority |
|---|---|
| Route selection | [`routing.md`](.claude/skills/ppt-master/workflows/routing.md) |
| Main SVG generation and re-architecture | [`ppt-master/SKILL.md`](.claude/skills/ppt-master/SKILL.md) |
| Strict 1:1 SVG beautify | [`beautify-pptx.md`](.claude/skills/ppt-master/workflows/beautify-pptx.md) and only the shared main steps it invokes |
| Raw template fill | [`ppt-template-fill/SKILL.md`](.claude/skills/ppt-template-fill/SKILL.md) |
| Finished-PPTX native enhancement | [`native-enhance-pptx/SKILL.md`](.claude/skills/native-enhance-pptx/SKILL.md) |
| Standalone workflow inventory | [`workflows/index.md`](.claude/skills/ppt-master/workflows/index.md) |
| Planning stage — intake · 기획 · 뼈대 | [`planner.md`](.claude/skills/ppt-master/references/planner.md) · [`storyline.md`](.claude/skills/ppt-master/references/storyline.md), driven from SKILL.md Steps 3.5–3.7 |
| 기획서 · 보고서 Word 산출 | [`report-format.md`](.claude/skills/ppt-master/references/report-format.md) |

## Core Directories

- `.claude/skills/ppt-master/SKILL.md` — main SVG workflow authority.
- `.claude/skills/ppt-template-fill/SKILL.md` — raw-template direct-PPTX authority.
- `.claude/skills/native-enhance-pptx/SKILL.md` — finished-PPTX enhancement entry owner.
- `.claude/skills/ppt-master/references/` — role definitions and technical specifications.
- `.claude/skills/ppt-master/scripts/` — runnable tool scripts.
- `.claude/skills/ppt-master/scripts/docs/` — topic-focused script docs.
- `.claude/skills/ppt-master/templates/` — layout templates, chart templates, icon library, brand presets.
- `.claude/skills/ppt-master/templates/report_forms/` — Word report form presets (`bok`, `khnp`); a new house style is a new JSON file.
- `.claude/skills/ppt-master/workflows/` — standalone workflow files.
- `docs/` — user-facing documentation (FAQ, installation, technical design, templates guide, audio narration).
- `docs/rules/` — repo-wide style rules.
- `projects/` — user project workspace.
