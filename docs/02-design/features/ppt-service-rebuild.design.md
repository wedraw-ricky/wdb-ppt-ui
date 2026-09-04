# ppt-service-rebuild Design Document

| | |
|---|---|
| Feature | `ppt-service-rebuild` — 기획·스토리라인 단계 신설 |
| Phase | Design |
| 선택된 설계안 | **B · 깔끔한 분리** (대표 결정 2026-09-04) |
| Plan | [`docs/01-plan/features/ppt-service-rebuild.plan.md`](../../01-plan/features/ppt-service-rebuild.plan.md) |
| PRD | [`docs/00-pm/ppt-service-rebuild.prd.md`](../../00-pm/ppt-service-rebuild.prd.md) |

## Context Anchor

| | |
|---|---|
| **WHY** | 대표의 제작 과정은 자료 → **기획** → 슬라이드이고 가운데가 가장 중요한데, 파이프라인에는 그 자리가 비어 있다. 확정 항목 19개 중 내용에 닿는 것은 4개뿐이고, 장별 뼈대는 한 번도 묻지 않은 채 AI가 혼자 쓴다. |
| **WHO** | ① 대표 — 제작 전문가, 표현을 대신 시키러 옴 ② 실습생 — 기획 훈련이 안 된 상태 ③ AI — 전문가 입장에서 채우는 쪽 |
| **RISK** | 단계를 늘리면 흐름이 길어진다. 8단계를 하나씩 심문하면 아무도 안 쓴다. 반대로 다 자동화하면 "AI가 다 만든 남의 PPT"가 된다. |
| **SUCCESS** | 사람이 멈추는 지점 4곳 이내 · 장별 뼈대를 완성 전에 보고 고칠 수 있음 · 같은 재료에서 기획서와 발표자료가 함께 나옴 |
| **SCOPE** | 포크(`wedraw-ricky/slide-master`) + 오버레이(`wedraw-ricky/wdb-ppt-ui`). SVG 저작·내보내기는 불변. |

## 1. Overview

### 1.1 Design Goals

1. **묻고 → 채우고 → 고른다.** 처음 인터뷰로 방향을 받고, AI가 전문가로서 세부를 채우고, 사용자는 1안·2안 중 골라 방향을 잡는다.
2. **장별 뼈대를 완성 전에 보이게 한다.** 지금 `design_spec.md §IX`에 묻혀 있는 것을 편집 가능한 산출물로 끌어낸다.
3. **같은 재료에서 두 산출물**: 기획서(8단계 그대로)와 발표자료(골든 서클).
4. **템플릿은 겉옷과 뼈대로 분리한다.** 색·글꼴은 먼저 골라 통일감을, 레이아웃은 내용이 정하게.

### 1.2 Design Principles

| # | 원칙 | 출처 |
|---|---|---|
| P-1 | **빈칸을 주지 말고 두 개를 만들어 고르게 한다** | 대표 지시 전반 · `ai-planning` 프롬프트 · BATNA |
| P-2 | 팩트여야 하는 칸(현상·원인·배경)은 근거가 없으면 채우지 않고 `확인 필요`로 둔다 | 기획강의 1차시 — "입증 또는 반증이 가능한" |
| P-3 | 기대효과는 앞서 적은 영향의 뒤집힌 짝이어야 한다 | 기획강의 2차시 — "없던 게 갑자기 튀어나온다는 얘기가 아닙니다" |
| P-4 | 목표는 **기간과 수준**을 모두 갖는다 | 기획강의 2차시 |
| P-5 | 앞 네 칸은 객관, 과제 단계에서만 주관을 넣는다 | 기획강의 2차시 |
| P-6 | 데이터·수치는 정확히 옮기기만 한다. 만들어내지 않는다 | 대표 지시 |
| P-7 | 발표는 **Why**로 연다 | 사이먼 시넥 골든 서클 (대표 지시) |
| P-8 | 결론은 **1안(권고) + 2안(대안)** — 단 `teach`·`ir`·`intro`에서는 끈다 | BATNA (대표 지시) |
| P-9 | **골격은 `frame`에 따라 갈아 끼운다.** 검증 규칙도 함께 켜지고 꺼진다 | 대표 지시 2026-09-04 |

## 2. Architecture Options

### 2.0 Architecture Comparison

| | A · 최소 변경 | B · 깔끔한 분리 ★선택 | C · 실용적 균형 |
|---|---|---|---|
| 새 화면 | 0 | 2 | 1 |
| 뼈대 편집 사용성 | 나쁨 (폼 입력칸) | **좋음** | 좋음 |
| 기획서 산출 | 억지 | **자연스러움** | 자연스러움 |
| 규모 | S–M | **L** | M |
| 주요 위험 | 20장 넘으면 못 씀 | 계약 확장에 따른 회귀 | 두 방식 혼재 |

**선택 근거 (대표)**: 기획서와 발표자료를 둘 다 내기로 했으므로, 두 산출물이 각자 자리를 갖는 B가 구조상 맞다. 규모를 감수하고 장기 구조를 택한다.

### 2.1 Component Diagram

```
sources/                     자료 (지금 그대로)
   │
   ├─▶ intake.json           ① 인터뷰 결과            [신규 · 계약]
   │
   ├─▶ plan_spec.md          ② 기획서 8단계          [신규 · 산출물]
   │      │                     AI가 채우고 사람이 고침
   │      │
   │      └─▶ outline.md     ③ 장별 뼈대             [신규 · 산출물]
   │             │              골든 서클 + 1안/2안
   │             │
   │             ▼
   │        design_spec.md   ④ 지금 것 — §IX 를 outline 에서 생성
   │             │
   │             ▼
   │        spec_lock.md ─▶ svg_output/ ─▶ exports/*.pptx
   │
   └─▶ exports/*_기획서.docx  ② 에서 별도 렌더        [신규 · 산출물]
```

**핵심 반전**: 지금은 `design_spec.md §IX`를 AI가 직접 쓴다. 앞으로는 `outline.md`가 정본이고 `§IX`는 거기서 **생성**된다. 사람이 고친 뼈대가 그대로 슬라이드가 된다.

### 2.2 Data Flow

```
1. 인터뷰      사용자 입력·선택 ──▶ intake.json
2. 기획        자료 + intake ──AI──▶ plan_spec.md (초안)
                                  └─ 빈 칸·부실 칸은 1안/2안으로 표시
               사람이 확인·수정 ──▶ plan_spec.md (확정)
3. 스토리라인   plan_spec ──AI──▶ 흐름 1안/2안 제시
               사람이 택1     ──▶ outline.md (초안)
               사람이 편집    ──▶ outline.md (확정)   ← 순서·병합·삭제·수정
4. 디자인      기존 확인 화면 (색·글꼴·이미지)          ← 변경 없음
5. 구성        outline 각 장의 성격 ──▶ 레이아웃 배정
6. 작성·내보내기                                      ← 변경 없음
```

### 2.3 Dependencies

새 외부 의존성 없음. `python-docx`는 기획서 `.docx` 렌더에 필요하나, 이미 설치된 `python-pptx`와 별개다 — **`확인 필요:` docx 산출을 v1에 넣을지, Markdown만 낼지 §11.3에서 분리**.

## 3. Data Model

### 3.1 Entity Definition

**`intake.json`** — 인터뷰 결과. 사람이 정하는 것만 담는다.

| 필드 | 타입 | 설명 |
|---|---|---|
| `emphasis` | string | 이 자료에서 무엇을 중요하게 볼지 (자유 입력 + AI 후보) |
| `conclusion` | string | 결론적으로 무엇을 말하고 싶은지 |
| `audience` | string | 누구에게 (기존 `audience` 승계) |
| `objective` | string | 무엇을 위해 — 예산 승인 / 성과 보고 / 전략 제안 … |
| `interests[]` | string[] | 청중 관심사 — ROI · 리스크 · 실행 가능성 … (복수) |
| `doc_kind` | enum | `발표자료` \| `보고서` \| `둘 다` — 캔버스가 여기서 파생 |
| `purpose` | enum | 사내 승인 · 전략 제안 · 성과 보고 · 소개/제안서 · 교육 · **IR 투자유치** |
| `assignment` | enum | `지시수명` \| `신규제안` — `purpose`가 설득형일 때만 |
| `frame` | enum | 위 둘에서 **파생**. `problem` \| `hypothesis` \| `report` \| `intro` \| `teach` \| `ir` |

**`plan_spec.md`** — 기획서. **절 구성이 `frame`에 따라 달라진다.** 파일 이름과 위치는 같다.

| frame | 절 사슬 | 팩트 필수 | 짝 규칙 | 1안·2안 |
|---|---|---|---|---|
| `problem` ① 문제 해결 | 현상 → 영향 → 원인 → 배경 → 목표 → 목적 검증 → 기대효과 → 과제 | 현상·원인·배경 | 영향 ↔ 기대효과 | ✅ |
| `hypothesis` ② 가설 검증 | 가설 → 착안 근거 → 기회 크기 → 검증 방법 → 예상 결과 → 리스크 → 다음 단계 | 착안 근거·기회 크기 | 가설 ↔ 예상 결과 | ✅ (검증 방법에서) |
| `report` ③ 성과 보고 | 하기로 한 것 → 한 것 → 결과 → 결과 해석 → 한계 → 다음 | 실행·결과 | 목표 ↔ 결과 | 다음 단계에만 |
| `intro` ④ 소개 | 왜 존재하나 → 무엇인가 → 무엇이 다른가 → 근거·사례 → 다음 행동 | 근거·사례 | — | — |
| `teach` ⑤ 교육·강의 | 학습 목표 → 왜 필요한가 → 개념 → 예시 → 실습·적용 → 정리 | — | 학습 목표 ↔ 정리 | **끔** |
| `ir` ⑥ IR 피칭 | 문제 → 해결책 → 시장 크기 → 제품 → 수익 모델 → 트랙션 → 경쟁 → 팀 → 재무 → 요청(Ask) | **트랙션·시장·재무** | 문제 ↔ 해결책 / Ask ↔ 자금 사용처 | **끔** → 재무 시나리오 3종(보수·기본·공격) |

각 절은 `status: 확정 | 초안 | 확인 필요` 를 갖는다.

> **`intro` 범위**: 회사 소개 · 서비스 소개 · 프로그램 소개 · **제안서**. 제안서는 마지막
> '다음 행동' 절이 곧 제안 내용이 되어 소개와 요청이 한 사슬에서 이어진다.

> **`ir`이 1안·2안을 끄는 이유**: 투자자 앞의 "안 되면 저것"은 확신 부족으로 읽힌다.
> 대안은 **재무 시나리오 3종**으로 표현한다 — 이 업계의 기존 방식이다.
> `ir`은 **팀**이 독립 절로 들어가는 유일한 골격이다.

**`outline.md`** — 장별 뼈대. 이 설계의 중심 산출물.

```yaml
flow: "문제→원인→해결방안→기대효과"     # 사람이 택1
golden_circle: true
slides:
  - n: 1
    layer: why            # why | how | what
    role: cover
    title: "..."
    screen: "..."          # 화면 텍스트 요지
    script: "..."          # 상세 대본 요지
    shape: kpi_cards       # 내용 성격 → 레이아웃 (§5.3)
    source: "sources/x.md:L120"   # 근거 위치. 없으면 확인 필요
  - n: 9
    layer: what
    role: proposal_primary  # 1안
  - n: 10
    layer: what
    role: proposal_alt      # 2안 — 같은 목표, 다른 방법
```

### 3.2 Entity Relationships

```
intake.json  1──1  plan_spec.md  1──1  outline.md  1──1  design_spec.md
                        │                                      │
                        └──▶ exports/*_기획서.*        outline.slides[] ──▶ §IX
```

`outline.slides[].n` 은 `design_spec §IX`의 `Slide NN`과 1:1이다. 이 대응이 깨지면 검사에서 잡는다.

## 4. API Specification

confirm_ui 서버에 단계를 추가한다. **기존 3단계 계약은 그대로 두고 앞에 두 단계를 얹는다** — 회귀를 피하기 위해서다.

| 단계 | `recommendations.json.stage` | 화면 | 결과 |
|---|---|---|---|
| 신규 | `intake` | 인터뷰 폼 | `result.json` → `intake.json` |
| 신규 | `outline` | **전용 뼈대 편집 화면** | `outline.md` |
| 기존 | `stage1` `stage2` `stage3` | 지금 확인 화면 | 지금 `result.json` |

### 4.1 Endpoint List

| 메서드 | 경로 | 용도 |
|---|---|---|
| GET | `/api/outline` | `outline.md` 를 JSON으로 |
| POST | `/api/outline` | 편집 결과 저장 (전체 교체) |
| GET | `/api/plan-spec` | `plan_spec.md` 절별 JSON + status |
| POST | `/api/plan-spec` | 절 단위 수정 |

기존 `/api/session` `/api/recommendations` `/api/confirm` 은 **변경하지 않는다**.

## 5. UI/UX Design

### 5.1 Screen Layout — 뼈대 편집 화면 (신규)

```
┌─ 좌: 흐름 레일 ──┬─ 우: 장 목록 (드래그 가능) ─────────────┐
│ Why              │  ① 표지            [cover]      ⋮⋮      │
│  ├ 1 표지        │  ② 현상은 이렇다    [kpi_cards]  ⋮⋮      │
│  └ 2 현상        │  ③ 두면 이렇게 된다 [split]      ⋮⋮      │
│ How              │  ─────────────── 여기부터 How ──────────│
│  ├ 3 원인        │  ④ 원인            [vertical_list] ⋮⋮   │
│  └ …             │  …                                      │
│ What             │  ⑨ 1안 — 권고      [proposal]    ⋮⋮      │
│  ├ 9 1안         │  ⑩ 2안 — 대안      [proposal_alt] ⋮⋮     │
│  └ 10 2안        │                                          │
└──────────────────┴──────────────────────────────────────────┘
     [장 추가]  [선택 병합]  [흐름 다시 고르기]      [확정 →]
```

한 장을 펼치면 `제목 / 화면 텍스트 / 대본 / 근거 위치`를 그 자리에서 고친다.

### 5.2 User Flow

```
인터뷰 입력 → AI 기획 초안 → (부실 칸만) 1안/2안 확인
   → 흐름 1안/2안 택1 → 뼈대 자동 생성 → 사람이 편집 → 확정
   → 기존 디자인 확인 3단계 → 생성
```

### 5.3 내용 성격 → 레이아웃 배정 규칙

`notebooklmauto`의 Content Structure Rules를 `charts_index.json`에 잇는다.

| 내용 성격 | 판정 신호 | 배정 |
|---|---|---|
| 핵심 수치 나열 | 수치 3개 이상, 단위 혼재 | `kpi_cards` |
| 단계·순서형 | 순서어(먼저·다음·마지막), 번호 | `numbered_steps` |
| 비교형 | 전/후, A/B, 두 집단 | `comparison_columns` |
| 항목 나열 | 3~6개 병렬 항목 + 설명 | `vertical_list` |
| 시계열·추이 | 기간 + 값 쌍 | `grouped_bar_chart` / `dumbbell_chart` |
| 일반 설명 | 위에 해당 없음 | 본문 레이아웃 |

배정 결과는 `outline.slides[].shape`에 기록되고 **사람이 바꿀 수 있다**.

## 6. Error Handling

| 코드 | 상황 | 처리 |
|---|---|---|
| `E-FACT` | 현상·원인·배경 칸에 자료 근거가 없음 | 채우지 않고 `확인 필요` 뱃지 (P-2) |
| `E-PAIR` | 기대효과에 대응하는 영향이 없음 | 경고 + 짝 후보 제시 (P-3) |
| `E-GOAL` | 목표에 기간 또는 수준이 없음 | 1안/2안 만들어 되묻기 (P-4) |
| `E-ALT` | What 층에 2안이 없음 (`teach`·`ir`·`intro` 제외) | 생성 차단 + 2안 초안 제시 (P-8) |
| `E-IR` | `ir`에 재무 시나리오 3종이 없음 | 생성 차단 |
| `E-SYNC` | `outline.slides[].n` 과 `§IX` 불일치 | 내보내기 전 정지 |
| `E-CANVAS` | 캔버스 ≠ 템플릿 `canvas_format` | 기존 게이트 (Plan R-T3) — 기획 단계로 이동 |

## 7. Security Considerations

로컬 실행 유지. `plan_spec.md`·`outline.md`는 프로젝트 폴더 안에만 쓴다. 배경 분석의 웹 검색은 **선택**이며, 검색어에 고객사 고유 정보를 넣지 않는다(대외비 규칙).

## 8. Test Plan

### 8.1 Test Scope

UI 자동화(L2·L3)는 뼈대 편집 화면에만 적용한다. 나머지는 파일 계약 검증(L1)으로 충분하다.

### 8.2 L1 — 계약 테스트

| # | 시나리오 | 기대 |
|---|---|---|
| L1-1 | 근거 없는 현상 칸 | `status: 확인 필요`, 본문 비어 있음 |
| L1-2 | 영향 없이 기대효과만 있는 `plan_spec` | `E-PAIR` |
| L1-3 | 기간 없는 목표 | `E-GOAL` + 1안/2안 |
| L1-4 | 2안 없는 outline | `E-ALT`, 생성 차단 |
| L1-5 | `outline` 10장 → `§IX` 10장 | 1:1 대응 |
| L1-6 | 수치 3개 이상 장 | `shape: kpi_cards` 자동 배정 |

### 8.3 L2 — 뼈대 편집 화면

| # | 동작 | 기대 |
|---|---|---|
| L2-1 | 장 순서 드래그 | `n` 재부여, 흐름 레일 갱신 |
| L2-2 | 두 장 선택 후 병합 | 한 장으로, 대본 이어붙임 |
| L2-3 | 흐름 다시 고르기 | 사람이 고친 장은 유지, 나머지 재배열 |
| L2-4 | 장 삭제 후 확정 | `§IX` 에도 반영 |

### 8.4 L3 — E2E

| # | 시나리오 |
|---|---|
| L3-1 | 캠페인 PDF → 인터뷰 → 기획 → 뼈대 편집(순서 1회 변경) → 디자인 → PPTX. 바꾼 순서가 결과물에 반영됨 |
| L3-2 | 같은 재료로 기획서와 발표자료 둘 다 산출 |

### 8.5 Seed Data

`projects/20260903_speakup_campaign/sources/` — 이미 표 3개·수치가 확인된 자료라 회귀 기준으로 쓴다.

## 9. Clean Architecture

이 저장소는 계층형 앱이 아니라 **계약 문서 + 스크립트 + 오버레이 UI**다.

| 계층 | 위치 | 규칙 |
|---|---|---|
| 계약 (판단 규칙) | 포크 `references/*.md` | 규칙은 여기에만. 스크립트에 하드코딩 금지 |
| 실행 (강제·생성) | 포크 `scripts/` | 계약을 읽어 강제. 규칙을 스스로 정하지 않음 |
| 산출물 | 프로젝트 폴더 | `intake.json` `plan_spec.md` `outline.md` |
| 표현 (화면) | 오버레이 `ui/src/` | 산출물을 보여주고 고치게만 함. 판단하지 않음 |

**의존 방향**: 표현 → 산출물 → 실행 → 계약. 역방향 금지.

## 10. Coding Convention Reference

| 항목 | 규칙 |
|---|---|
| 문서 언어 | 사용자 대면 한국어, 코드 식별자·경로 영어 (`docs/rules/`) |
| 새 파일 이름 | `intake.json` `plan_spec.md` `outline.md` — 프로젝트 루트 |
| UI | 기존 `DESIGN.md` 규칙 준수. 한 스테이지 규칙은 전 스테이지에 |
| 환경변수 | 새로 만들지 않는다 |

## 11. Implementation Guide

### 11.1 File Structure

```
포크 (wedraw-ricky/slide-master)
  .claude/skills/ppt-master/
    SKILL.md                     Step 3.5 인터뷰 · Step 3.6 기획 · Step 3.7 뼈대 추가
    references/
      planner.md            [신규] 8단계 정의 + 검증 규칙 P-2~P-6
      storyline.md          [신규] 골든 서클 · 흐름 5종 · 1안/2안 · 레이아웃 배정표
      strategist.md              §e 색 우선순위, §g 서체 (Plan R-T1/T7)
    scripts/
      plan_spec.py          [신규] 자료 → plan_spec.md 초안 + 검증
      outline.py            [신규] plan_spec → outline.md, §IX 생성, 동기화 검사
      render_plan_doc.py    [신규] plan_spec → .md/.docx
      confirm_ui/server.py       intake · outline 단계와 2개 엔드포인트 추가

오버레이 (wedraw-ricky/wdb-ppt-ui)
  ui/src/
    intake.tsx             [신규] 인터뷰 화면
    outline/               [신규] 뼈대 편집 화면 (목록·드래그·병합·펼침 편집)
    api.ts                      outline·plan-spec 계약 추가
```

### 11.2 Implementation Order

계약 → 생성 → 화면 순. 화면 없이도 파일로 검증 가능한 상태를 먼저 만든다.

### 11.3 Session Guide

| 모듈 | 범위 | 선행 | 규모 |
|---|---|---|---|
| `module-1` | `planner.md` + `storyline.md` 계약 작성. **골격 6종** 정의·유형별 검증 규칙 표·흐름·레이아웃 배정표 | — | **L** |
| `module-2` | `plan_spec.py` — `frame`에 맞는 절 사슬로 추출 + 유형별 검증 + 1안/2안 생성 | 1 | M |
| `module-3` | `outline.py` — 골든 서클 배치, 1안/2안 슬라이드, 레이아웃 배정, `§IX` 생성·동기화 | 2 | M |
| `module-4` | `SKILL.md` Step 3.5~3.7 + `server.py` 단계·엔드포인트 | 3 | S |
| `module-5` | 오버레이 `intake.tsx` | 4 | S |
| `module-6` | 오버레이 뼈대 편집 화면 — 이 설계의 핵심 UI | 4 | **L** |
| `module-7` | `render_plan_doc.py` 기획서 산출 (`확인 필요:` docx 여부) | 2 | S |

**권장 분할**: 1–3을 한 세션(계약과 생성), 4–5를 한 세션(배선), 6을 단독 세션, 7은 별도.

## Version History

| 버전 | 날짜 | 변경 |
|---|---|---|
| 1.1 | 2026-09-04 | 골격 6종으로 분기. `intro` 범위 확정(회사·서비스·프로그램 소개·제안서), `ir` 신설(1안2안 끔 → 재무 시나리오 3종), `teach` 1안2안 끔 확정. `module-1` M→L |
| 1.0 | 2026-09-04 | 최초 작성. 설계안 B 선택. 대표 결정 3건 반영(1안·2안은 흐름과 결론에만 / 2안은 같은 목표 다른 방법 / 기획서·발표자료 둘 다) |
