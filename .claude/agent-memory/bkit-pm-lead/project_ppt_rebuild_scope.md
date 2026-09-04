---
name: project-ppt-rebuild-scope
description: Scope boundaries the 대표 set for the ppt-service-rebuild PRD (2026-09-04) — 4 in-scope axes, explicit out-of-scope, one parked backlog item
metadata:
  type: project
---

For the `ppt-service-rebuild` initiative (PRD written 2026-09-04 at `docs/00-pm/ppt-service-rebuild.prd.md`), the 대표 fixed scope as:

- IN: 플로우 (stage-to-stage flow), 유려함 (polish), UI 편의 (confirm-UI convenience), 제작 사고과정 (the agent's reasoning during production).
- OUT: 제작 단계 자체와 결과물 품질 — he said SVG authoring and export quality are fine. Do not propose reworking them.
- PARKED (backlog, not v1): canvas-size-aware style personality — keep one visual identity but let A4 / 16:9 / 9:16 have different typographic and layout instincts.

**Why:** The evidence came from one 2026-09-03 session (KHNP deck + speakup deck) where the costliest failures were agent reasoning (CI colour demoted to accent, false "template re-lays out to new ratio" promise that wasted 8 authored pages, `head -20` truncating checker errors, silent PDF table loss) rather than rendering quality.

**How to apply:** In `/pdca plan` and `/pdca design` for this feature, reject scope creep into SVG/export quality, and keep "where does the fix live" split explicit: fork pipeline (`slide-master`, prompt contracts + scripts) vs overlay (`wdb-ppt-ui`, React confirm page). Related: [[user-decision-maker]].
