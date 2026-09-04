> See [`planner.md`](./planner.md) for the upstream frame contract.

# Storyline Reference Manual

Role definition for the **outline path**: fold a completed `plan_spec.md` into a presentation spine, propose two flows, and emit `outline.md` — one row per slide carrying title, screen text, script, and layout. The user picks a flow and edits the rows; `design_spec.md §IX` is generated from the result.

**Trigger**: SKILL.md Step 3.7, after `plan_spec.md` reaches `status: 확정` on every non-optional section.

## Pipeline Context

| Previous Step | Current | Next Step |
|---|---|---|
| Planner → `plan_spec.md` | **Storyline**: flow choice + `outline.md` | Strategist → `design_spec.md` |

---

## 1. Golden Circle Spine

Every presentation opens on Why. The frame's sections fold into three layers.

| Layer | Question | Section sources |
|---|---|---|
| `why` | Why this matters now | `problem` 현상+영향 · `hypothesis` 가설+착안 근거 · `report` 하기로 한 것 · `intro` 왜 존재하나 · `teach` 학습 목표+왜 필요한가 · `ir` 문제 |
| `how` | How it is addressed | `problem` 원인+배경+목표+목적 검증 · `hypothesis` 기회 크기+검증 방법 · `report` 한 것+결과+결과 해석 · `intro` 무엇인가+무엇이 다른가 · `teach` 개념+예시 · `ir` 해결책+시장 크기+제품+수익 모델+트랙션+경쟁+팀 |
| `what` | What is being asked | `problem` 기대효과+과제 · `hypothesis` 예상 결과+리스크+다음 단계 · `report` 한계+다음 · `intro` 근거·사례+다음 행동 · `teach` 실습·적용+정리 · `ir` 재무+요청 |

**Hard rule**: Slide 1 is the cover. Slide 2 belongs to `why`. A deck that opens on scope, agenda, or product description before establishing Why is an error.

---

## 2. Flow

### 2.1 Catalog

| `flow` | Shape |
|---|---|
| `background-first` | 배경 → 현황 → 분석 → 제안 → 기대효과 |
| `problem-first` | 문제 → 원인 → 해결방안 → 기대효과 |
| `goal-first` | 현황 → 목표 → 전략 → 실행계획 → 성과지표 |
| `case-first` | 도입 → 사례 → 분석 → 시사점 → 결론 |
| `why-what-how` | Why → What → How → 결과 |

### 2.2 Frame Defaults

**Default — flow by frame (may override when the audience calls for another opening)**:

| `frame` | Option 1 | Option 2 |
|---|---|---|
| `problem` | `problem-first` | `background-first` |
| `hypothesis` | `why-what-how` | `case-first` |
| `report` | `goal-first` | `background-first` |
| `intro` | `why-what-how` | `case-first` |
| `teach` | `case-first` | `why-what-how` |
| `ir` | `problem-first` | `why-what-how` |

**Hard rule**: Present exactly two flows with a one-line reason each. A presentation carries one narrative arc; the user selects one.

---

## 3. Slide Count

| Input | Effect |
|---|---|
| Source volume | Sections with fact-required bodies claim at least one slide each |
| `intake.objective` | Approval and IR run longer; lecture runs by module count |
| `canvas` | A4 pages hold more than 16:9 slides — reduce by roughly one third |

**Default — count by frame (may override)**: `problem` 10–14 · `hypothesis` 8–12 · `report` 8–12 · `intro` 8–12 · `teach` by module · `ir` 10–14.

**Hard rule**: Every `plan_spec.md` section with `status: 확정` maps to at least one slide. A section that reaches no slide is an error.

---

## 4. Proposal Slides

| `frame` | Tail structure |
|---|---|
| `problem` | Second-to-last: 1안 권고. Last: 2안 대안 |
| `hypothesis` | Second-to-last: 1안 검증 방법. Last: 2안 검증 방법 |
| `report` | Last: 다음 단계, carrying 1안 and 2안 in one slide |
| `intro` | Last: 다음 행동. No alternative |
| `teach` | Last: 정리. No alternative |
| `ir` | Second-to-last: 재무 three scenarios in one slide. Last: 요청 |

**Hard rule**: Where the frame carries an alternative, the deck contains both `role: proposal_primary` and `role: proposal_alt`. Missing the second raises `E-ALT`.

**Hard rule**: `ir` contains a slide carrying 보수 / 기본 / 공격 scenarios. Missing it raises `E-IR`.

---

## 5. Layout Assignment

Content shape selects the layout. The assignment is written to `shape` and remains user-editable.

| Signal in the slide body | `shape` |
|---|---|
| Three or more figures, mixed units | `kpi_cards` |
| Ordered steps, sequence words, numbering | `numbered_steps` |
| Before/after, A/B, two groups | `comparison_columns` |
| Three to six parallel items with descriptions | `vertical_list` |
| Period-and-value pairs across one series | `grouped_bar_chart` |
| Two states across five to ten items | `dumbbell_chart` |
| Parts of one whole | `pie_chart` |
| Tabular grid, three to eight columns | `basic_table` |
| None of the above | Body layout from the deck template |

**Validation**: Every `shape` value exists in `templates/charts/charts_index.json`. An absent id is an error.

**Hard rule**: One strong graphic per slide on 16:9. A4 permits two. Three kinds — chart, diagram, and table — never share one page.

---

## 6. Screen Text and Script

Each slide row carries two texts with different jobs.

| Field | Job | Length |
|---|---|---|
| `screen` | What the audience reads | 3–5 lines |
| `script` | What the presenter says | 3–5 lines, spoken register |

**Hard rule**: `screen` and `script` never carry the same sentences. The screen carries the structure; the script carries the connective reasoning.

**Screen text shaping** — apply by content type:

| Content | Form |
|---|---|
| Figures | One `[라벨: 값]` block per figure |
| Steps | `①②③` numbering with `[단계명 \| 설명]` |
| Comparison | Two groups separated explicitly |
| Ranked items | `[항목명 — 수치 — 한 줄 설명]` |
| Narrative | Plain sentences |

---

## 7. Output — `outline.md`

```markdown
---
frame: problem
flow: problem-first
slide_count: 11
generated_at: 2026-09-04T10:00:00
---

- n: 1
  layer: why
  role: cover
  title: "{제목}"
  screen: "{부제 · 핵심 수치 세 줄}"
  script: ""
  shape: cover
  source: ""

- n: 2
  layer: why
  role: body
  title: "안팎에서 동시에 밀려온 요구"
  screen: "[규제 강화: OSSA 체계화]\n[내부: 평가의 강사 재량]"
  script: "지금 상황을 두 축으로 보시면..."
  shape: comparison_columns
  source: "plan_spec.md#1-현상"
```

| Field | Notes |
|---|---|
| `n` | Slide number, contiguous from 1 |
| `layer` | `why` \| `how` \| `what` |
| `role` | `cover` \| `body` \| `chapter` \| `proposal_primary` \| `proposal_alt` \| `closing` |
| `source` | The `plan_spec.md` section this slide draws from. Empty only on `cover` |

**Validation**: `outline.md` slide count equals `design_spec.md §IX` slide count, and `n` matches `Slide NN` one to one. A mismatch raises `E-SYNC` and blocks export.

---

## 8. User Edits

| Edit | Effect |
|---|---|
| Reorder | `n` renumbered; `layer` recomputed from position |
| Merge two slides | Bodies concatenated; the earlier `source` retained, the later appended |
| Delete | `n` renumbered; if the deleted slide was the only one for a `확정` section, warn |
| Reselect flow | User-edited rows retained; untouched rows rearranged |

**Hard rule**: A row the user edited is never overwritten by a later regeneration. Track edits per row.

---

## 9. Forbidden

**Forbidden — storyline behavior**:
- Opening on scope, agenda, or product before Why
- Presenting more than two flows
- Writing `proposal_alt` under `teach`, `intro`, or `ir`
- Emitting a `shape` absent from `charts_index.json`
- Copying `screen` text into `script`
- Generating `design_spec.md §IX` from anything other than `outline.md`
- Overwriting a user-edited row
