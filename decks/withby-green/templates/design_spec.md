---
deck_id: withby-green
kind: deck
native_structure_mode: structured
summary: 위드비 그린 제안·사업설명 덱 — 사업제안, 투자유치, 지자체·공공 보고, 사업설명회
canvas_format: ppt169
page_count: 9
primary_color: "#039944"
---

# Withby Green Deck — Design Specification

> Ported from the `withb-green-design` skill. Every coordinate below was measured
> from the original 19-slide PPTX at 1280×720 and is not rounded; the archetype
> roster is that skill's own A–I catalogue. Colours come from its `colors.css` —
> the source PPTX theme is stock Office and is **not** the identity.

---

## I. Template Overview

| Property | Description |
| --- | --- |
| **Template Name** | withby-green |
| **Display Name** | 위드비 그린 (Withby Green) |
| **Use Cases** | 사업제안, 투자유치, 지자체·공공 보고, 사업설명회, 사내 승인 요청 |
| **Design Tone** | 딥 포레스트 지배색 + 라임 강조. 절제된 국문 제안서 어조 |
| **Theme Mode** | Light body pages; forest full-bleed for cover, statement and chapter |

**Anti-mood**: "알록달록한 SaaS 대시보드", "그라디언트 범벅 키노트", "클립아트 PPT".

**Litmus**: 한 장을 잘라 사업계획서에 붙여도 어색하지 않으면 통과.

---

## II. Canvas Specification

| Property | Value |
| --- | --- |
| **Format** | Standard 16:9 (`ppt169`) |
| **Dimensions** | 1280 × 720 px |
| **viewBox** | `0 0 1280 720` |
| **Left margin** | 전면형 65px · 스플릿형 56px — **섞어 쓰지 않는다** |
| **Content area** | y 217 – 662 (패널형은 y 194 시작) |

### Fixed zones

| Zone | Position | Spec |
| --- | --- | --- |
| 아이브로우 | x 59, y 47, h 33 | 700 / 19px / `#039944` |
| 페이지 번호 | x 1134, y 44, w 103 | 우측정렬 / 300 / 12px — **상단이다** |
| 제목 | x 65, y 113, w 1149, h 58 | 600 / 43px / `#00443D`, 자간 −0.02em |
| 본문 | y 217 시작, y 662 한계 | 넘지 않는다 |
| 출처 | y 669, w 1149 | 우측정렬 12px |

---

## III. Visual Theme

### Color Scheme — LOCKED

| Role | HEX | Token | Purpose |
| --- | --- | --- | --- |
| 지배색 (포레스트) | `#00443D` | `--p-dark` | 표지·간지·제목·표 헤더 |
| 브랜드색 (시그널그린) | `#039944` | `--p-brand` | 아이브로우·키워드·핵심 수치·차트 |
| 강조색 (라임) | `#C8FF64` | `--p-highlight` | **어두운 바탕 위에서만** |
| 보조색 | `#006A52` | `--p-support` | 차트 2계열, 보조 블록 |
| 밝은 계열 | `#92D050` | `--p-light` | 차트 3계열 |
| 난색 액센트 | `#FFB700` | `--p-warm` | **슬라이드당 1회** |
| 카드 틴트 (민트) | `#F2F6F2` | `--p-tint` | 카드 바닥 |
| 본문 글자 | `#1A1D1C` | | |
| 보조 글자 | `#4A5250` | | |
| 헤어라인 | `#E3E8E6` | | |

**Color rules**
- 라임은 어두운 바탕 전용. 흰 바탕에 절대 쓰지 않는다 (대비 미달).
- 브랜드색으로 큰 면을 칠하지 않는다. 큰 면은 지배색이 맡는다.
- 난색은 슬라이드당 1회.
- 팔레트는 교체 가능하다 (딥블루·테라코타·딥퍼플·모노크롬). **구조는 고정이다.**

---

## IV. Typography System

| Role | Family | Size / Weight |
| --- | --- | --- |
| 표지 워드마크 | `Georgia` (세리프) | 77px / 700 |
| 스테이트먼트 | `Paperlogy ExtraBold` | 59–64px |
| 제목 (전면형) | `Paperlogy SemiBold` | 43px / 600, 자간 −0.02em |
| 제목 (스플릿형) | `Paperlogy SemiBold` | 32px / 600 |
| 컬럼 헤드 | `Paperlogy SemiBold` | 29px / 700 |
| 큰 수치 | `Paperlogy ExtraBold` | 27px |
| 아이브로우 | `Freesentation` | 19px / 700 |
| 본문·리드 | `Freesentation` | 16px / 300, line-height 1.7 |
| 캡션·각주 | `Freesentation` | 12–14px / 300 |

**Per-role stacks**
- Display: `'Paperlogy SemiBold', Paperlogy, 'Malgun Gothic', sans-serif`
- Display ExtraBold: `'Paperlogy ExtraBold', Paperlogy, 'Malgun Gothic', sans-serif`
- Core: `Freesentation, Paperlogy, 'Malgun Gothic', sans-serif`
- Serif (표지 전용): `Georgia, 'Times New Roman', serif`

> 제목이 길면 **줄바꿈보다 급수를 낮춘다** (43 → 32 → 24). Freesentation과
> Paperlogy 모두 설치가 필요하다; 미설치 PC에서는 대체 폰트로 떨어진다.
> 원본 시스템의 EB Garamond·Jost는 미설치라 각각 Georgia·Paperlogy로 해석한다.

---

## V. Page Structure

전면형은 고정 존을 그대로 쓰고, 스플릿형은 좌 411px / 우 728px로 나눈다.

```
스플릿(G)  좌 x56 w411 : y130 제목 · y359 리드문
           우 x487 w728 : y145~ 근거
```

---

## VI. Icon Usage

`assets/icons/` 의 브랜드 아이콘(leaf-mark, energy, recycle-loop, network, loop-arrows)
또는 `tabler-outline`. 아이콘은 포레스트 원형 디스크 안에 흰색으로 얹는 것이 기본.

---

## VII. SVG Page Roster — 아키타입 9종

| File | Layout key | Role | 원본 | Description |
| --- | --- | --- | --- | --- |
| `01_cover.svg` | `a-cover` | 표지 | 1 | 포레스트 바탕 + y365 사진 6열, **가운데 한 장만 위로 42px·1.12배** (의도적 리듬 파괴) + 라임 세리프 워드마크 |
| `02_toc.svg` | `b-toc` | 목차 | 2 | 부제가 제목 **위**에 온다. y225 배너 + y412 4열 (번호 두 자리 고정 + 2px 밑줄) |
| `03_statement.svg` | `c-statement` | 철학 스테이트먼트 | 3, 9 | 좌우 절반. 한쪽 전면 사진, 한쪽 포레스트 + 라임. 아이브로우 없음 |
| `04_chapter.svg` | `d-chapter` | 간지 | 4 | 풀블리드 사진 + 지배색 62% 스크림 + 라임 번호·제목 |
| `05_panel.svg` | `e-panel` | 전면 패널 | 5, 6 | y194에서 상단만 둥근(r22) 패널이 화면 아래로 빠져나간다. 룰 칩 + KPI 스택 |
| `06_three_col.svg` | `f-three-col` | 3단 병렬 | 10 | 컬럼 헤드 3개 (**첫 열만 시그널그린**) + 사진 104px + 민트 카드 2장. 거터 39px |
| `07_split.svg` | `g-split` | 스플릿 상세 | 11–15 | **주력 틀.** 좌 주장 + 리드문(4~6줄, 이 시스템에서 유일하게 긴 산문 허용) / 우 근거 |
| `08_quote.svg` | `h-quote` | 인용·보도 | 7, 8 | 좌 제목 + 기간 / 우 기사 사진 + 캡션 + 2단 본문 |
| `09_process.svg` | `i-process` | 절차 | 17–19 | 7단계가 좌→우로 위아래 번갈아. **마지막 단계만 시그널그린**, 중앙 여백에 워터마크 |

---

## VIII. Layout Patterns (요소 규칙)

- **아이브로우** `NN 대분류  •  소분류` — 가운뎃점 좌우 공백 두 칸. 간지·표지·스테이트먼트에는 없다.
- **강조** 문장 안 키워드 1~2개만 700 + 시그널그린. 밑줄·이탤릭·형광 없음. 어두운 바탕에서는 라임.
- **수치** 큰 수 800/27px + 단위 500/16px 회색. 증감은 `▲ 매년 4%씩 증가` — 삼각형·수치·동사 세 조각을 모두 쓴다.
- **차트** 값 라벨은 막대 **위**. y축·격자선을 그리지 않는다.
- **카드** 그림자 없음. 민트 바닥 또는 지배색 + 1.6px 외곽선. 반경 8 / 15 / 19 / 22(상단만) / 999.
- **표** 포레스트 헤더 밴드 + 지브라(흰↔민트) + 1px 하단 헤어라인. **세로선 없음.**
- **출처** 우측 하단 12px `출처 : …`. 미확정은 `(미정 _ 추후 확정 시 변경가능)`.

---

## IX. Spacing

| Element | Value |
| --- | --- |
| Grid | 8px 배수 |
| 컬럼 거터 (3단) | 39px |
| 카드 패딩 | 22px |
| 카드 반경 | 8 / 15 / 19 / 22(상단만) / 999 |
| 헤어라인 | 1px `#E3E8E6` |

---

## X. Placeholder Specification

| Shell | Placeholders |
| --- | --- |
| `01_cover.svg` | `{{TITLE}}` `{{SUBTITLE_1}}` `{{SUBTITLE_2}}` `{{PHOTO_1..6}}` `{{LOGO}}` |
| `02_toc.svg` | `{{KICKER}}` `{{PAGE_TITLE}}` `{{BANNER}}` `{{NUM_1..4}}` `{{SECTION_1..4}}` `{{ITEMS_1..4}}` `{{PAGE_NUM}}` |
| `03_statement.svg` | `{{PHOTO}}` `{{LABEL}}` `{{STATEMENT_TITLE}}` `{{STATEMENT_BODY}}` `{{PAGE_NUM}}` |
| `04_chapter.svg` | `{{PHOTO}}` `{{CHAPTER_NO}}` `{{CHAPTER_TITLE}}` `{{CHAPTER_SUMMARY}}` `{{PAGE_NUM}}` |
| `05_panel.svg` | `{{EYEBROW}}` `{{PAGE_TITLE}}` `{{PANEL_LABEL}}` `{{PANEL_HEADLINE}}` `{{KPI_VALUE_1..3}}` `{{KPI_LABEL_1..3}}` `{{PANEL_VISUAL}}` `{{FOOTNOTE}}` `{{SOURCE}}` `{{PAGE_NUM}}` |
| `06_three_col.svg` | `{{EYEBROW}}` `{{PAGE_TITLE}}` `{{COL_HEAD_1..3}}` `{{COL_PHOTO_1..3}}` `{{CARD_n_m_TITLE}}` `{{CARD_n_m_BODY}}` `{{SOURCE}}` `{{PAGE_NUM}}` |
| `07_split.svg` | `{{EYEBROW}}` `{{KICKER}}` `{{PAGE_TITLE}}` `{{LEAD}}` `{{FEATURE_1..4_TITLE}}` `{{FEATURE_1..4_BODY}}` `{{SOURCE}}` `{{PAGE_NUM}}` |
| `08_quote.svg` | `{{EYEBROW}}` `{{PAGE_TITLE}}` `{{PERIOD}}` `{{PRESS_PHOTO}}` `{{PHOTO_CAPTION}}` `{{ARTICLE_1..2}}` `{{SOURCE}}` `{{PAGE_NUM}}` |
| `09_process.svg` | `{{EYEBROW}}` `{{PAGE_TITLE}}` `{{SPINE_LABEL}}` `{{STEP_1..7_NO}}` `{{STEP_1..7_TITLE}}` `{{STEP_1..7_BODY}}` `{{STEP_1..7_DOC}}` `{{SOURCE}}` `{{PAGE_NUM}}` |

옵션 토큰은 쓰지 않을 때 해당 `<text>` 요소를 통째로 지운다.

---

## XI. Asset Specification

사진·로고는 **슬롯**으로 비워 뒀다. 원본 덱의 Eco-GRID 로고와 현장 사진은
특정 고객사 자산이므로 재사용 템플릿에 포함하지 않는다. 사용 시 프로젝트의
`images/` 에 넣고 슬롯에 연결한다.

---

## XII. Anti-Pattern Checklist

- [ ] 흰 바탕에 라임
- [ ] 브랜드색으로 큰 면 칠하기
- [ ] 난색 2회 이상
- [ ] 표에 세로선
- [ ] 차트에 y축·격자선
- [ ] 제목 줄바꿈 (급수를 낮춰야 한다)
- [ ] 전면형 65px와 스플릿형 56px 여백 혼용
- [ ] 아키타입 9종 밖의 새 틀 발명
