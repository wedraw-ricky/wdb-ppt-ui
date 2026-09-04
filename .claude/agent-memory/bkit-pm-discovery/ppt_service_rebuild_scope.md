---
name: ppt-service-rebuild-scope
description: Scope and axes for the internal ppt-master/wdb-ppt-ui rebuild discovery (2026-09), as set by 유민균 대표
metadata:
  type: project
---

The 대표 (유민균, wedraw) scoped a rebuild discovery to exactly four axes: 제작 사고과정
(agent reasoning during production), 플로우 (stage-transition flow), UI 편의 (UI
convenience), 유려함 (polish). He explicitly excluded SVG-authoring quality and
export quality from scope — solutions must not touch those areas.

He also raised one backlog item, parked for v1: canvas-size-aware style
personality (A4/16:9/9:16 should have different typographic/layout instincts
while keeping one visual identity) — tracked against the `canvas_format` lock in
`references/structured-templates.md`.

Three real users: 대표 himself (judges as a professional deck producer, not a
developer), trainees (cold-start public repo users), and the agent itself
(many failure modes are prompt-contract reasoning gaps, not code bugs).

Two repos involved: fork `slide-master` at `/Users/rickys/dev/workspaces/pptskill`
(prompt contracts + scripts) and overlay `wdb-ppt-ui` at
`/Users/rickys/dev/workspaces/wdb-ppt-ui` (React 19 + HeroUI v3 confirm UI,
imports upstream confirm server via 4 redirects, never modifies upstream).

**Why**: this framing determines what solutions are even in-scope — do not
propose SVG/export fixes for this initiative even if they seem related.
**How to apply**: when asked to continue or update this discovery/PRD work,
re-check current repo state (this is a snapshot from 2026-09-04) rather than
trusting specific line numbers or commit hashes cited in earlier passes.

Full discovery output (5-step chain: brainstorm/assumptions/prioritize/
experiments/OST) was written to a scratchpad path in that session, not
persisted in-repo — re-run the discovery chain if this work needs to be
picked up again rather than looking for a saved report file.
