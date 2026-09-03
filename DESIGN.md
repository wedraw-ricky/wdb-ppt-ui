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
| Delivery purpose | diagram of where it is read | inline SVG |
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

### The preview must track the current decision

The left panel shows what is being chosen **right now**, not a fixed sample. It
reads stage-1 fields in stage 1 (the deck preview at the chosen aspect ratio,
plus the narrative-shape diagram), the skin in stage 2, and the image direction
in stage 3. A preview that only ever reads colour and typography looks
hardcoded while someone is picking a template, because nothing moves.

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

### A wait must prove it is alive without inventing progress

Looping art alone reads as frozen within a few seconds — the viewer recognises the loop. The
waiting screen therefore pairs an indeterminate bar (something is running) with an elapsed
counter (it is *still* running) and the name of the stage being prepared. No percentage and no
fake step ticker: nothing here measures the agent's remaining work, so nothing may claim to.
The art animates the work itself — title, body, image, palette, in the order they are decided —
rather than drifting.

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
| 2026-09-03 | Step rail added to the left panel | Required steps were invisible until you scrolled the whole form |
| 2026-09-03 | Hero gradient limited to one surface | wdb-pptx §2 — a full-bleed fill is not the 10% tier's job |
| 2026-09-03 | WDB tokens mapped onto HeroUI CSS variables | Brand propagates once; no per-component colour work |
| 2026-09-03 | Waiting/finished art drawn as SVG, not generated | Two generation attempts came back isometric with shadows against the flat rule; the shapes are computable, so drawing them inherits the tokens and costs a kilobyte |
