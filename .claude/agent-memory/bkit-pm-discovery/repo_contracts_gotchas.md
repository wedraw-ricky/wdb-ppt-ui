---
name: repo-contracts-gotchas
description: Verified (as of 2026-09-04) gaps in ppt-master prompt contracts / scripts relevant to PM discovery work on this repo
metadata:
  type: reference
---

Verified by reading source during the 2026-09 rebuild discovery ([[ppt-service-rebuild-scope]]):

- `references/strategist.md` §e ("User / template colors are truth") has no
  precedence rule for template-color vs client-CI-color conflicts.
- `references/structured-templates.md`: a structured deck template's Master
  geometry is fixed to its `canvas_format`; `adaptive` mode may only add a
  Layout, never change the Master — so a deck template cannot be re-laid-out
  to a different canvas ratio. Relevant to the parked canvas-size-personality
  backlog item.
- `scripts/source_to_md/_conversion_profile.py`: `table_count` is computed
  ONLY from the output Markdown via regex — there is no source-side (e.g.
  PDF) table count anywhere in that file, so there is no comparison logic to
  even build a warning on top of. Any "warn on table loss" solution needs a
  new source-side counter built from scratch, not just a threshold check.
- `scripts/register_template.py`: no paint-order or layout lint at template
  registration time.
- `scripts/confirm_ui/server.py`: idle_timeout defaults to 900s;
  `_stage_skip`/`_stage_skip_error` only guard forward progression — there is
  no "go back to a previous confirmed stage" code path today, so a
  back-navigation feature is a new state-transition design, not a UI toggle.

**Why**: these are the concrete gaps a rebuild PRD would name as root causes;
re-verify before citing specific line numbers, since prompt contracts and
scripts change often in this repo.
**How to apply**: when scoping fixes for agent-reasoning or flow failures in
this repo, check whether the gap is a missing prompt rule (cheap) vs missing
code/data (e.g. source-side table counting) before estimating effort.
