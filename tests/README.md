# tests

Contract tests for **WeDraw-authored code only** — the planning stage, the
confirm UI's file model, and the judgment gates. The vendored pipeline stays
untested apart from the gate logic WeDraw added inside it; see
[`../CLAUDE.md`](../CLAUDE.md) *What is whose* for the boundary and
[`../docs/rules/code-style.md`](../docs/rules/code-style.md) §11 for the rule.

## Running

Neither suite installs anything. Python uses `unittest`; the TypeScript suite
uses Node's own runner and type stripping, so `model.ts` is read as-is.

```bash
python3 -m unittest discover -s tests                       # 계약 + 게이트 · 106건
node --test --experimental-strip-types tests/*.test.mts     # 화면 모델 · 17건
```

> Pass the file glob, not the `tests/` directory — Node would otherwise try to
> execute `test_planning.py` as JavaScript.

## What is covered

| File | Covers |
|---|---|
| `test_planning.py` | `plan_spec.py` parsing (status · heading · 별첨), `report_form.py` body markup and inline rules, form presets and the type scale, slide titles in `outline.py`, `--format auto` |
| `test_gates.py` | The two checks that decide whether a run may advance — `plan_spec.py --check` (E-FACT · E-PAIR · E-GOAL · E-ALT · E-IR · E-ORDER, frame resolution) and `outline.py --check` (E-OPEN · E-ALT · E-IR · E-SHAPE · E-COVER · E-SYNC, layout assignment, §IX parity) |
| `test_judgment_gates.py` | The four gates that stop an expensive mistake — `template_install_preflight.py` (canvas mismatch stops the install), `_conversion_profile.compare_source_counts` (tables and images lost in conversion), and `svg_quality_checker` `[VERDICT]` (a pass that a truncated read cannot fake) |
| `test_confirm_server.py` | What the confirm page needs from the server while someone waits on it — the heartbeat that stops the idle watchdog killing a page in use, and the progress notes the waiting screen lists (order, the stale cutoff, the cap, a damaged file). Skipped without Flask |
| `outline-model.test.mts` | `ui/src/outline/model.ts` — the `outline.md` round trip, the multi-line recovery, the §8 edits, and the checks the screen shows before saving |

## The design's own matrix

`docs/02-design/features/ppt-service-rebuild.design.md` §8.2–§8.3 lists the
scenarios this stage is supposed to survive. Where a row is covered, the test is
named after it.

| Row | Scenario | Covered by |
|---|---|---|
| L1-1 | 근거 없는 현상 칸 | `L1_1_FactRequiredSections` |
| L1-2 | 영향 없이 기대효과만 → `E-PAIR` | `L1_2_PairedSections` |
| L1-3 | 기간 없는 목표 → `E-GOAL` | `L1_3_TargetShape` |
| L1-4 | 2안 없는 outline → `E-ALT` | `L1_4_Options`, `OutlineGate`, and the TS suite |
| L1-5 | outline N장 → §IX N장 | `L1_5_SectionIXParity` |
| L1-6 | 수치 3개 이상 → `kpi_cards` | `L1_6_LayoutAssignment` |
| L2-1 | 장 순서 드래그 → `n` 재부여 | TS suite |
| L2-2 | 두 장 병합 | TS suite |
| L2-3 | 흐름 다시 고르기 | **Not covered — not implemented.** Reselecting a flow is a regeneration only `outline.py --scaffold` performs, and no route exposes it at that point |
| L2-4 | 장 삭제 후 §IX 반영 | `test_E_SYNC_a_section_ix_that_disagrees_is_caught` |

L3-1 (캠페인 PDF → … → PPTX) needs the real source material, which lives under
the gitignored `projects/`. It runs on a machine that has it, not here.

## Why these cases

Every test states a contract someone can read off a reference document. Two are
marked `# regression` because they are defects that reached a rendered document:

- `status:` was read with `\S+`, so `확인 필요` parsed as `확인` and every
  downstream comparison against the full string went dead
- the 각주 rule matched the first `*` of `**1안**`, so both option lines rendered
  as footnotes carrying a stray asterisk
- `pick_shape` counted no figure in `3200만원`, so a 수치 나열 slide was assigned
  the plain body layout — found by writing L1-6

Both were confirmed to fail when the defect is reintroduced and to pass once it
is fixed. A regression test that does not fail on its own bug is decoration.
