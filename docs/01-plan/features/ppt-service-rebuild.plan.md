# ppt-service-rebuild Planning Document

| | |
|---|---|
| Feature | `ppt-service-rebuild` — 사이클 1 |
| Phase | Plan |
| PRD | [`docs/00-pm/ppt-service-rebuild.prd.md`](../../00-pm/ppt-service-rebuild.prd.md) |
| 작성 | 2026-09-04 |
| 결정권자 | 유민균 대표 |

## Executive Summary

| 관점 | 내용 |
|---|---|
| **Problem** | 에이전트가 계약을 확인하지 않고 단정한다. 한 세션에서 네 번 나타났고, 가장 비싼 건 **A4 8쪽을 다 만들고 폐기**한 일이다. 나머지 셋(고객 CI 색 강등, 검사 출력 절단 후 "0 errors" 오보고, PDF 표 소실 무경고)도 같은 뿌리다. |
| **Solution** | 되돌릴 수 없는 비용이 큰 판단 두 가지(캔버스 불일치·변환 손실)는 **코드 게이트로 정지시키고 대표에게 되묻는다**. 나머지는 계약 문서의 규칙과 출력 형식 변경으로 닫는다. 여기에 "계약이 침묵할 때 조용히 판단하지 않는다"는 상위 규칙(R-T8)을 얹어 다섯 번째 증상을 막는다. |
| **Function UX Effect** | 첫 페이지를 그리기 전에 멈춘다. 색 후보 1순위부터 고객 CI가 주색으로 나온다. 검사 결과는 첫 줄에서 덱 에러 수를 알려준다. 변환 직후 "표 3개 중 0개" 경고가 뜬다. 서체 규칙이 하나가 된다. |
| **Core Value** | **폐기 페이지 0, 재작업 개입 0.** 대표가 "이거 왜 이래?"라고 지적해야만 발견되던 판단 오류를, 파이프라인이 스스로 멈춰 되묻는 구조로 바꾼다. |

## Context Anchor

| | |
|---|---|
| **WHY** | 결과물 품질은 대표 평가로 "괜찮다". 문제는 거기 도달하는 **판단 과정**이다. 한 세션에서 8쪽 폐기 + 3건의 재작업/오보고가 났고, 전부 에이전트가 확인 없이 단정해서 생겼다. |
| **WHO** | ① 유민균 대표 — 클라이언트 덱을 직접 판정하는 제작 전문가 ② 실습생 — 콜드 스타트, 규칙을 모름 ③ 에이전트 자신 — 실패의 주체 |
| **RISK** | 규칙만 늘리면 에이전트가 안 읽는다(프롬프트 팽창). 게이트를 남발하면 흐름이 끊긴다. 이 둘의 경계가 이 사이클의 핵심 설계 판단이다. |
| **SUCCESS** | 다음 클라이언트급 덱 1건에서 폐기 페이지 0 · 색 재지정 개입 0 · 검사 오보고 0 · 변환 손실 무경고 통과 0. |
| **SCOPE** | 포크(`wedraw-ricky/slide-master`) 안의 계약 문서와 스크립트 국소 수정만. SVG 저작·내보내기·UI는 건드리지 않는다. |

## 1. Overview

### 1.1 Purpose

파이프라인이 **자기가 못 하는 일을 할 수 있다고 말하지 않게** 하고, **되돌릴 수 없는 비용이 큰 지점에서 스스로 멈추게** 한다.

### 1.2 Background

2026-09-03 한 세션에서 관찰된 네 가지 실패(PRD §3). 결과물이 아니라 판단이 문제였고, 네 가지 모두 "계약을 확인하지 않고 단정"이라는 하나의 뿌리에서 나왔다.

포크 이전에는 파이프라인을 고칠 수 없어 오버레이 UI 가드(`wdb-ppt-ui@92839be`)로 절반만 막았다. 2026-09-04 포크(`wedraw-ricky/slide-master`)로 파이프라인이 편집 가능해져 근본 수정이 가능해졌다.

### 1.3 Related Documents

| 문서 | 역할 |
|---|---|
| [`docs/00-pm/ppt-service-rebuild.prd.md`](../../00-pm/ppt-service-rebuild.prd.md) | 근거·기회·전체 요구사항(R-T/F/U/P/O) |
| `.claude/skills/ppt-master/references/strategist.md` (614줄) | 판단 계약 — §a 발언 규칙, §e 색, §g 서체 |
| `.claude/skills/ppt-master/SKILL.md` (1,028줄) | 실행 절차 — Step 1 변환, Step 3 템플릿 설치, Step 4 확인, Step 6/7 검사·내보내기 |
| `.claude/skills/ppt-master/references/structured-templates.md` | `canvas_format` 고정 계약의 출처 |
| `docs/rules/` | 프롬프트·파이썬 문체 규칙 |

## 2. Scope

> **범위 변경 (2026-09-04, 대표 지시)**: 대표의 실제 제작 과정(자료 → 기획 → 슬라이드)과
> 대조한 결과, 파이프라인에 **기획·스토리라인 단계가 통째로 없다**는 것이 확인됐다.
> 확정 항목 19개 중 내용에 닿는 것은 4개뿐이고 장별 뼈대는 한 번도 묻지 않는다.
> 이에 따라 **사이클 1의 범위를 기획·스토리라인 단계 신설로 교체**한다.
> 아래 R-T 판단 게이트 4건은 폐기가 아니라 새 단계 안으로 흡수된다 — 캔버스 게이트는
> 기획 단계의 '문서 형태' 결정으로, 팩트·색·서체 규칙은 AI 검증 규칙으로 자리를 옮긴다.
> 자세한 내용은 [`docs/02-design/features/ppt-service-rebuild.design.md`](../../02-design/features/ppt-service-rebuild.design.md).


### 2.1 In Scope

| ID | 요구사항 | 형태 | 위치 |
|---|---|---|---|
| **R-T3** | 캔버스 ≠ 템플릿 `canvas_format`이면 지연 설치 preflight에서 **정지**하고 두 선택지(캔버스를 템플릿에 맞춤 / flat으로 내려 색·서체만) 제시 | 게이트 | 설치 경로 + `SKILL.md` Step 3/4 |
| **R-T2** | 파이프라인 능력을 말하기 전에 계약 문서를 확인. "다른 비율로 재배치된다"류 발언 금지 명시 | 규칙 | `strategist.md` §a, `SKILL.md` |
| **R-T1** | 조직명 + CI 색이 주어지면 **CI가 주색**, 템플릿 색은 보조. 예외는 템플릿이 그 조직의 브랜드 프리셋일 때 | 규칙 | `strategist.md` §e, `SKILL.md` Step 4 |
| **R-T7** | 서체는 **템플릿 지정 우선**(대표 결정 D-3). 미설치 PC 경고를 함께 낸다. 루트 `CLAUDE.md`의 Pretendard 고정을 이에 맞춰 개정 | 규칙 | `CLAUDE.md`, `strategist.md` §g |
| **R-T4** | 검사 출력 절단 금지 + `svg_quality_checker.py`가 **덱 수준 에러와 카운트를 최상단에** 출력 | 규칙 + 출력 형식 | `SKILL.md` Step 6/7, `svg_quality_checker.py` (4,631줄) |
| **R-T5** | 변환 프로파일에 **소스 측 표·이미지 카운트** 신설 → 출력과 비교, 불일치 시 `warnings[]`. Step 1은 warnings가 비면 진행, 아니면 **정지** | 게이트 | `pdf_to_md.py` (1,813줄), `_conversion_profile.py` (235줄), `SKILL.md` Step 1 |
| **R-T8** | 계약이 침묵하는데 두 근거가 상충하면 조용히 한쪽으로 판단하지 않고 **가정을 표시하거나 되묻는다** | 규칙 (상위) | `strategist.md` 서두 |

### 2.2 Out of Scope

- **플로우** R-F1~F4 (진행 상태 표시, 서버 하트비트, 전환 시간, 이전 단계로) — 다음 사이클
- **UI** R-U1~U3 (섹션당 1화면 스텝) — 다음 사이클, 오버레이 소관
- **유려함** R-P1~P2 — R-F1에 종속
- **R-T6** 템플릿 등록 린트 — 우선순위 S, 다음 사이클
- **캔버스 크기별 스타일 성향** (PRD §13) — 백로그
- **SVG 저작 규칙과 내보내기** (`executor-base.md`, `svg_to_pptx`) — N-5, 절대 불변
- **업스트림 PR용 코드 격리** — 대표 결정: PR 계획 없음. 격리 없이 최단 경로로 수정

## 3. Requirements

### 3.1 Functional Requirements

**FR-1 (R-T3, R-T2) — 캔버스 불일치 게이트**

- FR-1.1 지연 설치 시 프로젝트 `canvas_format`과 덱 `canvas_format`을 비교한다.
- FR-1.2 다르면 **설치를 진행하지 않고 정지**한다. 부분 설치 상태를 남기지 않는다.
- FR-1.3 채팅에 두 선택지를 제시하고 **대표 답을 기다린다**(결정: 항상 되묻기). 자동 교정하지 않는다.
- FR-1.4 `strategist.md` §a와 `SKILL.md`에 금지 발언 목록을 둔다: 템플릿이 다른 비율로 재배치된다 / `adaptive`가 Master를 새로 만든다 / 구조화 라우트가 캔버스를 따라간다.
- FR-1.5 오버레이 UI 가드(`92839be`)와 **같은 두 선택지**를 쓴다. 문구가 갈리지 않게 한다.

**FR-2 (R-T1) — 고객 CI 색 우선**

- FR-2.1 대화나 프로젝트에 조직명 + CI 색이 있으면 색 후보 1순위의 `primary`는 CI 색이다.
- FR-2.2 템플릿이 선언한 스킨은 2순위 후보로 내려간다. 후보에서 없애지는 않는다.
- FR-2.3 예외: 템플릿 자체가 그 조직의 브랜드 프리셋이면 템플릿이 이긴다.
- FR-2.4 CI 색이 CMYK 등에서 변환된 추정값이면 후보 설명에 `추정:`을 남긴다.
- FR-2.5 `SKILL.md` Step 4의 "덱 스킨이 색을 덮어쓴다"는 지연 설치 재조정 규칙에 이 예외를 명시한다.

**FR-3 (R-T7) — 서체 단일 진실**

- FR-3.1 **템플릿 지정 서체가 이긴다.** 루트 `CLAUDE.md`의 Pretendard 고정을 "템플릿이 서체를 선언하지 않은 경우의 기본값"으로 개정한다.
- FR-3.2 확정된 서체가 이 PC에 설치돼 있지 않으면 경고한다.
- FR-3.3 PPTX가 서체를 품지 않는다는 사실을 덱 완료 보고에 항상 포함한다.

**FR-4 (R-T4) — 검사 결과 오보고 차단**

- FR-4.1 `svg_quality_checker.py`가 **덱 수준 에러와 전체 카운트를 출력 최상단**에 먼저 낸다.
- FR-4.2 `SKILL.md` Step 6/7에 검사 출력을 `head`/`tail`/필터로 잘라 읽는 것을 금지한다고 명시한다.
- FR-4.3 통과 선언은 요약줄을 근거로만 한다.

**FR-5 (R-T5) — 변환 손실 검출**

- FR-5.1 `pdf_to_md.py`가 **소스 측 표·이미지 카운트**를 센다.
- FR-5.2 `_conversion_profile.py`가 소스 카운트와 출력 카운트를 비교해 불일치를 `warnings[]`에 기록한다.
- FR-5.3 `SKILL.md` Step 1은 `warnings[]`가 비어 있지 않으면 **정지**하고 원본 확인을 요청한다(결정: 항상 되묻기).
- FR-5.4 경고 문구에 무엇이 몇 개 중 몇 개 변환됐는지 적는다.

**FR-6 (R-T8) — 침묵하는 계약**

- FR-6.1 두 근거가 상충하는데 계약이 우선순위를 정하지 않았으면, 조용히 한쪽을 택하지 않는다.
- FR-6.2 가정을 확인 화면이나 채팅에 표시하거나 되묻는다.
- FR-6.3 `strategist.md` 서두에 배치해 §a~§g보다 먼저 읽히게 한다.

### 3.2 Non-Functional Requirements

| ID | 요구사항 |
|---|---|
| N-1 | 오버레이의 업스트림 무수정 원칙은 유지한다. 이번 수정은 전부 포크 안이다. |
| N-2 | 규칙 추가로 인한 프롬프트 팽창을 억제한다. 새 규칙은 기존 절에 흡수하고, 새 절은 R-T8 하나만 만든다. |
| N-3 | 사용자 대면 문구는 한국어, 코드 식별자·경로는 영어. `docs/rules/` 문체 규칙과 디렉터리별 단일 언어 규칙을 따른다. |
| N-4 | 완전 로컬 실행 유지. |
| N-5 | SVG 저작 규칙(`executor-base.md`, 레이아웃 아키타입)과 `svg_to_pptx` 내보내기를 **한 줄도 바꾸지 않는다**. |
| N-6 | 게이트는 부분 상태를 남기지 않는다. 정지 시 프로젝트는 게이트 진입 전과 같아야 한다. |

## 4. Success Criteria

### 4.1 Definition of Done

| # | 기준 | 검증 방법 |
|---|---|---|
| SC-1 | 캔버스≠템플릿 조합에서 **설치 전에** 정지하고 두 선택지를 낸다 | ppt169 덱 + a4 캔버스로 재현. 정지 확인 + `templates/` 미생성 확인 |
| SC-2 | 금지 발언 목록이 계약 문서에 있고, 에이전트가 그 상황에서 그 말을 하지 않는다 | 문서 grep + 재현 세션 1회 |
| SC-3 | 조직명 + CI 색이 주어지면 색 후보 1순위 `primary`가 CI 색이다 | 한수원 조건 재현. `recommendations.json` 확인 |
| SC-4 | 서체 규칙이 하나다. `CLAUDE.md`와 `strategist.md` §g가 서로 모순되지 않는다 | 두 문서 대조 |
| SC-5 | `svg_quality_checker.py` 출력 **첫 10줄 안에** 덱 수준 에러 수가 있다 | 실제 덱으로 실행, 첫 10줄 확인 |
| SC-6 | 표가 있는 PDF를 변환하면 소스/출력 카운트가 프로파일에 기록되고, 불일치 시 warnings가 찬다 | 이번 캠페인 PDF로 재현(표 3개 소실 건) |
| SC-7 | Step 1이 warnings 있을 때 정지한다 | 위 PDF로 파이프라인 진입 시도 |
| SC-8 | 기존 덱 3종이 여전히 정상 생성된다 | `projects/` 3종 회귀 확인 |

### 4.2 Quality Criteria

- 프롬프트 문서 증가량 **200줄 이내** (N-2). 초과 시 기존 절 압축.
- 게이트 오탐 0 — 정상 조합에서 멈추지 않는다(SC-8이 담보).
- 모든 새 문구는 `docs/rules/` 문체 규칙 통과.

## 5. Risks and Mitigation

| 위험 | 영향 | 완화 |
|---|---|---|
| 규칙을 늘려도 에이전트가 안 읽는다 (핵심 위험) | 이번 사이클 전체가 무효 | 비용 큰 둘은 **코드 게이트**로 강제. 규칙은 실패해도 게이트가 남는다 |
| 게이트가 정상 흐름을 막는다 | 대표가 매번 되묻기에 시달림 | SC-8 회귀로 오탐 확인. 게이트는 **두 지점에만** |
| 프롬프트 팽창으로 다른 규칙이 밀려남 | 새 실패 유형 | 200줄 상한. 새 절은 R-T8 하나만 |
| `svg_quality_checker.py`(4,631줄) 출력 형식 변경이 기존 파서를 깬다 | 다른 스크립트 오작동 | `verify_deck.py` 등 소비자 확인 후 변경 (§6.2) |
| `pdf_to_md.py`(1,813줄) 카운트 로직이 오탐 | 정상 변환에서 정지 | 표·이미지 두 종류만. 임계값은 "0개 변환"처럼 명백한 경우 우선 |
| 업스트림이 같은 파일을 고쳐 충돌 | 머지 비용 | PR 계획 없음(대표 결정). 충돌 시 우리 것 우선 |

## 6. Impact Analysis

### 6.1 Changed Resources

| 파일 | 현재 | 변경 성격 |
|---|---|---|
| `references/strategist.md` | 614줄 | §a 금지 발언, §e 색 우선순위, §g 서체, 서두 R-T8 |
| `SKILL.md` | 1,028줄 | Step 1 정지, Step 3/4 게이트·재조정, Step 6/7 절단 금지 |
| `CLAUDE.md` (루트) | — | 서체 정책 개정 (FR-3.1) |
| `scripts/svg_quality_checker.py` | 4,631줄 | 출력 순서만. 판정 로직 불변 |
| `scripts/source_to_md/pdf_to_md.py` | 1,813줄 | 소스 측 카운트 신설 |
| `scripts/source_to_md/_conversion_profile.py` | 235줄 | 비교·warnings |
| 지연 설치 경로 | `SKILL.md` Step 4 + 설치 스크립트 | preflight 정지 |

### 6.2 Current Consumers

변경 전 확인해야 할 소비자:

- `svg_quality_checker.py` 출력을 읽는 것: `verify_deck.py`, `batch_validate.py`, `SKILL.md` Step 6/7
- `conversion_profile.json`을 읽는 것: `SKILL.md` Step 1, `project_manager.py import-sources`
- `strategist.md`를 읽는 것: `SKILL.md` Step 4, 오버레이는 읽지 않음

### 6.3 Verification

```bash
# 회귀 — 기존 덱 3종
python3 .claude/skills/ppt-master/scripts/verify_deck.py projects/20260902_slide_master_setup_report
python3 .claude/skills/ppt-master/scripts/verify_deck.py projects/20260903_khnp_best_practice
python3 .claude/skills/ppt-master/scripts/verify_deck.py projects/20260903_speakup_campaign

# 게이트 재현 — 표 소실 PDF
python3 .claude/skills/ppt-master/scripts/source_to_md.py \
  "projects/20260903_speakup_campaign/sources/「먼저 말하는 현장 캠페인」 결과 및 전사 확대(안).pdf"

# 검사 출력 첫 10줄에 요약이 있는가
python3 .claude/skills/ppt-master/scripts/svg_quality_checker.py \
  projects/20260903_speakup_campaign/svg_output | head -10
```

## 7. Architecture Considerations

### 7.1 Project Level Selection

**Starter/Dynamic 아님 — 스킬 패키지 수정.** 앱 스캐폴딩(테스트 러너, CI, 워크트리)을 도입하지 않는다. 루트 `CLAUDE.md`의 Compatibility Boundary를 따른다.

### 7.2 Key Architectural Decisions

| # | 결정 | 근거 |
|---|---|---|
| AD-1 | 비용 큰 둘만 코드 게이트, 나머지는 규칙 | 게이트 남발은 흐름을 끊고, 규칙만으로는 강제력이 없다. 경계는 "되돌리기 비용" |
| AD-2 | 게이트는 **항상 되묻는다** (대표 결정) | 자동 교정은 대표 의도와 다를 수 있고, 이번 8쪽 폐기가 정확히 그 실패다 |
| AD-3 | 서체는 **템플릿 지정 우선** (대표 결정 D-3) | 현재 실동작과 일치(withby-green이 Paperlogy로 나감). CI 색 규칙과 같은 문장 구조로 묶인다 |
| AD-4 | 업스트림 PR용 격리 없음 (대표 결정) | 최단 경로로 수정. 충돌은 우리 것 우선 |
| AD-5 | R-T8을 `strategist.md` **서두**에 | §a~§g보다 먼저 읽혀야 개별 규칙이 못 잡는 공백을 덮는다 |
| AD-6 | 검사기는 **출력 순서만** 바꾸고 판정 로직은 불변 | 4,631줄에서 판정을 건드리면 회귀 위험이 이번 사이클 이득보다 크다 |

### 7.3 Clean Architecture Approach

이 저장소는 계층형 앱이 아니라 **계약 문서 + 스크립트**다. 적용할 원칙:

- **계약과 실행의 분리** — 판단 규칙은 `references/`에, 강제는 `scripts/`에. 규칙을 스크립트에 하드코딩하지 않는다.
- **단일 진실** — 같은 규칙을 두 문서에 복사하지 않는다. 서체 충돌(FR-3)이 정확히 복사로 생긴 문제다.
- **게이트는 순수** — 게이트는 판정하고 멈출 뿐, 자동 교정하지 않는다(AD-2).

## 8. Convention Prerequisites

### 8.1 Existing Project Conventions

- `docs/rules/` — 프롬프트 파일과 파이썬 문체 규칙. 새 문구는 여기 따른다.
- 디렉터리별 단일 언어 — `references/`, `workflows/`는 현재 언어를 유지한다.
- 루트 `CLAUDE.md` Compatibility Boundary — 일반 프로젝트 관행 도입 금지.

### 8.2 Conventions to Define/Verify

| # | 정의할 것 |
|---|---|
| C-1 | 게이트 정지 메시지의 형식 — 무엇이 왜 막혔고 선택지가 무엇인지 세 줄 |
| C-2 | `warnings[]` 스키마 — `conversion_profile.json`의 기존 필드와 충돌하지 않게 |
| C-3 | 금지 발언 목록의 위치와 형식 — `strategist.md` §a 안의 표 |

### 8.3 Environment Variables Needed

없음. 새 환경변수를 도입하지 않는다.

### 8.4 Pipeline Integration

```bash
# 현재 상태
python3 -c "import json;print(json.load(open('.bkit/state/pdca-status.json'))['features']['ppt-service-rebuild']['phase'])"

# 다음 단계
/pdca design ppt-service-rebuild
```

## 9. Next Steps

1. `/pdca design ppt-service-rebuild` — 3가지 설계안 비교 후 대표가 선택
2. 설계 확정 후 `/pdca do ppt-service-rebuild` — 게이트 2개부터, 규칙은 그 뒤
3. `/pdca analyze` — SC-1~SC-8 검증. 특히 SC-8 회귀
4. 다음 사이클 후보: R-F(플로우), R-U1(UI 스텝), R-T6(템플릿 린트)

## Version History

| 버전 | 날짜 | 변경 |
|---|---|---|
| 1.0 | 2026-09-04 | 최초 작성. PRD §14 상위 4건 + R-T7·R-T8 묶음. 대표 결정 3건 반영(서체 템플릿 우선 / 게이트는 항상 되묻기 / 업스트림 PR 없음) |
