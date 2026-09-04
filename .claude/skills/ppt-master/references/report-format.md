> See [`planner.md`](./planner.md) for the `plan_spec.md` contract this form renders.

# Report Format Specification

Typesetting and register contract for the 기획서 Word document: the Bank-of-Korea
report form — marker hierarchy, fonts, colour, and the 보고형 register the section
bodies are written in. Applied by [`render_plan_doc.py`](../scripts/render_plan_doc.py).

**Trigger**: every `.docx` render of `plan_spec.md`. Markdown output keeps the plain
working form — it is the draft surface, the Word file is the finished one.

---

## 1. Division of Labor

The register and the typesetting have different owners. Neither may do the other's job.

| Layer | Owns | Where |
|---|---|---|
| Planner | 문체 — how each section body is worded (§2) | `plan_spec.md` bodies |
| Renderer | 조판 — markers, fonts, colour, page (§3–§6) | `render_plan_doc.py` |

**Hard rule**: The renderer never rewrites a sentence. It cannot delete a 수식어,
convert 서술형 to 개조식, or move a 수치 to the front — those are authoring acts, and
text that arrives in the wrong register is rendered in the wrong register. A body that
does not follow §2 is a planner defect, not a rendering defect.

---

## 2. Register — 보고형 문체

Applies to every `plan_spec.md` section body.

### 2.1 Common

**Forbidden — 최상위·추상 수식어**: 차세대 · 지능형 · 혁신적 · 종합적 · 획기적 ·
최적의 · 효과적인 · 다양한 · 폭넓은. Delete, or replace with the concrete term.

**Hard rule**: The 수치 or the 결론 sits in the first third of the sentence. Elaboration
goes in parentheses.

**Hard rule**: 개조식 lines carry no full stop. 서술형 sentences do.

**Hard rule**: Break connective chains. Two or more of `~하며` / `~하고` / `~함으로써`
in one sentence becomes two sentences.

**Forbidden — 포괄어 with no referent**: 여러 가지 · 전반적. Replace with the items or
the figure.

### 2.2 Five Sentence Types

| Type | Shape | Limit |
|---|---|---|
| 제목 | `[핵심 수단] + [결과/수치]` | 12–18자, 수식어 삭제, 결과는 정량 |
| 거버닝 메시지 | `[현황/문제] + [해결] + [정량 결과]` | 2–3문장, 현황 진단으로 시작 |
| 소제목 | `[대상/범위] + [핵심 조치]` | 명사형 20자 내외, 형용사 금지 |
| 본문 서술형 | `[현황] + [원인] + [영향]` | 1문장 1메시지(최대 2문장), 근거 1개 이상 |
| 본문 개조식 | `[주체] + [조치] + [수치]` | 형용사 금지, 명사형·`~함`·`추진`·`구축` 종결, 마침표 없음 |

### 2.3 Data

**Hard rule**: Only figures present in the input. A figure that is not in `sources/` is
not written — this restates `planner.md` §1 and holds here too.

**Hard rule**: An uncertain value carries `(확인 필요)` or `추정:`. A missing one stays
a placeholder (`[X%]`) rather than a guess.

**Forbidden — 통화·등락 혼동**: 원화, 계약통화, and 등락률 are three different figures.
Never substitute one for another.

---

## 3. Marker Hierarchy

Top to bottom. A level is used only when the level above it exists.

| Marker | Level | Use |
|---|---|---|
| `Ⅰ` `Ⅱ` `Ⅲ` … | 대제목 (번호박스) | One per `plan_spec.md` section, in chain order |
| `1.` `2.` | 중분류 | Numbered subdivisions inside a 대제목 |
| `[ ]` | 소분류 | A labelled group inside 중분류 |
| `< >` | 블록 | A named block outside the chain (평가, 후속, 참고) |
| `□` | 핵심 | The 두괄식 opening line of a section — the conclusion first |
| `─` | 세부 | Supporting lines under a `□` |
| `*` | 각주 | Provenance and qualifications |
| `※` | 참고 | Auxiliary note |
| `▣` | 요약 두괄식 | Summary block only (보도자료 form) |

---

## 4. Typography

| Element | Face | Size |
|---|---|---|
| 제목 · 기관명 | 맑은 고딕 | 17pt |
| 요약 `▣` | 한컴바탕 | 13pt |
| 본문 · 각주 | 한컴바탕 | 11pt / 9pt |
| 통계표 | 한컴바탕 | 9pt, 실선 |

**Hard rule**: Page is A4 portrait.

> Note: this form is a document, not a deck — the CLAUDE.md Pretendard lock covers
> SVG-authored decks and does not reach it.

---

## 5. Colour

**Default — 흑백 (may override only for the two cases below)**: The form is black and
white. Emphasis comes from weight, not hue.

| Case | Colour |
|---|---|
| 숫자 | No hue — **bold** |
| 개선 (지표가 좋아진 방향) | 파랑 `#1F4E79` |
| 악화 (지표가 나빠진 방향) | 빨강 `#C00000` |
| 엠바고 | 파랑 `#0996D9` |

Direction depends on the indicator: for a higher-is-better metric a rise is 개선, for a
lower-is-better metric a fall is 개선.

**Hard rule**: Where the direction is not stated in the source, drop the colour and keep
the bold. The renderer therefore ships 숫자 bold only — inferring 개선/악화 from a figure
would be authoring, and a miscoloured figure reverses the reading.

---

## 6. 기획서 Mapping

How `plan_spec.md` lands in the form.

| `plan_spec.md` | Rendered as |
|---|---|
| `# {제목}` | 제목, 맑은 고딕 17pt, centred |
| frontmatter + intake | 통계표 (구성 · 목적 · 출발 · 대상 · 작성) |
| `## N. {절 이름}` | `Ⅰ`–`Ⅹ` 번호박스 대제목, chain order |
| `status` other than `확정` | `(확인 필요)` / `(초안)` on the 대제목 line |
| Section body, first block | `□` 핵심 |
| Section body, remaining blocks and bullets | `─` 세부 |
| `**1안**` / `**2안**` | `□` with the label in bold |
| `source:` | `*` 각주 |
| Sections not yet `확정` | `< 아직 닫히지 않은 항목 >` block at the end |

**Hard rule**: An empty section is rendered with its reason, never omitted. A form that
silently drops an unfilled section reads as complete when it is not.

---

## 7. Forbidden

**Forbidden — renderer behavior**:
- Rewriting, shortening, or reordering a section body
- Inferring 개선/악화 to colour a figure
- Generating a figure, a date, or a section that is not in `plan_spec.md`
- Dropping a section because it is empty
- Applying this form to the Markdown output — that surface stays plain
