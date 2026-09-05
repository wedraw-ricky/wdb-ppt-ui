> See [`strategist.md`](./strategist.md) for the downstream design-spec role.

# Planner Reference Manual

Role definition for the **planning path**: read the intake answers plus the source material, select one planning frame, fill its sections as a domain expert, and output `plan_spec.md`. The user answers a short intake and then chooses among drafted options; the role never walks the user through the frame section by section.

**Trigger**: SKILL.md Step 3.6, after `intake.json` exists and before `outline.md` is written.

## Pipeline Context

| Previous Step | Current | Next Step |
|---|---|---|
| Intake (Step 3.5) → `intake.json` | **Planner**: frame selection + `plan_spec.md` | Storyline (Step 3.7) → `outline.md` |

---

## 0. Planning · Making · Presentation

The lecture this stage implements runs in three bands (교안 26·42·54). They are
distinct stages with distinct outputs, and this file owns the first two.

| Band | What happens | Output |
|---|---|---|
| **Planning** | 기획 and 계획 — the frame chain is filled | `plan_spec.md` |
| **Making** | that content is laid out as the document a person receives | `exports/…기획서.md` · `.docx` |
| **Presentation** | the deck is argued from the same content | `outline.md` → deck |

**Hard rule**: the deck's order is free — a room decides how an argument is best
made, and the flow candidates of [`storyline.md`](./storyline.md) exist for that.
The **conclusion** is not free. The deck and the document reach the same one, and
`outline.py --check` raises `E-END` when the deck misses the frame's action
section or concludes with a figure the document does not state.

### 0.1 Two Routes

Not every deck is a planning job. A 교안 or a 소개서 is finished content being
presented; forcing it through 실행 계획 and 리스크 대책 asks for work nobody
needs. The route follows from the frame — the user is never asked a second time.

| Route | Frames | Carries 실행 계획 | Document grouped (§6.2) |
|---|---|---|---|
| `full` — 기획부터 한다 | `problem` · `hypothesis` · `report` | Yes | Yes |
| `short` — 내용이 이미 정해져 있다 | `intro` · `teach` · `ir` | No | No |

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

## 2.6 카피라이팅 — 골자는 두고 말을 바꾼다

§2.5 의 골자는 맞다. `출장 동선 여섯 자리를 위한 PLATINUM ELITE` 가 이상했던
것은 골자 때문이 아니라 **그 자리에 들어간 말** 때문이다. 아무도 "동선 여섯
자리" 라고 말하지 않는다.

**적용 범위**: 문서 제목, **모든 장 제목**, 화면 문구. 발표자 노트는 말하는
글이라 여기서 제외한다.

PPT 는 읽는 문서가 아니라 **보는 자료**다. 독자는 광고를 보듯 훑는다. 그래서
같은 사실도 문서의 말이 아니라 독자의 말로 써야 한다.

**Hard rule — 라벨을 제목으로 쓰지 않는다.** `개요` · `배경` · `결론` · `요약` ·
`숫자로 보면` · `주요 내용`. 이건 목차 항목이지 제목이 아니다. 목차는 목차
자리에 있으면 되고, 제목 자리에는 **그 장에서 독자가 알게 되는 것**이 온다.

**Hard rule — 설명문으로 끝내지 않는다.** `~에 대해 알아봅니다` · `~로
이뤄집니다` · `~를 소개합니다`. 제목은 내용을 요약하는 자리가 아니라 독자를
붙드는 자리다.

**Hard rule — 업계 말을 독자 말로.** 동선 · 제고 · 고도화 · 방안 · 확보 ·
활성화 · 실행안. 기준은 하나다 — **그 독자가 친구에게 이걸 설명한다면 어떻게
말할까**.

**Hard rule — 제목만 이어 읽어도 이야기가 된다.** 장 제목을 표지부터 끝까지
차례로 읽었을 때 한 편의 말이 되어야 한다. 각 장이 저 혼자 맞는 말을 하면
그건 이야기가 아니라 목록이다. 사실을 앞세우라는 규칙(§2.6 구체적인 것을 앞에)을
장마다 따로 적용하면 통계 나열이 나온다 — 앞 장이 만든 긴장을 다음 장이 받는지
보고 쓴다.

**Hard rule — 수고가 아니라 얻는 것을 쓴다.** `출장 1번에 6번 꺼내는 카드` 는
독자가 카드를 여섯 번 꺼내야 한다고 말한다. 같은 사실이라도
`출장이 가벼워지는 6번의 순간` 은 독자가 무엇을 얻는지를 말한다. 동사를
고를 때 그 동작을 하는 사람이 누구인지 본다 — 독자가 힘쓰는 동사는 카피가 아니다.

| 나열식 — 제목마다 사실 하나 | 이어지는 이야기 |
|---|---|
| 출장 1번에 6번 꺼내는 카드 | 출장이 가벼워지는 6번의 순간 |
| 집을 나서서 호텔에 눕기까지 6번 | 공항 주차장부터 호텔 로비까지, 6번 멈춥니다 |
| 아멕스가 주고, 삼성카드가 더합니다 | 아멕스가 깔고, 삼성카드가 더합니다 |
| 공항에서만 5번 꺼냅니다 | 공항을 나서기 전에 5가지가 끝납니다 |
| 호텔 23곳, 주차장 17곳 | 전월 실적을 따지는 건 1가지뿐입니다 |
| 가족카드를 더하면 횟수가 2배 | 가족카드 1장이면 모든 횟수가 2배 |

왼쪽은 여섯 개의 맞는 말이고, 오른쪽은 한 편의 말이다 — 약속 → 아는 상황 →
무엇으로 이뤄졌나 → 얼마나 일찍 끝나나 → 걸림돌이 없다 → 덤. 숫자는 오른쪽에도
그대로 있다. 앞세우되 그것만 앞세우지 않는다.

**이야기 흐름은 검사가 막지 않는다.** 판단이 섞이는 것을 기계가 재려 들면 맞는
제목까지 막힌다. 쓰는 사람이 지킨다 — 다 쓰고 제목만 세로로 읽어본다.

**Hard rule — 장 제목은 한 줄, 25자 안.** 화면에서 두 줄로 넘어가면 제목이
아니라 문단이다. 문서 제목에는 이 제한이 없다 — 표지와 파일 목록에서 읽히는
것이라 한 줄에 갇히지 않는다.

**Hard rule — 구체적인 것을 앞에.** 숫자, 고유명사, 장면 중 하나는 앞쪽에 온다.
없는 것을 지어내라는 뜻이 아니라, 있는데 뒤로 미루지 말라는 뜻이다. 이 항목은
판단이 섞이므로 검사가 막지 않는다 — 쓰는 사람이 지킨다.

| 골자는 같고, 말만 바뀐다 | |
|---|---|
| 출장 동선 여섯 자리를 위한 PLATINUM ELITE | 출장 1번을 가볍게 만들기 위한 PLATINUM ELITE |
| 고객 만족도 제고를 위한 서비스 개선안 | 대기 12분을 3분으로 줄이기 위한 접수 방식 |
| 신규 회원 확보 방안 | 첫 달 3만 명을 데려오기 위한 초대 구조 |

| 장 제목 — 골자 규칙은 없고 카피만 있다 | |
|---|---|
| 숫자로 보면 | 호텔 23곳, 주차장 17곳 |
| 두 묶음으로 이뤄집니다 | 아멕스가 주고, 삼성카드가 더합니다 |
| 한 여정 안에서 연달아 쓰입니다 | 공항에서만 5번 꺼냅니다 |
| 다음 행동 | 가족카드를 더하면 횟수가 2배 |

**화면 문구도 같다.** 항목을 나열하되, 각 줄이 읽히는 말이어야 한다. `제공
횟수: 월 5회` 보다 `한 달에 5번` 이 눈에 붙는다 — 단, 원문의 표기를 바꾸면 안
되는 수치·조건은 원문 그대로 둔다 (§4.5 사실 규칙이 이긴다).

## 2.8 여는 장과 닫는 장 — 이야기는 닫혀야 끝난다

**Hard rule**: 모든 덱의 마지막 장은 **닫는 장**(`role: closing`)이다. 내용 절로
끝내면 이야기가 끝나지 않고 그냥 멈춘다 — 마지막 장을 본 사람이 무엇을 하면
되는지 모른 채 나간다. `outline.py` 의 `E-CLOSE` 가 막는다.

**닫는 장이 하는 일 — 셋뿐이다.**

| | |
|---|---|
| ① 처음의 약속을 다시 세운다 | 여는 장이 건 약속을 그대로 되받는다. 새 사실을 꺼내는 자리가 아니다 |
| ② 무엇이 달라지는지 한 번 더 | 본문에서 이미 증명한 것 중 가장 센 것 하나 |
| ③ 무엇을 하면 되는지 | 결재면 승인, 소개면 다음 행동. 독자가 여기서 정한다 |

**Forbidden — 덤으로 끝내기.** `가족카드 1장이면 모든 횟수가 2배` 는 좋은
사실이지만 닫는 장이 아니다. 부가 혜택으로 끝나면 독자는 "그래서 어쩌라고" 를
안고 나간다. 그건 본문 마지막 장의 몫이고, 닫는 장은 처음으로 돌아가야 한다.

**Forbidden — 라벨로 끝내기.** `감사합니다` · `Q&A` · `끝`. 화면을 한 장 쓰면서
아무 말도 하지 않는 자리다.

여는 장과 닫는 장은 한 쌍이다. 둘을 나란히 놓고 읽었을 때 같은 약속이 처음과
끝에서 두 번 들려야 한다.

| 여는 장 | 닫는 장 |
|---|---|
| 출장이 가벼워지는 6번의 순간 | 다음 출장부터, 그 6번이 가벼워집니다 |
| 신입사원 1년 이내 퇴사율 40% | 40%를 15%로 — 3개월 뒤 다시 뵙겠습니다 |

## 2.7 숫자는 숫자로 — 화면에 나가는 글

**Hard rule**: 화면에 나가는 글에서 셀 수 있는 값은 아라비아 숫자로 쓴다.
제목과 `screen` 이 그렇다. 발표자 노트(`script`)는 **말하는 글**이므로 한글
수사를 그대로 둔다.

말할 때는 "여섯 곳" 이라고 말한다. 그러나 자료는 보는 것이다. 눈은 `6곳` 을
한 번에 잡고, `여섯 곳` 은 읽어야 안다. 발표자는 화면의 `6곳` 을 보고 입으로
"여섯 곳" 이라고 말하면 된다 — 두 글자가 다른 것이 정상이다.

| | 화면 (제목 · screen) | 노트 (script) |
|---|---|---|
| 개수 · 횟수 · 금액 · 비율 | `6곳` · `월 5회` · `2만원` · `40%` | 여섯 곳 · 한 달에 다섯 번 |
| 관용구 · 어림수 | `한 번쯤` · `두어 곳` — 그대로 | 그대로 |

**경계**: 수를 세고 있으면 숫자, 말버릇이면 한글. `두 배` 는 세고 있으므로
`2배`. `한 번쯤 들러보세요` 는 세고 있지 않으므로 그대로.

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
| 9 | 컨셉 | The solution said in one line (교안 63) |
| 10 | 해결책 | Concrete activities — attacking the 원인, the 장애요인, the 기회요인 |
| 11 | 실행 계획 | Schedule, owner, budget (교안 65 액션플랜) |
| 12 | 리스크 대책 | What is expected to go wrong, with prevention and response |

Sections 1–8 are the 클라이언트 블록 the lecture teaches as a thinking tool.
9–10 are the 컨셉 블록 and 11–12 the 플래너 블록. Stopping at 8 yields what to
do and never when, by whom, at what cost, or what breaks.

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
| 8 | 실행 계획 | Schedule, owner, budget for running the test |

No 리스크 대책 here — `리스크` already holds that seat.

### 3.3 `report` — Results Report

| # | Section | Content |
|---|---|---|
| 1 | 하기로 한 것 | The commitment made |
| 2 | 한 것 | What was executed |
| 3 | 결과 | Measured outcome |
| 4 | 결과 해석 | Why the outcome came out that way |
| 5 | 한계 | What did not work or remains unresolved |
| 6 | 다음 | The next period's commitment |
| 7 | 실행 계획 | Schedule, owner, budget for that commitment |
| 8 | 리스크 대책 | What is expected to go wrong, with prevention and response |

A report that ends on what was done leaves the reader asking what comes next.

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

## 4.5 What the Lecture Corrects

Rules taken from the 2강 첨삭 and 교안 28·48·73·122. They apply to `problem` only.
The split matters: an error stops the run, an advisory is said and let go. A check
that blocks a correct plan teaches people to ignore checks.

| Code | Stops? | Rule |
|---|---|---|
| `E-BROAD` | Yes | 목적 rests on a 대목적 — 매출 증대 · 이익 증대 · 역량 강화 · 이윤 창출. Those name no place to act on (교안 48) |
| `E-DUP` | Yes | 현상 · 영향 · 원인 carry the same line. Two of the three are then empty |
| `E-ACT` | Yes | 과제 states no period. Every 기획과제 in the lecture says by when (교안 74·79·80) |
| `W-GAIN` | No | 기대효과 lists more items than 영향. The gain comes out of the impact, so it cannot be the longer list (교안 73) |
| `W-AIM` | No | 목적 검증 lists several ends. 바람직한 상태 is *one* impact chosen by priority (교안 73) |
| `W-BASE` | No | 현상 states a figure with no ground to read it against. 50% is neither good nor bad on its own |
| `W-SPEC` | No | 과제 reads as a build requirement — 기능 추가 is a spec, not a plan (교안 122) |

**Hard rule**: correspondence between sections is judged **by count, never by
wording.** 정산 지연 최소화 and 회계 일정 딜레이 are the same thing said twice;
a checker that compares words flags a correct document and gets switched off.

**Not built** — two rules in the lecture have no machine form yet:

| Rule | Why not |
|---|---|
| 지시사항을 그대로 목적으로 쓰지 않는다 (교안 48) | The instruction's own wording is never collected. It needs one more intake line |
| 문제점은 원인 중 대책을 세울 수 있는 것 (교안 28) | Whether 폭설 can be acted on is a judgement no rule reaches |

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

### 6.2 Making — the document a person receives

The chain is the thinking; the document is what a reader is handed. 교안 121 gives
the 기획서 six items, and its four worked examples (125 · 127 · 129 · 131) all keep
them. A `full`-route frame is grouped into those items; a `short`-route frame keeps
one item per section.

| Item | `problem` | `hypothesis` | `report` |
|---|---|---|---|
| 제목 | the document title (§2.5) | — | — |
| 목적 | 배경 · 현상 · 영향 · 원인 · 목적 검증 | 가설 · 착안 근거 | 개요 ← 하기로 한 것 |
| 개요 | 목표 · 과제 | 검증 방법 · 다음 단계 | 추진 내용 ← 한 것 |
| 내용 및 계획 | 컨셉 · 해결책 · 실행 계획 | 실행 계획 | 결과 ← 결과 · 결과 해석 |
| 리스크 대책 | 리스크 대책 | 리스크 | 한계 ← 한계 |
| 기대효과 | 기대효과 | 기회 크기 · 예상 결과 | 향후 계획 ← 다음 · 실행 계획 · 리스크 대책 |

**Hard rule**: the renderer **groups, never condenses.** Shortening five sections
into one paragraph is writing, and writing belongs to the planner
([`report-format.md`](./report-format.md) §1). Where the document should read
shorter than the chain, the planner writes it shorter.

**Hard rule**: an item is only as settled as its least settled section. One
`확인 필요` inside it makes the whole item `확인 필요`, or the badge tells a reader
the document is closed while a piece of it is open.

**Hard rule**: no section is dropped on the way to the document. A section this
table forgets is appended as its own item rather than disappearing.

> `report` and `hypothesis` shapes are ours, not the lecture's — it specifies the
> 기획서 only. Item names there are **확인 필요** pending the 대표's word.

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
