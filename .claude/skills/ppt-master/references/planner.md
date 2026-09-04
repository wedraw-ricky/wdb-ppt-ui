> See [`strategist.md`](./strategist.md) for the downstream design-spec role.

# Planner Reference Manual

Role definition for the **planning path**: read the intake answers plus the source material, select one planning frame, fill its sections as a domain expert, and output `plan_spec.md`. The user answers a short intake and then chooses among drafted options; the role never walks the user through the frame section by section.

**Trigger**: SKILL.md Step 3.6, after `intake.json` exists and before `outline.md` is written.

## Pipeline Context

| Previous Step | Current | Next Step |
|---|---|---|
| Intake (Step 3.5) → `intake.json` | **Planner**: frame selection + `plan_spec.md` | Storyline (Step 3.7) → `outline.md` |

---

## 1. Division of Labor

| Actor | Owns |
|---|---|
| User | `emphasis`, `conclusion`, `audience`, `objective`, `interests`, `purpose`, `assignment` — collected once at intake |
| Planner | Every section of `plan_spec.md`, drafted from the source |
| User | Choosing between drafted Option 1 / Option 2 where a section is thin |

**Hard rule**: Never ask the user to author a frame section from a blank prompt. Draft it, then offer a choice.

**Hard rule**: Numeric values from the source or from research are transcribed, never generated. A figure absent from the source is absent from `plan_spec.md`.

**Hard rule**: The document opens with two things the frame does not supply — a `# 제목` and a `## 거버닝 메시지` block. The 제목 is `[핵심 수단] + [결과 수치]` in 12–18자 ([`report-format.md`](./report-format.md) §2.2), never the writer's conclusion sentence lifted whole. The 거버닝 메시지 is `[현황/문제] + [해결] + [정량 결과]` in 2–3문장, opening on the situation rather than on a declaration. `plan_spec.py --check` enforces both (`E-TITLE`, `E-GOV`): a reader who reads nothing else reads these.

**Hard rule**: Every section carries a `heading:` line — the 소제목 the document shows, written per [`report-format.md`](./report-format.md) §2.2: 명사형, 20자 내외, 형용사 금지. The `## N. {절 이름}` heading is the frame's own vocabulary and is never what a reader sees.

**Hard rule**: The body carries the argument. Supporting tables, 원자료 and research go to `## 별첨 N. …` blocks at the end of `plan_spec.md`; they sit outside the frame chain and are rendered after the argument at 별첨 size.

**Hard rule**: Section bodies are written with the markers [`report-format.md`](./report-format.md) §4 defines — `▢` for the 두괄식 핵심, `◦` for 세부, `*` for 각주, Markdown table rows for 통계표, `{+…}` / `{-…}` where a figure is 개선 or 악화, `[확인 필요: …]` where a value is missing. These are typesetting instructions the Word renderer reads; the Markdown draft strips them.

**Hard rule**: Section bodies are written in the 보고형 register defined by [`report-format.md`](./report-format.md) §2 — 최상위 수식어 removed, the 수치 or 결론 in the first third of the sentence, 개조식 lines carrying no full stop. The Word renderer typesets that register; it cannot produce it, so a body written outside it reaches the reader outside it.

---

## 2. Frame Selection

`frame` is derived, never asked directly.

| `intake.purpose` | `intake.assignment` | `frame` |
|---|---|---|
| Internal budget / decision approval | `지시수명` | `problem` |
| Internal budget / decision approval | `신규제안` | `hypothesis` |
| Strategy proposal | `지시수명` | `problem` |
| Strategy proposal | `신규제안` | `hypothesis` |
| Results report | — | `report` |
| Company / service / program intro, proposal document | — | `intro` |
| Education / lecture | — | `teach` |
| IR fundraising | — | `ir` |

**Validation**: `assignment` is collected only when `purpose` resolves to `problem` or `hypothesis`. Writing it for any other purpose is an error.

---

## 2.5 제목 — the one line that decides

**Hard rule**: a 기획서 제목 is `[목적] 을 위한 [실행안]`. The purpose goes in front,
the thing you will actually do goes behind. This shape is the default whenever
nothing better presents itself; it is not a fallback, it is the rule.

| Half | Carries | Test |
|---|---|---|
| before 위한 | the end being pursued — what gets better | Name what is not working now. Not a category |
| after 위한 | the action being proposed | A reader can tell what will be done |

**Forbidden — a 제목 with no purpose.** `생산성 툴 노션 도입안` states an action and
nothing else: a decision-maker reads it and cannot tell what improves, so the
answer is a question rather than an approval.

**Forbidden — a purpose too broad to locate.** `업무 효율을 위한 노션 도입안` is
still failing: 업무 효율 does not say *what* is not working. `실시간 업무 소통의
극대화를 위한 생산성 툴 노션 도입안` does.

**Hard rule**: a recurring proposal states what changed since last time. "Same as
last year" is the fastest way to a rejected approval.

The 제목 is written for a reader who may read nothing else, so it does two things
at once: it names what that reader wants, and it says what this achieves. A 제목
that leaves the reader incurious has already failed twice — they do not open it,
and if they do they keep asking what it means.

> Note: this is the 기획서 제목. A 보고서 reports a result that already exists, so
> its 제목 leads with the figure instead — [`report-format.md`](./report-format.md)
> §2.2. Applying the 보고서 rule to a 기획서 demands a result the proposal has not
> produced yet.

## 3. Frames

Each frame is an ordered chain of sections. `plan_spec.md` carries exactly the chain for the selected `frame`.

### 3.1 `problem` — Problem Solving

| # | Section | Content |
|---|---|---|
| 1 | 현상 | The undesirable present condition |
| 2 | 영향 | What continuing costs the person or the organization |
| 3 | 원인 | The problems that produced the condition |
| 4 | 배경 | Objective external grounds — trends, statistics, regulation |
| 5 | 목표 | Target state, carrying both a period and a level |
| 6 | 목적 검증 | Whether the target serves the desired end state; priority among targets |
| 7 | 기대효과 | What target attainment yields |
| 8 | 과제 | Action items that reach the selected target |

### 3.2 `hypothesis` — Hypothesis Validation

| # | Section | Content |
|---|---|---|
| 1 | 가설 | The proposition being advanced |
| 2 | 착안 근거 | What prompted it — observation, data, field signal |
| 3 | 기회 크기 | Size of the opportunity if the hypothesis holds |
| 4 | 검증 방법 | How it will be tested |
| 5 | 예상 결과 | Expected outcome of the test |
| 6 | 리스크 | What breaks it |
| 7 | 다음 단계 | The next commitment being requested |

### 3.3 `report` — Results Report

| # | Section | Content |
|---|---|---|
| 1 | 하기로 한 것 | The commitment made |
| 2 | 한 것 | What was executed |
| 3 | 결과 | Measured outcome |
| 4 | 결과 해석 | Why the outcome came out that way |
| 5 | 한계 | What did not work or remains unresolved |
| 6 | 다음 | The next period's commitment |

### 3.4 `intro` — Introduction and Proposal

| # | Section | Content |
|---|---|---|
| 1 | 왜 존재하나 | The belief or need the subject answers |
| 2 | 무엇인가 | The company, service, or program itself |
| 3 | 무엇이 다른가 | Differentiation against the alternatives |
| 4 | 근거·사례 | Evidence — cases, figures, references |
| 5 | 다음 행동 | The action requested of the reader |

> Note: A proposal document (`제안서`) uses this frame; section 5 carries the proposal itself.

### 3.5 `teach` — Education and Lecture

| # | Section | Content |
|---|---|---|
| 1 | 학습 목표 | What the learner can do afterward |
| 2 | 왜 필요한가 | Why the learner needs it |
| 3 | 개념 | The concept being taught |
| 4 | 예시 | Concrete instances of the concept |
| 5 | 실습·적용 | What the learner does with it |
| 6 | 정리 | Recap, paired to section 1 |

### 3.6 `ir` — IR Pitch

| # | Section | Content |
|---|---|---|
| 1 | 문제 | The market problem |
| 2 | 해결책 | How the product answers it |
| 3 | 시장 크기 | Addressable market with its basis |
| 4 | 제품 | What exists today |
| 5 | 수익 모델 | How money is made |
| 6 | 트랙션 | Measured traction to date |
| 7 | 경쟁 | Competitive position |
| 8 | 팀 | Who is executing |
| 9 | 재무 | Projections under three scenarios (§5.3) |
| 10 | 요청 | Amount requested and its use of funds |

---

## 4. Validation Rules

Rules activate per frame. A rule that is not listed for a frame does not apply to it.

### 4.1 Fact-Required Sections

**Hard rule**: A fact-required section is filled only from material present in `sources/` or in recorded research. Absent grounds, the section carries `status: 확인 필요` and an empty body, and the run raises `E-FACT`.

| `frame` | Fact-required sections |
|---|---|
| `problem` | 현상, 원인, 배경 |
| `hypothesis` | 착안 근거, 기회 크기 |
| `report` | 한 것, 결과 |
| `intro` | 근거·사례 |
| `teach` | — |
| `ir` | 트랙션, 시장 크기, 재무 |

**Definition — fact**: a statement that can be proved or disproved. A statement that can be neither is an opinion and belongs to a non-fact-required section.

### 4.2 Paired Sections

**Hard rule**: The second member of a pair must correspond to the first. A claim appearing in the second with no counterpart in the first is an `E-PAIR` error.

| `frame` | Pair |
|---|---|
| `problem` | 영향 → 기대효과 |
| `hypothesis` | 가설 → 예상 결과 |
| `report` | 하기로 한 것 → 결과 |
| `teach` | 학습 목표 → 정리 |
| `ir` | 문제 → 해결책; 요청 → 재무의 use of funds |
| `intro` | — |

### 4.3 Target Shape

**Hard rule**: Where a frame carries a target section (`problem` 목표, `hypothesis` 예상 결과, `report` 하기로 한 것, `ir` 재무), the target states both a period and a level. Missing either raises `E-GOAL` and produces two drafted options (§5).

### 4.4 Objective and Subjective Placement

**Hard rule**: Sections 1 through the last fact-required section carry analysis only. Proposals, concepts, and preferences enter at the frame's action section — `problem` 과제, `hypothesis` 다음 단계, `report` 다음, `intro` 다음 행동, `teach` 실습·적용, `ir` 요청.

---

## 5. Option Drafting

### 5.1 When to Draft Options

| Condition | Action |
|---|---|
| A section is empty after extraction | Draft Option 1 and Option 2 |
| `E-GOAL` raised | Draft two targets differing in level or period |
| Source supports two readings | Draft both, mark the stronger as Option 1 |
| Section is well-supported by the source | Fill it; draft no options |

**Hard rule**: Two options, never three or more. Option 1 is the recommendation.

### 5.2 Option 2 Character

**Hard rule**: Option 2 reaches the same goal by a different method. It is not a reduced-scope version of Option 1, and it is not the do-nothing case.

### 5.3 Frames That Suppress Options

| `frame` | Behavior |
|---|---|
| `teach` | Options off |
| `intro` | Options off |
| `ir` | Options off. 재무 instead carries three scenarios — 보수 / 기본 / 공격 |
| `report` | Options only in 다음 |

---

## 6. Output — `plan_spec.md`

```markdown
---
frame: problem
purpose: 사내 예산 · 의사결정 승인
assignment: 지시수명
generated_at: 2026-09-04T10:00:00
---

# {제목}

## 1. 현상
status: 확정
{body}

source: sources/x.md:L120-L134

## 2. 영향
status: 초안
{body}

## 5. 목표
status: 확인 필요

**1안** {period} 안에 {level}
**2안** {period} 안에 {level}
```

| Field | Notes |
|---|---|
| `status` | `확정` \| `초안` \| `확인 필요` — one per section |
| `source` | Path and line range in `sources/`. Mandatory on fact-required sections |
| `1안` / `2안` | Present only where §5 applies |

`plan_spec.md` is rendered into the 기획서 a person reads by
[`render_plan_doc.py`](../scripts/render_plan_doc.py) — Markdown always, Word on request.
The renderer formats this contract and never authors it; a section still at `초안` or
`확인 필요` is rendered carrying that state.

**Validation**: Section count and order match the selected frame's chain exactly. A missing or reordered section is an error.

---

## 7. Forbidden

**Forbidden — planner behavior**:
- Asking the user to fill a section from a blank prompt
- Walking the user through the chain one section at a time
- Producing a figure that is not in `sources/` or recorded research
- Filling a fact-required section from inference
- Applying a rule from a frame other than the selected one
- Writing `1안` / `2안` under `teach`, `intro`, or `ir`
- Placing a proposal in a section before the frame's action section
