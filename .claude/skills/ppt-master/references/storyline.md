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

### 2.3 The order is free; the conclusion is not

The deck does not follow the document's order. A room decides how an argument
lands, and that changes with the audience — which is why two flows are offered at
all. What cannot change is where the argument arrives.

**Hard rule**: the deck reaches the frame's action section — `problem` 과제,
`hypothesis` 다음 단계, `report` 다음, `intro` 다음 행동, `teach` 실습·적용,
`ir` 요청. A deck that never gets there ends somewhere the document does not.

**Hard rule**: a concluding slide states no figure the action section does not
state. The `proposal_alt` slide is exempt — a 2안 reaches the same goal by another
method ([`planner.md`](./planner.md) §5.2), so its cost and period differ by design.

Both are `E-END` in `outline.py --check`.

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
| 목차 · 차례 · 오늘 다룰 것 | `agenda_list` |
| 장점과 단점 · 찬성과 반대 | `pros_cons_chart` |
| 계층 · 레이어 · 상위·하위 | `layered_architecture` |
| 핵심 하나를 여럿이 둘러쌈 | `hub_spoke` |
| 겹치는 데가 하고 싶은 말 | `venn_diagram` |
| 표 세 줄 이상 + 수치 셋 이상 | `consulting_table` |
| 표 세 줄 이상, 수치 없음 | `basic_table` |
| 달성률(%)이 셋 이상 | `progress_bar_chart` |
| Three or more figures, mixed units | `kpi_cards` |
| Ordered steps, sequence words, numbering | `numbered_steps` |
| Before/after, A/B, two groups | `comparison_columns` |
| Three to six parallel items with descriptions | `vertical_list` |
| Period-and-value pairs across one series | `grouped_bar_chart` |
| Two states across five to ten items | `dumbbell_chart` |
| Parts of one whole | `pie_chart` |
| None of the above | Body layout from the deck template |

**표는 세어서 안다.** 표 신호와 달성률 신호는 정규식 하나로 못 잡으므로 줄과
수치를 세어 판단하고, 다른 신호보다 **먼저** 본다. 칸 안에 수치가 있으면 표만
그리는 것보다 칸 옆에 작은 막대를 함께 그리는 쪽이 읽힌다.

**닿는 모양이 몇 가지인지가 곧 덱의 다양성이다.** 카탈로그에 76가지가 있는데
오래 일곱만 배정됐고, 그래서 만들어진 덱이 다 비슷해 보였다. 넓히되 **확실한
낱말만** 쓴다 — 애매한 신호로 엉뚱한 모양을 고르는 것은 아무 모양도 안 고른
것보다 나쁘다. `tests/test_gates.py` 가 닿는 가짓수를 세어 열 아래로 떨어지면
실패한다.

**고르는 화면은 무리로 묶는다.** 글·목록 / 나란히 / 사분면 / 수치 / 그래프 /
표 / 흐름 / 구조. 스물아홉 가지를 한 줄로 늘어놓으면 고르는 사람이 못 찾는다.
모든 모양은 `art.tsx` 가 제 도형으로 그린다 — 그리지 않은 모양을 목록에 올리면
무엇을 골라도 같은 그림이 나오고, 그러면 고른 것이 아니다.

**Order**: a specific signal wins over the figure count. A body carrying ordered steps *and* three figures is a sequence that happens to be measured; reading the count first sent five of one report's seven slides to the same KPI grid.

**"Mixed units" is half the rule.** Three counts in one unit — 428건 / 371건 / 57건 — is a list or a table, not a KPI row; `%p` counts as `%`, and 만원 / 억원 / 천원 all count as money.

**Validation**: Every `shape` value exists in `templates/charts/charts_index.json`. An absent id is an error. Three or more consecutive slides sharing one layout raise `W-SAME` — a warning, never a correction: the layout follows the content, and the skeleton screen is one click from changing it.

**Hard rule**: One strong graphic per slide on 16:9. A4 permits two. Three kinds — chart, diagram, and table — never share one page.

---

### 5.1 Image Placement — a second axis, not a layout name

`shape` says how the *data* is drawn. `image` says how a *photo* takes the page.
They are different questions, and mixing them breaks the deck: a shape name is
checked against `charts_index.json` (`E-SHAPE`), so an image word placed there
is rejected. Keep them apart.

| `image` | 무엇 | Layout Pattern (design_spec_reference) |
|---|---|---|
| `none` | 안 씀 — 글과 도형으로만 | — |
| `full` | 전면 — 사진이 지면을 꽉 채우고 글이 그 위에 | Full-bleed + floating text |
| `side` | 옆에 — 사진과 설명을 나란히 | Asymmetric split (3:7 / 2:8) |
| `overlap` | 겹침 — 제목이나 큰 숫자가 사진 가장자리에 걸침 | Figure-text overlap |

**Hard rule**: `full` carries a scrim. A photo filling the canvas leaves text
unreadable without a darkening layer over it — strategist.md §h calls it
`scrim` / `overlay` for legibility. A `full` page whose text sits directly on the
photo is a defect, not a style.

**Hard rule**: `none` is the default. An image is added because the page needs
one, never to fill space. A deck where most pages carry photos reads as a
brochure, and the argument stops being visible.

**Default**: the Storyline phase writes `none` on every row. Photos are chosen at
Step 5, and the person confirms placement on the skeleton screen before that.
`outline.py --check` raises `E-IMAGE` on any value outside the four.

The value reaches the Executor through `design_spec §IX` as
`- **Image use**: full — 전면 …`, and the picture itself is listed in §VIII.

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
  image: full

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
