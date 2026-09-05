# Design System — WDB Confirm UI

## Product Context

- **What this is:** the one screen where a person decides what their deck will
  look like, before the pipeline spends minutes generating it.
- **Who it's for:** non-specialists at WDB and its clients. They know their
  content and their audience; they do not know what "SAT", "MECE",
  "Master/Layout" or "IMAGE_BACKEND" mean, and should never have to.
- **Space:** internal tooling that produces client-facing decks.
- **Project type:** single-screen configurator (not an app, not a site).

**The memorable thing:** *you can see what you're choosing.* Every other deck
tool makes you read a menu and hope. This one shows you the slide.

## Aesthetic Direction

- **Direction:** restrained utility, inherited from the WDB deck system.
- **Decoration level:** minimal. Typography, hairlines and whitespace do the work.
- **Mood:** the tool should look like the decks it produces. A person who has
  seen a WDB deck should recognise this screen as the same family.

## Color — the 60:30:10 rule

Straight from the `wdb-pptx` skill §2. It is an **area** rule, not a palette
list: the tier decides how much of the screen a colour may cover.

| Tier | Token | Value | Where |
|---|---|---|---|
| 60% dominant | `--wdb-card-bg`, white | `#F5F7FA`, `#FFFFFF` | page ground, card fills |
| 30% secondary | `--wdb-secondary` | `#4916E3` | step number badges |
| 10% accent | `--wdb-primary` | `#3667FF` | selection, focus ring, CTA |
| 10% second accent | `--wdb-cyan` | `#00E5D6` | the ★ recommended badge only |
| text | `--wdb-charcoal` / `--wdb-gray` | `#1A1A1A` / `#45515E` | body / secondary |
| hero gradient | `--wdb-grad-from` → `--wdb-grad-to` | `#19007F` → `#3667FF` | **exactly one surface** |

**Rules**
- `primary` never fills a large area. A full-bleed fill is the `secondary`
  tier's job, or the gradient's.
- The hero gradient appears **once per screen** — here, the left preview panel.
- Semantic colours (`#059669` success, `#E11D48` danger, `#D97706` warning)
  carry meaning only. Never decoration.
- Everything maps onto HeroUI's semantic variables in `ui/src/theme.css`
  (`--accent`, `--background`, `--surface`, `--border`…). Components inherit the
  brand; never colour a component by hand.

## Typography

- **One family:** Paperlogy, fallback Pretendard, then system.
- Hierarchy comes from **weight and size only** — never a second typeface.
- Bundled as `woff2` in `static/fonts/` (SIL OFL 1.1) so the screen matches the
  decks on any machine, offline. `local()` is listed first so an installed copy
  loads without a download.

## Layout

- **Two panes.** Left: the gradient hero with a live preview of the current
  choices. Right: the form. The left pane exists so the person sees the
  consequence of a choice while making it.
- **Sections are cards** with a numbered badge, in the `secondary` tier.
- Max one idea per section. A section that needs a scroll is too big.

## Interaction — the rule this screen exists to follow

> **Show the thing being chosen. Never describe it in a list.**

A list of names asks the person to imagine the outcome. A thumbnail shows it.
This screen decides visual outcomes, so every picker renders evidence:

| Choice | Surface | Source |
|---|---|---|
| Deck template | rendered first slide | `/api/template_preview/<id>` |
| Visual style | real slide thumbnail (18) | `/static/style_previews/<id>.svg` |
| Icon library | real glyph samples | `/api/icon-previews` |
| Image rendering | reference imagery | `/api/ai-image-comparison` |
| Canvas size | rectangle at true aspect ratio | computed from the format's `dim` |
| Colour palette | a slide painted in that palette | drawn from the candidate's `palette` |
| Typography | the title→annotation size ladder, in the chosen faces | drawn from `sizes` + `body_size` |
| Page count | length chips + a strip of page ticks | computed from the number |
| Image source | drawn sample of the kind of picture | inline SVG |
| Generated-image style | rendering × palette reference frames | `/ai-image-comparison/<kind>/<id>.jpg` |
| Narrative mode | abstract diagram of the argument's shape | inline SVG |
| Deck skeleton, per chapter | a mini slide drawn in that chapter's layout | inline SVG from `shape` |
| Chapter layout | the ten layouts storyline.md §5 assigns, each drawn | inline SVG |
| Delivery purpose | diagram of where it is read | inline SVG |
| Deck purpose | the section chain that purpose produces | inline SVG from `planner.md` frames |
| Audience, fidelity | preset chips that seed an editable sentence | `selectors.tsx` |

**Corollaries**
- **Never open on a blank box.** A free-text field gets preset chips above it;
  picking one writes a starting sentence the person then edits.
- **Draw it if it can be computed.** Aspect ratios and narrative shapes need no
  asset — an image would only be a worse copy of the real geometry.
- **Prefer the real output over an illustration of it.** A generated picture of
  "editorial style" is prettier and weaker evidence than the actual editorial
  slide the pipeline will emit. Generate art only where no real artefact exists
  (empty, waiting and finished states).
- The AI's pick carries the ★ badge in the cyan tier — one per group.

### One decision, one screen

Twelve questions stacked ran 4088px: to answer the third you had to hold that two were
scrolled above you and nine below. Each question now takes the screen alone, in the order the
rail already lists — the rail and the form read the same `stageSteps`, so they cannot disagree
about what is left. The rail stops being a checklist and becomes the map: it marks the question
in hand, and every row is a jump, so going back to the second answer costs one click rather
than paging through the ones between. Answers stay in memory while you move, and the footer
carries 이전 / 다음 with the position (3 / 12); the submit button appears only on the last
question, where it is the only thing left to do. This is one pattern for all three stages and
the single-pass form, per CLAUDE.md's hard rule.

### The preview must track the current decision

The left panel shows what is being chosen **right now**, not a fixed sample. It
reads stage-1 fields in stage 1 (the deck preview at the chosen aspect ratio,
plus the narrative-shape diagram), the skin in stage 2, and the image direction
in stage 3. A preview that only ever reads colour and typography looks
hardcoded while someone is picking a template, because nothing moves.

**Which field belongs to which stage is `PREVIEW_FIELDS` in
[`ui/src/api.ts`](ui/src/api.ts), not this paragraph.** Prose could not stop the
defect from happening, and it could not stop stage 1 being redesigned a day
before stages 2 and 3 either. The map is checked: every field a stage payload
sends must be claimed by exactly one stage, so adding a field to one screen and
forgetting the others fails `tests/preview-contract.test.mts` by name.

### The rail names what is still needed

The left panel lists this stage's steps with 필수 / 선택 and a check once
answered, so a person can see how much is left without scrolling the form.

### The preview never lies about what it is showing

A deck template is authored at one `canvas_format`. When the chosen canvas differs, the frame
takes the chosen ratio and the deck preview sits inside it whole (`object-contain`) — plus a
line saying which ratio the template was built for. Cropping to fill would hide slide content
and imply the template reflows on its own.

### The rail says what is coming, not only what is due

The left panel names all three stages and what each one owns, with the current stage marked.
A rail that lists only the current stage cannot answer "will it ask me about colour?" — the
user has to guess whether a missing control arrives later or does not exist.

### The skeleton screen obeys the design stages' rules

`outline.md` decides what the deck *says*, and CLAUDE.md's hard rule carries every
stage rule onto it. So the skeleton screen is built like the others and not like a
document editor: one gradient surface on the left carrying the golden-circle rail and
a preview that tracks the chapter in hand, and every chapter drawing its own slide
rather than naming a layout. `kpi_cards` as a word asks the reader to imagine the
page; the drawing is the page, and it costs a kilobyte because the geometry is
computable.

The screen shows and edits. It does not decide: the flow, the layer each section
belongs to, and the chain of sections were settled upstream by
`references/storyline.md`, and the deck's own checks stay with `outline.py`. What
the screen owes the person is that nothing they choose here is refused later
without warning.

### The page keeps the server alive, and never hides that it is gone

Reading and typing produce no traffic. The server cannot distinguish that from a closed tab, so
the page says it is there — a ping every 30 seconds, for as long as the page exists. Closing the
tab stops the ping, and the idle timeout goes back to doing its job. When two pings in a row go
unanswered the page states it plainly and keeps the answers already on screen: the person reopens
from chat and finds the same questions. One missed ping shows nothing — an alarm that flashes
mid-decision costs more than the blip it reports.

### A wait shows what already happened, never what is left

The stage label is one line and it does not change; within about half a minute the screen reads
as frozen even while the counter ticks. So the agent records each boundary it reaches — reading
the sources, filling a section, writing the 기획서 — and the screen lists them: a tick on the ones
that finished, a caret on the one running. Every line is a fact about the past. No count, no
total, no percentage: the rule below is not relaxed by having more to say, and the moment the
screen implies "4 of 7" it is inventing a number nothing measured. Once the list is running the
generic sentence under it drops to the one instruction that still matters.

### A wait must prove it is alive without inventing progress

Looping art alone reads as frozen within a few seconds — the viewer recognises the loop. The
waiting screen therefore pairs an indeterminate bar (something is running) with an elapsed
counter (it is *still* running) and the name of the stage being prepared. No percentage and no
fake step ticker: nothing here measures the agent's remaining work, so nothing may claim to.
The art animates the work itself — title, body, image, palette, in the order they are decided —
rather than drifting.

### Never promise what the pipeline cannot do

A deck template's Master geometry is fixed to its own `canvas_format`, and the structured route
requires that Master to be retained — `adaptive` may add a Layout, never a Master. So a deck
picked against a different canvas can contribute colour, type and rules, but not structure.
The screen says exactly that, offers the one-click canvas fix, and refuses to advance until the
user picks one of the two real options. Copy that describes a capability the pipeline lacks is a
defect, not a wording problem.

## Copy

- Section headings are **questions a person can answer**: "어떤 크기로
  만들까요?", not "캔버스 형식".
- Option descriptions say **what you get**, never how it works.
- No pipeline vocabulary in anything a person reads. Option `id`s stay English
  because they are the contract with the pipeline; labels are always Korean.
- One judgement per line.

## Motion

- Minimal-functional. Selection state changes instantly (border + 2px ring).
- No entrance animation on options — the grid must be scannable at a glance.

## Decisions Log

| Date | Decision | Rationale |
|---|---|---|
| 2026-09-03 | Every picker renders evidence, not a name | The screen chooses visual outcomes; a name asks the user to imagine one |
| 2026-09-03 | No generated art for option previews | Real thumbnails are stronger evidence than illustrations, and cost nothing |
| 2026-09-03 | Free-text fields get preset chips | A blank box is the slowest control on the screen |
| 2026-09-03 | Preview reads the current stage's fields | It only read colour and typography, so picking a template or canvas moved nothing and the panel read as hardcoded |
| 2026-09-03 | Deck preview is letterboxed, never cropped, and a ratio mismatch is stated | A deck declares one `canvas_format`; cropping it into a different frame hides part of the slide and implies a reflow that does not happen |
| 2026-09-03 | Three-stage journey listed above the rail | The rail named only the current stage's fields, so a decision arriving later (colour) was indistinguishable from one never asked |
| 2026-09-03 | Waiting screen shows elapsed time, never a percentage | The agent's work is not instrumented, so a percentage would be invented; a rising counter proves liveness truthfully |
| 2026-09-03 | Palette shown as a slide painted in it | Six swatches ask the reader to imagine the assembled page; the mini slide is the outcome itself |
| 2026-09-03 | Type plan shown as the real size ladder | One sample line proves the family but not the hierarchy, which is what the numbers actually control |
| 2026-09-03 | Image sources drawn, generated-image styles use the reference gallery | Same rule as stage 1 — a source is a kind of picture, so show one |
| 2026-09-04 | Canvas/template mismatch blocks stage 1 until resolved | The old copy promised a re-layout that the structured route cannot perform; a soft warning let a user reach a dead end only discoverable after the deck was authored |
| 2026-09-04 | Purpose cards draw the section chain they produce | A purpose is abstract; the chain is the thing actually being chosen, and its length is visible before anything is written |
| 2026-09-04 | Every skeleton chapter draws its own slide | Same rule as the design stages — a layout name asks the reader to imagine the page, and the layouts are geometry, so they cost nothing to draw |
| 2026-09-04 | The skeleton screen blocks on the faults `outline.py --check` blocks on | Canvas-mismatch precedent: a fault we can compute here and the pipeline will refuse later must be refused here, where it can still be fixed in one click |
| 2026-09-04 | Confirming stamps `confirmed_at` into the outline | It records that a person approved the spine, and the agent waits on this file *changing* — so an outline nobody edited still has to differ from the one the agent wrote, or the run hangs |
| 2026-09-04 | The chosen flow is shown, never re-picked here | Re-selecting a flow is a regeneration only `outline.py --scaffold` performs, and no route exposes it at this point; the button in the sketch would have promised what the pipeline cannot do |
| 2026-09-04 | Merging names the section that loses its own chapter | `--check` credits one section per chapter, so a merge can cost the later section its slide; saying so beats a check failing after the window closes |
| 2026-09-04 | One question per screen, the rail as the map | A 4088px scroll made every answer depend on remembering what was off-screen; paging costs one click per question and the rail's rows become jumps, so going back is cheaper than it was by scrolling |
| 2026-09-04 | The waiting screen lists the agent's own notes, ticked as they finish | A fixed stage label reads as frozen within half a minute — the counter proves the page is alive but not that the work is. Notes are a record of the past, so they add movement without implying a total the pipeline never measured |
| 2026-09-04 | The page pings the server while it is open, and says so when it stops answering | Filling in the form makes no requests, so the server's idle watchdog could not tell a reading user from a closed tab and shut down under one twice; the ping restarts its clock, and closing the tab stops the ping so the timeout still works. The banner waits for two missed pings — one blip must not flash an alarm mid-decision |
| 2026-09-05 | Which fields each stage's preview tracks lives in `api.ts`, not in this file | Two defects came from stage rules being prose — a preview reading the next stage's fields, and stage 1 redesigned a day ahead of stages 2 and 3. Both were fixed by hand and neither had a guard. A map every payload is checked against fails by field name instead |
| 2026-09-05 | 장마다 «왜 이 장인가» 를 보여준다 | 다른 도구와 갈리는 자리다. Gamma 는 «생성» 뒤에 근거를 숨겨서 발표장에서 «이 수치 어디서 나온 겁니까» 에 답을 못 한다. 기획서 어느 절, 골든서클 어느 층, 왜 이 모양인지가 전부 데이터에 이미 있어 지어낼 것이 없다. 같은 내용이 발표자 노트로도 나가야 회의실까지 따라간다 |
| 2026-09-05 | 경계선은 `--border-strong` | 기본 `--border`(#e1e6ed)는 흰 바탕에서 명암비 1.25:1 이라 WCAG 1.4.11(3:1)에 못 미친다 — 저시력 사용자에게 카드 경계가 없는 것과 같다. 색상은 그대로 두고 명도만 낮춰 흰 바탕 3.37:1 · 카드 바탕 3.14:1. 나뉘는 것이 보여야 하는 곳에만 쓰고, 장식 선은 계속 `--border` |
| 2026-09-05 | 조작 단추를 마우스오버 뒤에 숨기지 않는다 | 어제 45개를 줄이려고 숨겼는데, 마우스 쓰는 사람에게만 깔끔해지고 키보드·터치·스크린리더에서는 기능이 사라졌다. 개수는 크기와 명도로 줄인다 |
| 2026-09-05 | 확인할 곳은 색만이 아니라 점선으로도 | 색각 이상이어도 어느 장을 봐야 하는지 알아야 한다 (WCAG 1.4.1). 고른 장도 같은 이유로 굵은 테두리 + 왼쪽 세로 막대 |
| 2026-09-05 | 아무것도 안 해도 만들 수 있다 | 기본값이 이미 다 골라져 있다. 밤 11시에 내일 발표인 사람에게 서른 번 물으면 전부 «이대로» 를 누르고, 그러면 8.9점이 아니라 «확인 안 한 8.9점» 이 나간다. 대신 확인할 곳이 몇 군데인지는 늘 말한다 |
| 2026-09-05 | 뼈대 화면의 장은 줄이 아니라 스토리보드 컷 | 화면이 묻는 것은 "이 순서로 이야기할까요" 다. 순서를 판단하려면 여러 장이 한눈에 들어와야 하는데, 줄로 늘어놓으면 한 번에 대여섯 장뿐이고 15개가 서로 구별되지도 않았다. 격자로 놓으니 컷이 카드 너비만큼 커져 `art.tsx` 가 이미 그리고 있던 레이아웃 14종이 실제로 보인다 — 104px 로 줄여 쓰느라 버리던 것이다 |
| 2026-09-05 | 왼쪽 판은 목차가 아니라 지금 손대는 장 | 같은 15장이 왼쪽과 오른쪽에 두 번 있었고, 왼쪽 사본은 그림도 조작도 없어 덜 쓸모 있는 쪽이 265px 를 차지했다. 목록을 걷어내고 그 자리를 고른 장 하나에 준다 — 큰 그림과 편집 칸 |
| 2026-09-05 | 그라데이션은 판 전체가 아니라 머리띠 | 판을 덮는 장식 그라데이션은 정보를 나르지 않으면서 그 위 글자를 읽기 어렵게 한다. 브랜드는 얇은 띠로 충분하고, 편집 칸은 밝은 바탕에서 읽힌다. (색 자체는 위드로우비즈니스 로고 색이므로 그대로) |
| 2026-09-05 | 모양은 그림이 말하고, 글자는 이름만 말한다 | `본문 · 글 위주 · 현상` 은 역할·모양·절 이름이라는 서로 다른 세 층위를 라벨 없이 붙여 둔 것이었다. 모양은 컷이 이미 보여주고, 역할은 표지·1안·2안일 때만 적는다. 절 이름이 제목과 같은 말이면 두 번 쓰지 않는다 |
| 2026-09-05 | 장을 옮기고 지우는 단추는 손대는 장에만 | 15장 × 3개 = 45개가 늘 떠 있으면 눈이 갈 곳이 45군데가 된다. 가리키거나 고른 장에서만 나타난다 |
| 2026-09-03 | Step rail added to the left panel | Required steps were invisible until you scrolled the whole form |
| 2026-09-03 | Hero gradient limited to one surface | wdb-pptx §2 — a full-bleed fill is not the 10% tier's job |
| 2026-09-03 | WDB tokens mapped onto HeroUI CSS variables | Brand propagates once; no per-component colour work |
| 2026-09-03 | ~~Waiting/finished art drawn as SVG, not generated~~ | **Reversed 2026-09-05.** The drawn version was stacked `<rect>`s, and it read as a wireframe left in place rather than as artwork — the exact tell the deck is meant to avoid |
| 2026-09-05 | 상태 그림 셋(여는 중 · 못 읽음 · 다 됐어요)은 생성한 그림 | 사각형을 쌓아 만든 그림은 "아직 안 그린 자리" 로 보였다. 한 세트로 뽑아 붙인다 — 같은 장 더미, 같은 선 굵기, 같은 정면 시점. 첫 판이 입체로 나와 세트가 깨지자 잘 나온 한 장을 기준 이미지로 물려 다시 뽑았다 |
| 2026-09-05 | 장표 모양 29개와 이야기 구조 아이콘은 계속 도형 | 그건 장식이 아니라 "글이 어디 앉고 사진이 어디 앉는지" 를 알려주는 설계도다. 사진으로 바꾸면 무엇을 고르는지가 오히려 안 보인다 |
| 2026-09-05 | "여기 사진" 자리는 빗금 대신 자리표시용 사진 한 장 | 빗금은 "뭔가 온다" 까지만 말한다. 사진을 자리마다 다르게 잘라 넣으니 전면·옆에·겹침이 한눈에 갈린다 |
| 2026-09-05 | 색 있는 바탕에서 투명도로 위계를 주지 않는다 | 밝은 쪽 파랑(#3667FF) 위에서 흰 글씨는 4.62:1 로 겨우 통과한다. 조금만 흐리면 전부 미달이라, 위계는 크기와 굵기로만 준다 — 글꼴 규칙과 같은 말이다 |
| 2026-09-05 | 지금 있는 줄은 밝히지 말고 어둡게 표시 | 흰빛으로 밝히면 그 위 흰 글씨를 잡아먹어 3.56:1 이 됐다. 어둡게 누르면 7.6:1 |
| 2026-09-05 | `--warning` #d97706 → #b45309 | 12px 에서 3.19:1 이라 "확인 필요" 가 안 읽혔다. 새 값은 5.02:1 |
| 2026-09-05 | 누르는 줄은 무엇이든 24px 이상 | 체크상자 13px · 라디오 20px · 스위치 20px 이었다. 손이 떨리면 옆 항목이 눌린다 |
| 2026-09-05 | 화면 점수는 눈이 아니라 [`tests/screen_audit.js`](tests/screen_audit.js) 가 잰다 | 대비를 눈으로 보고 "3.1:1 쯤" 이라 했다가 실제 2.52:1 이었던 적이 있다. 네 항목은 대표가 말한 순서 그대로 — AI 슬롭 · 가독성 · 명확한 비주얼라이징 · 접근성 — 이고 AI 슬롭은 CLAUDE.md 의 금지 낱말표를 그대로 쓴다 |
| 2026-09-05 | **고르는 카드는 한 종류** — `cardStyle` 을 `pickStyle` 로 합침 | 두 가지가 굴러다녔다(옛것 10곳, 새것 3곳). 같은 앱에서 어떤 카드는 그림자가 있고 어떤 카드는 없었다. 이름은 남기고 한 곳을 보게 한다 — 부르는 자리를 다 고치는 것보다 안전하고 다음에 또 갈라지지 않는다 |
| 2026-09-05 | 파란 패널용으로 만든 부품은 흰 화면에서 다시 짠다 | `AnchorPreview` 가 `rgba(255,255,255,0.08)` 배경에 `bg-white/95` 카드였다 — 파란 패널 위에서는 맞았지만 흰 화면으로 옮기니 **둘 다 배경과 같은 색이 되어 틀이 통째로 사라졌다.** 글자가 허공에 뜨고 크기 표기가 왼쪽 아래에 굴러다녔다. 골격을 바꿀 때 부품도 같이 봐야 한다는 뜻 |
| 2026-09-05 | 크기 고르기도 카드 언어로 | 150px 좁은 칸에 회색 네모 조각이었다. 같은 앱에서 "장 하나" 를 보여주는 방식은 하나여야 한다 — 카드가 넓게 서고 그 안에 실제 비율이 크게 들어간다 |
| 2026-09-05 | **디자인 단계 미리보기는 확정한 뼈대 그대로** | 뼈대 화면에서 장마다 모양과 사진 자리를 골라 넘어오면, 디자인 화면은 그것과 상관없는 견본 한 장만 보여줬다. **같은 덱을 두 화면이 서로 다른 그림으로** 말하고 있었으니 "이 색을 고르면 내 장이 어떻게 되나" 를 볼 방법이 없었다. `SlideArt` 가 CSS 변수 다섯 개로 그려지므로, 고른 팔레트를 그 변수에 꽂으면 **같은 그림이 새 색으로 다시 그려진다** — 미리보기를 따로 만들 필요가 없다 |
| 2026-09-05 | **디자인 단계 질문 11개 → 4개** | 디자이너는 문항에 답하지 않는다. 틀을 잡고 · 룩을 고르고 · 이미지를 정하고 · 마무리한다. 색·아이콘·글꼴을 따로 묻는 것은 "어떻게 보이게 할까" 하나를 셋으로 쪼갠 것이고, 셋을 따로 고르면 **합쳐 놓았을 때 어떤지는 아무도 안 본다**. 이제 한 화면에서 고르고 그 아래 합쳐진 모습이 바로 보인다 |
| 2026-09-05 | 앞에서 답한 것은 다시 묻지 않는다 — 쪽수·대상 | 쪽수는 뼈대가, 대상은 인터뷰가 이미 정했다. 다시 물으면 답이 갈리고, 갈리면 확정한 것과 어긋난다 (실제로 쪽수가 7 ↔ 8-10 으로 갈렸다) |
| 2026-09-05 | 크기는 발표자료가 쓰는 셋만 — 16:9 · 4:3 · A4 | 인스타·위챗·샤오홍슈·모먼츠·스토리·배너는 카드뉴스 형식이라 이 화면과 상관이 없다. 고를 수 없는 것을 늘어놓으면 고르는 사람이 헤맨다 |
| 2026-09-05 | 글씨 크기는 **pt** 로 부르고, 기본값에서 고친다 | 파워포인트는 pt 로 센다 — "본문 24px" 는 아무도 크기를 못 짐작하지만 "18pt" 는 바로 안다 (화면 px = pt × 0.75, 1280×720 = 13.333×7.5인치 96dpi). 네 숫자를 매번 정하게 하던 것을 **작게 16 / 기본 18 / 크게 20** 세 장으로 바꾸고, 층별 조정은 접이식으로 내렸다 |
| 2026-09-05 | 색은 후보 셋 + 직접 고르기 | 후보 안에서만 고르게 하면 그건 고른 것이 아니다. 여섯 자리를 다 바꿔도 되고 강조색 하나만 바꿔도 된다고 화면이 말한다 |
| 2026-09-05 | **글자 위계는 원티드 디자인 시스템 값을 그대로** | 화면 글자 138곳 중 129곳이 10~15px 안에 몰려 있었다. 크기 차이가 5px 안이면 위계가 아니라 그냥 다 작은 글씨다. 처음엔 값을 짐작해서 넣었는데 실제 값과 **세 군데 달랐고 셋 다 "얇고 작아 보이는" 원인**이었다 — ①본문 굵기는 400이 아니라 **500**(한글은 400에서 얇아 보인다) ②제목은 800이 아니라 700(title)/600(heading·headline) ③자간은 큰 글자만 음수, **작은 글자는 양수**로 벌린다(반대로 하고 있었다). 출처: Wanted Design System handoff `colors_and_type.css` |
| 2026-09-05 | 층 이름과 자리 이름을 둘 다 둔다 | `t-title1`·`t-body1` 같은 원티드 층 이름을 그대로 두고, 이 화면이 쓰는 자리 이름(`t-page`·`t-card`·`t-body`·`t-sub`·`t-label`)을 그 위에 얹는다. 부르는 쪽에는 **어디에 쓰는지**가 남고, 나중에 층을 바꿔도 부르는 쪽은 안 건드린다 |
| 2026-09-05 | 뼈대에서 정한 것은 디자인 단계가 다시 묻지 않는다 | 7장짜리 스토리보드를 방금 확정한 사람에게 "몇 장으로 만들까요" 를 또 물었고, 답이 `8-10` 으로 들어와 확정한 뼈대와 어긋났다. 질문 12개 → 11개. 확정된 뼈대는 화면이 새로 열려도 들고 있는다 — 안 들고 있으면 장 수를 알 길이 없어 다시 묻게 된다 |
| 2026-09-05 | 후보 블록은 배열과 고정 한 벌을 둘 다 읽는다 | 계약(Step 4)은 하드락 필드를 "후보 셋 대신 고정 한 벌" 로 쓰게 하는데, 읽는 쪽이 `candidates[]` 만 봐서 **필수 항목인 글꼴이 조용히 null 로 확정까지 갔다.** `page_count: 6` 도 `{value}` 만 읽는 쪽을 만나 빈 칸이 됐다. 계약이 허용하는 모양은 읽는 쪽도 받는다 |
| 2026-09-05 | **전 화면 하나의 골격** — 위 얇은 띠 + 가운데 한 줄 + 아래 고정 버튼 | 화면마다 골격이 달랐다. 인터뷰는 가운데 860px, 뼈대는 왼쪽 흰 패널 420px 2열, 디자인 확인은 왼쪽 파란 그러데이션 38% 2열. 같은 서비스인데 넘길 때마다 다른 물건처럼 보였고, **한 화면만 새로 그려서는 고쳐지지 않는 문제**였다. [`shell.tsx`](ui/src/shell.tsx) 하나가 셋 다 맡는다 |
| 2026-09-05 | 왼쪽 파란 그러데이션 패널을 없앰 | 취향이 아니라 계산이다. 그 파랑 위에서 흰 글씨가 4.62:1 이라 위계를 주려고 흐리게 한 것이 전부 미달이 됐다. 흰 바탕으로 오면 그 제약이 통째로 사라진다. 로고 색은 버튼·강조·진행 막대에 그대로 남는다 |
| 2026-09-05 | 패널에 있던 미리보기 셋은 각자 자기 질문 아래로 | 크기·색과 글꼴·이미지 방향 미리보기는 버리면 안 되는 것이었다 — 특히 **크기 안 맞음 경고는 확정을 막는 장치**라 없애면 게이트가 사라진다. 고른 것이 어떻게 되는지는 화면 옆이 아니라 고르는 자리에서 보여준다 |
| 2026-09-05 | 뼈대 편집 칸은 늘 붙어 있지 않고 고른 장만 여는 오른쪽 서랍 | 왼쪽 420px 를 편집 칸이 늘 차지해, 정작 고를 것을 보여주는 자리가 좁았다 |
| 2026-09-05 | 상태 그림을 납작한 벡터에서 **말랑한 입체**로 다시 뽑음 | 굵은 검정 테두리와 채도 높은 청록은 90년대 클립아트 문법이었다. 부드러운 무광 3D · 연한 페리윙클과 라벤더 · 테두리 없음 · 옅은 그림자. 열두 장을 한 세트로, 잘 나온 한 장을 기준 이미지로 물려서 |
| 2026-09-05 | 글만 있던 질문 둘을 그림 카드로 | "한 번에/나눠서" 와 "계획서 먼저" 가 라디오와 스위치라 갈래가 어떻게 다른지 읽어야 알았다. 이 화면의 약속("고르는 것은 그려서 보여준다")을 정작 이 화면이 어기고 있었다 |
| 2026-09-05 | `--faint` #8a929e → #68717e | 토스가 쓰는 옅은 회색은 흰 바탕 3.14:1 이라 "+ 장 추가" 가 실제로 안 읽혔다. 새 값은 4.94:1 |
| 2026-09-05 | 빈 곳 판정을 "위쪽 여백" 에서 **무게중심**으로 | 화면마다 맨 위에 띠가 생기자 위쪽 여백이 늘 0 이 되어 가운데 정렬 판정이 죽었다. 내용 넓이를 세로 위치로 가중한 무게중심이 35~65%면 균형 잡힌 화면이다 |
