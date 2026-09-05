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
| 제목 (보고서) | `[핵심 수단] + [결과/수치]` | 12–18자, 수식어 삭제, 결과는 정량. **보고서에만** — a 기획서 제목 follows [`planner.md`](./planner.md) §2.5 |
| 거버닝 메시지 | `[현황/문제] + [해결] + [정량 결과]` | 2–3문장, 현황 진단으로 시작 |
| 소제목 | `[대상/범위] + [핵심 조치]` | 명사형 20자 내외, 형용사 금지 |
| 본문 서술형 | `[현황] + [원인] + [영향]` | 1문장 1메시지(최대 2문장), 근거 1개 이상 |
| 본문 개조식 | `[주체] + [조치] + [수치]` | 형용사 금지, 명사형·`~함`·`추진`·`구축` 종결, 마침표 없음 |

**Enforced, not merely stated.** `plan_spec.py --check` reads this section:
`E-TITLE` (제목 shape, length, figure, 수식어), `E-GOV` (거버닝 메시지 present,
2–3문장, lands on a figure), `E-HEAD` (소제목 명사형, not a question, no
형용사), `E-WORD` (금지 수식어 in a body), `E-PUNCT` (개조식 마침표 and
서술형 종결). A register that only lives in a document is read once; run
against a document written without it, these found 29 violations.

### 2.3 Data

**Hard rule**: Only figures present in the input. A figure that is not in `sources/` is
not written — this restates `planner.md` §1 and holds here too.

**Hard rule**: An uncertain value carries `(확인 필요)` or `추정:`. A missing one stays
a placeholder (`[X%]`) rather than a guess.

**Forbidden — 통화·등락 혼동**: 원화, 계약통화, and 등락률 are three different figures.
Never substitute one for another.

---

## 3. Marker Hierarchy

Top to bottom. The **form** decides which glyph is drawn; the author writes the level.

| Level | Written as | `bok` draws | `khnp` draws |
|---|---|---|---|
| 대제목 | section chain position | `Ⅰ.` | `Ⅰ.` (ruled, accent) |
| 핵심 (두괄식) | `▢` or `□` at line start | `□` | `▢` |
| 세부 | `◦` `○` `─` `-` at line start | `─` | `◦` |
| 각주 | `*` or `※` at line start | `*` | `*` |
| 블록 | emitted by the renderer | `< >` | `< >` |

**Hard rule**: Both marker vocabularies are accepted on input. An author writing `▢`
gets `□` under `bok` and `▢` under `khnp` — the register is portable, the form is not.

---

## 4. Body Markup

What a `plan_spec.md` section body may carry. Everything here is typesetting
instruction, not prose: the Markdown draft strips it, the Word file renders it.

| Markup | Meaning |
|---|---|
| `▢ 제목` | 핵심 line — the 두괄식 conclusion of the block |
| `◦ 내용` | 세부 line under the 핵심 |
| `* 내용` | 각주 — provenance, caveats, source figures |
| `\| a \| b \|` rows | 통계표. First row is the header; a `\|---\|` separator row is ignored |
| `**강조**` | Bold |
| `{+텍스트}` | 개선 — rendered in the form's improve colour |
| `{-텍스트}` | 악화 — rendered in the form's worsen colour |
| `[확인 필요: …]` / `[추정: …]` | Badge — shaded inline chip |

**Hard rule**: A body with no markers still renders. The opening paragraph becomes the
핵심 and the rest 세부, so material written before this contract is not lost.

**Hard rule**: Figures are bolded automatically. Never hand-bold a number with `**`.

---

## 5. Direction — why `{+}` and `{-}` are written, not inferred

**Forbidden — inferring 개선/악화 from a figure**: Direction is a property of the
indicator, not of the number. 재해 `▼5건` is 개선; 공기 압박 `▲6.14%p` is 악화. Both
are falls and rises of the same shape, and a renderer that guesses reverses half of
them.

**Hard rule**: The author marks direction, or there is no colour. `{+▼5건}` is 개선
in blue; `{-▲6.14%p}` is 악화 in red; an unmarked figure is bold and black.

---

## 6. Forms

Presets live in [`templates/report_forms/`](../templates/report_forms/), one JSON per
form, selected with `--form`. `forms_index.json` names the default.

| Form | Look |
|---|---|
| `bok` | 한국은행 보도자료형 — 흑백, `□`/`─`, 맑은 고딕 제목 위 한컴바탕 본문, ruled 통계표 with vertical rules |
| `khnp` | 한수원 개조식형 — accent `#224C9D` 대제목·표 머리, `▢`/`◦`, 머리말·꼬리말, 세로선 없는 표, 개선 파랑 / 악화 빨강 |

Each form carries `page`, `fonts`, `sizes`, `line_spacing`, `markers`, `colors`
(including the page `ground`), `rules`, `chrome`. A new house style is a new JSON file — never a change to the
renderer.

**Type scale (Word points)** — both shipped forms use the same one; a new form may
set its own:

| Element | Size |
|---|---|
| 제목 | 22 |
| `Ⅰ` 대제목 | 16 |
| 본문 — `▢` 핵심 · `◦` 세부 | 15 |
| 통계표 | 14 |
| `*` 각주 | 12 |
| 별첨 제목 | 14 |
| 별첨 본문 · 표 | 12 |
| 머리말 · 꼬리말 | 10 |

**Line spacing**: 1.3 throughout; marker lines (`▢` `◦` `*`) run at 1.5 so the list
breathes against the surrounding text.

**Hard rule**: Word pads the seam between Hangul and Latin by default, which renders
`1,015명` as `1,015 명` — the figure split from its unit. `autoSpaceDE` / `autoSpaceDN`
are turned off in the document defaults. LibreOffice ignores both flags on import, so a
LibreOffice preview still shows the gap; Word does not.

**Hard rule**: A table sets a fixed layout and shares its width by what each column
holds. Under the default autofit a long label column wraps every row while a 증감 column
sits half empty.

**Hard rule**: Figures are bolded with their unit. In prose a bare numeral is left alone
— `1공구` and `문항 3` are names, not values. In a table cell the number *is* the value,
so it is bolded there with or without a unit.

**Hard rule**: A `▢` 핵심 line is bold as a whole. Where the author marked part of it
with `**`, that markup wins and the rest stays at normal weight — an option line
(`**1안** …`) is a sentence, not a heading, and reads wrong fully bold.

**Hard rule**: Page is A4 portrait, 여백 좌우 20mm · 상하 25mm.

> Note: these are documents, not decks — the CLAUDE.md Pretendard lock covers
> SVG-authored decks and does not reach them.

---

## 7. 기획서 Mapping

| `plan_spec.md` | Rendered as |
|---|---|
| `# {제목}` | 제목, form title font, accent, ruled |
| `heading:` | `Ⅰ`–`Ⅻ` 대제목 — the 소제목 §2.2 defines |
| `## N. {절 이름}` | Nothing. The frame name is how the chain is checked, never how a reader is addressed |
| `## 별첨 N. …` | `< 별첨 >` block after the argument, set at 별첨 size |
| `status` other than `확정` | `(확인 필요)` / `(초안)` on the 대제목, in the worsen colour |
| Section body | Parsed per §4 |
| `source:` | `*` 각주 |
| `intake.department` | 머리말·꼬리말의 발신 부서 |
| Sections not yet `확정` | `< 아직 닫히지 않은 항목 >` block at the end |

**Hard rule**: An empty section is rendered with its reason, never omitted.

**Hard rule**: A section carries `heading:` — the 소제목 a reader sees. Falling back to
the frame name puts pipeline vocabulary on the page: a 보고서 never says 하기로 한 것,
it says 캠페인 추진 배경 및 목표 수준.

**Hard rule**: The 제목 is centred. Body carries the argument; supporting tables,
원자료 and research go to `## 별첨 N. …`, which sits outside the frame chain and is
therefore invisible to `plan_spec.py --check`.

---

## 8. Forbidden

**Forbidden — renderer behavior**:
- Rewriting, shortening, or reordering a section body
- Inferring 개선/악화 to colour a figure
- Generating a figure, a date, or a section that is not in `plan_spec.md`
- Dropping a section because it is empty
- Hardcoding a form's fonts, colours or glyphs in the script
- Applying the form to the Markdown output — that surface stays plain
