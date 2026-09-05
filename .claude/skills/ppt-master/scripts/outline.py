#!/usr/bin/env python3
"""
PPT Master - Outline Builder and Section IX Generator

Turns a completed `plan_spec.md` into `outline.md` — one row per slide carrying
layer, title, screen text, script, layout and provenance — then generates
`design_spec.md` §IX from it.

`outline.md` is the authored artifact the user edits. §IX is derived output: the
outline the user reordered is what reaches the deck. Editing §IX by hand breaks
that direction and is caught by `--check`.

Commands:
    --propose   print two flow candidates for the frame (planner picks one)
    --scaffold  write outline.md rows from plan_spec.md under the chosen flow
    --render    replace design_spec.md §IX from outline.md
    --check     verify outline.md against storyline.md rules and §IX parity

Checks (see references/storyline.md):
    - E-OPEN   slide 2 is not in the `why` layer
    - E-ALT    frame needs proposal_alt and has none, or forbids it and has one
    - E-IR     `ir` deck has no financial-scenario slide
    - E-SHAPE  a `shape` value is absent from charts_index.json
    - E-IMAGE  an `image` value is not one of IMAGE_USES
    - W-SAME   (warning) three or more slides in a row share one layout
    - E-COVER  a `확정` plan_spec section reaches no slide
    - E-END    the deck misses the conclusion, or concludes with a figure
               the document does not state
    - E-SYNC   outline row count or numbering disagrees with §IX

Usage:
    python3 scripts/outline.py <project_path> --propose
    python3 scripts/outline.py <project_path> --scaffold --flow problem-first
    python3 scripts/outline.py <project_path> --render
    python3 scripts/outline.py <project_path> --check

Dependencies:
    None (only uses standard library)

See references/storyline.md for the authored contract these checks enforce.
"""
from __future__ import annotations

import argparse
import json
import re
import sys

from plan_spec import check_copy, check_screen_numerals
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Optional

sys.path.insert(0, str(Path(__file__).resolve().parent))

from console_encoding import configure_utf8_stdio  # noqa: E402
from plan_spec import FRAMES, Frame, parse as parse_plan_spec  # noqa: E402


CHARTS_INDEX = Path(__file__).resolve().parent.parent / "templates" / "charts" / "charts_index.json"

FLOWS: dict[str, str] = {
    "background-first": "배경 → 현황 → 분석 → 제안 → 기대효과",
    "problem-first": "문제 → 원인 → 해결방안 → 기대효과",
    "goal-first": "현황 → 목표 → 전략 → 실행계획 → 성과지표",
    "case-first": "도입 → 사례 → 분석 → 시사점 → 결론",
    "why-what-how": "Why → What → How → 결과",
}

FLOW_DEFAULTS: dict[str, tuple[str, str]] = {
    "problem": ("problem-first", "background-first"),
    "hypothesis": ("why-what-how", "case-first"),
    "report": ("goal-first", "background-first"),
    "intro": ("why-what-how", "case-first"),
    "teach": ("case-first", "why-what-how"),
    "ir": ("problem-first", "why-what-how"),
}

# Section → golden-circle layer, per storyline.md §1.
LAYERS: dict[str, dict[str, str]] = {
    "problem": {"현상": "why", "영향": "why", "원인": "how", "배경": "how",
                "목표": "how", "목적 검증": "how", "기대효과": "what", "과제": "what",
                "컨셉": "what", "해결책": "what", "실행 계획": "what",
                "리스크 대책": "what"},
    "hypothesis": {"가설": "why", "착안 근거": "why", "기회 크기": "how",
                   "검증 방법": "how", "예상 결과": "what", "리스크": "what",
                   "다음 단계": "what", "실행 계획": "what"},
    "report": {"하기로 한 것": "why", "한 것": "how", "결과": "how",
               "결과 해석": "how", "한계": "what", "다음": "what",
               "실행 계획": "what", "리스크 대책": "what"},
    "intro": {"왜 존재하나": "why", "무엇인가": "how", "무엇이 다른가": "how",
              "근거·사례": "what", "다음 행동": "what"},
    "teach": {"학습 목표": "why", "왜 필요한가": "why", "개념": "how",
              "예시": "how", "실습·적용": "what", "정리": "what"},
    "ir": {"문제": "why", "해결책": "how", "시장 크기": "how", "제품": "how",
           "수익 모델": "how", "트랙션": "how", "경쟁": "how", "팀": "how",
           "재무": "what", "요청": "what"},
}

# 그림을 어떻게 쓰는 장인가. 차트 모양(`shape`)과는 다른 축이다 — 모양은 자료를
# 어떤 그림으로 보여줄지이고, 이쪽은 사진이 지면을 어떻게 차지하는지다. 그래서
# `charts_index.json` 과 대조하는 E-SHAPE 에 걸리지 않게 따로 둔다.
#
# 이름은 design_spec_reference.md 의 Layout Pattern Library 에서 가져왔다.
IMAGE_USES: dict[str, str] = {
    "none": "안 씀",
    # Full-bleed + floating text. 사진이 지면을 꽉 채우고 글이 그 위에 뜬다.
    # 글이 읽히도록 사진 위에 어두운 막(scrim)을 깐다 — strategist.md §h.
    # 강조·전환 장이 이 모양이다.
    "full": "전면 — 사진을 꽉 채우고 글을 위에",
    # Asymmetric split (3:7 / 2:8). 사진과 설명이 나란히.
    "side": "옆에 — 사진과 설명을 나란히",
    # Figure-text overlap. 제목이나 큰 숫자가 사진 가장자리에 걸친다.
    "overlap": "겹침 — 제목이 사진 가장자리에 걸침",
}


# 본문에서 읽어낼 수 있는 신호 → 그 신호가 가리키는 장 모양.
#
# 오래 이 목록이 세 줄이었고, 그래서 자동 배정이 쓰는 모양이 일곱뿐이었다.
# 카탈로그에 일흔여섯이 있는데 일곱만 쓰니 만들어진 덱이 다 비슷해 보였다.
# 넓히되, 확실한 낱말만 쓴다 — 애매한 신호로 배정하면 엉뚱한 모양이 나오고,
# 그건 아무 모양도 안 고른 것보다 나쁘다.
SHAPE_SIGNALS: tuple[tuple[str, str], ...] = (
    (r"목차|차례|오늘 다룰|순서는 이렇|들어갈 내용", "agenda_list"),
    (r"장점.{0,30}단점|단점.{0,30}장점|찬성.{0,20}반대|좋은 점.{0,30}걸리는",
     "pros_cons_chart"),
    (r"계층|레이어|층으로 나눠|상위\s*·?\s*하위|아키텍처", "layered_architecture"),
    (r"핵심.{0,10}중심으로|둘러싼|생태계|플랫폼 구조", "hub_spoke"),
    (r"겹치는|공통.{0,10}부분|교집합", "venn_diagram"),
    (r"(?:①|1단계|먼저|첫째).*(?:②|2단계|다음|둘째)", "numbered_steps"),
    (r"(?:→|vs\.?|대비|전후|전 ?→ ?후|보다|에서\s*\S+\s*(?:으로|로)\s*(?:올|내|늘|줄|상승|하락))",
     "comparison_columns"),
    (r"\d{4}년.*\d{4}년|\d+분기.*\d+분기", "grouped_bar_chart"),
)

# `%p` is the same measure as `%`, and 만원/억원/천원 are all money. A row of
# KPI cards earns its place by showing different *kinds* of measure; three
# counts in the same unit (428건 / 371건 / 57건) is a list or a table.
_UNIT_FAMILY = {
    "%p": "%", "만원": "원", "억원": "원", "천원": "원", "억": "원",
}


@dataclass
class Slide:
    """One outline row."""

    n: int
    layer: str
    role: str
    title: str
    screen: str = ""
    script: str = ""
    shape: str = "body"
    source: str = ""
    image: str = "none"
    edited: bool = False


def load_shapes() -> set[str]:
    data = json.loads(CHARTS_INDEX.read_text(encoding="utf-8"))
    return set(data["charts"]) | {"body", "cover"}


def figure_units(body: str) -> list[str]:
    """The unit of every figure in the body, collapsed into measure families.

    Longest unit first: `%p` before `%`, `만원` before `원`. Korean reports
    state money in compounds, and 3200만원 counted as no figure at all left a
    수치 나열 slide reading as plain prose.
    """
    units = re.findall(
        r"\d[\d,.]*\s*(%p|%|만원|억원|천원|억|점|건|명|원|일|배|개월|개소|회|시간)",
        body)
    return [_UNIT_FAMILY.get(u, u) for u in units]


_FIGURE_RE = re.compile(
    r"\d[\d,.]*\s*(?:%p|%|만원|억원|천원|억|점|건|명|원|일|배|개월|개소|회|시간)")


def figures(text: str) -> set[str]:
    """The figures a statement actually makes, spacing removed for comparison."""
    return {m.group(0).replace(" ", "") for m in _FIGURE_RE.finditer(text)}


def bullet_lines(body: str) -> list[str]:
    """The body's listed items — how many things it is putting side by side."""
    return re.findall(r"^\s*[-*·◦▢]\s+\S", body, re.M)


def pick_shape(body: str) -> str:
    """Choose a layout from the content's shape. See storyline.md §5.

    Specific signals are tested before the figure count. A body carrying both
    ordered steps and three figures is a sequence that happens to be measured,
    not a metrics board — reading the count first sent five straight slides of
    one report to the same KPI grid.
    """
    # 표는 줄을 세어야 안다. 칸 안에 수치가 있으면 표만 그리는 것보다
    # 칸 옆에 작은 막대를 함께 그리는 쪽이 읽힌다 (consulting_table).
    table_rows = [l for l in body.splitlines()
                  if l.count("|") >= 2 and not re.fullmatch(r"[\s|:-]+", l)]
    if len(table_rows) >= 3:
        return "consulting_table" if len(figure_units(body)) >= 3 else "basic_table"

    # 달성률이 여럿이면 목록보다 막대가 낫다.
    if len(re.findall(r"\d{1,3}\s*%", body)) >= 3:
        return "progress_bar_chart"

    for pattern, shape in SHAPE_SIGNALS:
        if not re.search(pattern, body, re.S):
            continue
        # 전후 비교는 항목 수가 모양을 가른다. `comparison_columns` 는 가격제
        # 카드 2~4개를 위한 마케팅 레이아웃이라, 항목이 다섯을 넘으면 그 안에서
        # 눌린다. 카탈로그가 그 자리에 두라고 말하는 것이 dumbbell 이다.
        if shape == "comparison_columns" and len(bullet_lines(body)) >= 5:
            return "dumbbell_chart"
        return shape
    units = figure_units(body)
    # §5 says "three or more figures, mixed units" — both halves matter.
    if len(units) >= 3 and len(set(units)) >= 2:
        return "kpi_cards"
    bullets = bullet_lines(body)
    if 3 <= len(bullets) <= 6:
        return "vertical_list"
    return "body"


def propose_flows(frame: Frame) -> list[tuple[str, str]]:
    first, second = FLOW_DEFAULTS[frame.key]
    return [(first, FLOWS[first]), (second, FLOWS[second])]


def build_slides(frame: Frame, sections: list, flow: str) -> list[Slide]:
    """Lay the frame's filled sections onto the golden-circle spine."""
    layer_of = LAYERS[frame.key]
    slides: list[Slide] = [
        Slide(n=1, layer="why", role="cover", title="", shape="cover")
    ]
    filled = [s for s in sections if s.body and s.status != "확인 필요"]
    for sec in filled:
        slides.append(
            Slide(
                n=len(slides) + 1,
                layer=layer_of.get(sec.name, "how"),
                role="body",
                # The 소제목 the author wrote, not the frame's own chain name —
                # a slide titled "하기로 한 것" shows the audience our plumbing.
                # `source` keeps the chain name: coverage is checked against it.
                title=sec.heading or sec.name,
                screen="",
                script="",
                shape=pick_shape(sec.body),
                source=f"plan_spec.md#{sec.name}",
            )
        )

    if frame.options == "on":
        for role, label in (("proposal_primary", "1안 — 권고"),
                            ("proposal_alt", "2안 — 대안")):
            slides.append(Slide(n=len(slides) + 1, layer="what", role=role,
                                title=label, shape="comparison_columns",
                                source=f"plan_spec.md#{frame.action}"))
    elif frame.options == "scenario":
        slides.append(Slide(n=len(slides) + 1, layer="what", role="proposal_primary",
                            title="재무 시나리오 — 보수 · 기본 · 공격",
                            shape="grouped_bar_chart", source="plan_spec.md#재무"))
    return slides


def dump(frame: Frame, flow: str, slides: list[Slide]) -> str:
    head = (
        "---\n"
        f"frame: {frame.key}\n"
        f"flow: {flow}\n"
        f"slide_count: {len(slides)}\n"
        f"generated_at: {datetime.now().isoformat(timespec='seconds')}\n"
        "---\n\n"
    )
    rows = []
    for s in slides:
        rows.append(
            f"- n: {s.n}\n"
            f"  layer: {s.layer}\n"
            f"  role: {s.role}\n"
            f'  title: "{s.title}"\n'
            f'  screen: "{s.screen}"\n'
            f'  script: "{s.script}"\n'
            f"  shape: {s.shape}\n"
            f'  source: "{s.source}"\n'
            f"  image: {s.image}\n"
            f"  edited: {str(s.edited).lower()}"
        )
    return head + "\n\n".join(rows) + "\n"


def load(path: Path) -> tuple[dict, list[Slide]]:
    text = path.read_text(encoding="utf-8")
    meta: dict = {}
    body = text
    if text.startswith("---"):
        _, front, body = text.split("---", 2)
        for line in front.splitlines():
            if ":" in line:
                k, _, v = line.partition(":")
                meta[k.strip()] = v.strip()

    slides: list[Slide] = []
    for block in re.split(r"^- n:\s*", body, flags=re.M)[1:]:
        get = lambda k, d="": (  # noqa: E731
            m.group(1).strip().strip('"')
            if (m := re.search(rf"^\s*{k}:\s*(.*)$", block, re.M)) else d
        )
        slides.append(
            Slide(
                n=int(block.split("\n", 1)[0].strip()),
                layer=get("layer", "how"), role=get("role", "body"),
                title=get("title"), screen=get("screen"), script=get("script"),
                shape=get("shape", "body"), source=get("source"),
                image=get("image", "none"),
                edited=get("edited", "false") == "true",
            )
        )
    return meta, slides


def render_ix(slides: list[Slide]) -> str:
    """Build the §IX block from the outline."""
    out = ["## IX. Content Outline", ""]
    for s in slides:
        out.append(f"#### Slide {s.n:02d} - {s.title or '제목 미정'}")
        out.append("")
        out.append(f"- **Layer**: {s.layer} / {s.role}")
        if s.role == "cover":
            out.append("- **Cover impact**: (표지 훅)")
        else:
            out.append("- **Core message**: (한 문장 주장)")
        out.append(f"- **Visualization**: {s.shape}")
        if s.screen:
            out.append(f"- **Content**: {s.screen}")
        if s.script:
            out.append(f"- **Script**: {s.script}")
        if s.source:
            out.append(f"- **Source**: {s.source}")
        if s.image != "none":
            out.append(f"- **Image use**: {s.image} — {IMAGE_USES[s.image]}")
        out.append("")
    return "\n".join(out)


def shape_runs(slides: list) -> list[str]:
    """Warn where the same layout runs three slides deep.

    Not an error and never auto-corrected: the layout follows the content, and
    a report whose middle really is three comparisons in a row is telling the
    truth. But three identical pages read as a template that stopped thinking,
    and the person is one click from changing it on the skeleton screen — so
    say it there rather than deciding for them.
    """
    warnings: list[str] = []
    run_start = 0
    body = [s for s in slides if s.role != "cover"]
    for i in range(1, len(body) + 1):
        same = i < len(body) and body[i].shape == body[run_start].shape
        if same:
            continue
        length = i - run_start
        if length >= 3:
            warnings.append(
                f"W-SAME slides {body[run_start].n}–{body[i - 1].n} all use "
                f"'{body[run_start].shape}' — {length} pages of one layout. "
                f"Change any of them on the skeleton screen if the content differs"
            )
        run_start = i
    return warnings


def run_check(project: Path) -> list[str]:
    outline_path = project / "outline.md"
    if not outline_path.is_file():
        return [f"outline.md not found at {outline_path}"]

    meta, slides = load(outline_path)
    frame = FRAMES.get(meta.get("frame", ""))
    if frame is None:
        return [f"unknown frame {meta.get('frame')!r} in outline.md frontmatter"]

    errs: list[str] = []
    if len(slides) >= 2 and slides[1].layer != "why":
        errs.append("E-OPEN slide 2 must sit in the why layer — a deck opens on Why")

    roles = {s.role for s in slides}
    if frame.options == "on" and "proposal_alt" not in roles:
        errs.append(f"E-ALT frame '{frame.key}' requires a proposal_alt slide")
    if frame.options in {"off", "scenario"} and "proposal_alt" in roles:
        errs.append(f"E-ALT frame '{frame.key}' forbids a proposal_alt slide")
    if frame.options == "scenario" and not any(
        "시나리오" in s.title for s in slides
    ):
        errs.append("E-IR ir deck needs a financial-scenario slide")

    for s in slides:
        if s.image not in IMAGE_USES:
            errs.append(f"E-IMAGE slide {s.n} uses image placement "
                        f"'{s.image}' — one of {', '.join(IMAGE_USES)}")

    # 화면에 나가는 글은 숫자, 발표자 노트는 한글 (planner.md §2.7). 규칙이 한
    # 곳에만 있으면 두 파일이 갈라지므로 plan_spec 의 것을 그대로 부른다 —
    # 같은 것을 두 곳에 손으로 적으면 언젠가 어긋난다.
    # 장 제목도 카피다 — 목차 라벨을 적어두면 그 장은 안 읽힌다 (planner.md §2.6).
    # 발표자 노트(script)는 말하는 글이라 대상이 아니다.
    for s in slides:
        errs += check_copy(s.title, f"slide {s.n} 제목", max_len=25)
        errs += check_screen_numerals(s.screen, f"slide {s.n} 화면 문구")

    known = load_shapes()
    for s in slides:
        if s.shape not in known:
            errs.append(f"E-SHAPE slide {s.n} uses shape '{s.shape}' "
                        f"absent from charts_index.json")

    spec_path = project / "plan_spec.md"
    if spec_path.is_file():
        _, sections = parse_plan_spec(spec_path.read_text(encoding="utf-8"))
        covered = {s.source.split("#")[-1] for s in slides if s.source}
        for sec in sections:
            if sec.status == "확정" and sec.body and sec.name not in covered:
                errs.append(f"E-COVER section '{sec.name}' is 확정 but reaches no slide")

        # 결론은 하나여야 한다. The flow may reorder everything else — a deck
        # argues in whatever order the room needs — but the deck and the
        # document have to land on the same conclusion. Two ways that breaks:
        # the deck never reaching the conclusion section, and a conclusion
        # slide stating a figure the document never states. The 2안 slide is
        # exempt: an alternative method carries its own numbers by design.
        if frame.action not in covered:
            errs.append(
                f"E-END the deck never reaches '{frame.action}' — "
                f"that is where the document concludes"
            )
        concluding = next((s for s in sections if s.name == frame.action), None)
        if concluding is not None and concluding.body:
            stated = figures(concluding.body)
            for sl in slides:
                if sl.role == "proposal_alt":
                    continue
                if sl.source.split("#")[-1] != frame.action:
                    continue
                stray = figures(f"{sl.title} {sl.script}") - stated
                if stray:
                    errs.append(
                        f"E-END slide {sl.n} concludes with "
                        f"{', '.join(sorted(stray))}, which '{frame.action}' "
                        f"does not state — the deck and the document must "
                        f"reach the same conclusion"
                    )

    design_path = project / "design_spec.md"
    if design_path.is_file():
        text = design_path.read_text(encoding="utf-8")
        nums = [int(n) for n in re.findall(r"^#### Slide (\d+)", text, re.M)]
        if not nums and slides and re.search(r"^## IX", text, re.M):
            # §IX 가 있는데 장이 하나도 없다 — 가장 큰 불일치인데, 개수를 비교하기
            # 전에 빠져나가면 가장 조용히 지나간다. §IX 가 아직 생성되지 않은
            # 경우와 구분하기 위해 머리글 유무로 판단한다.
            errs.append(f"E-SYNC design_spec §IX carries no slides but "
                        f"outline.md has {len(slides)}")
        if nums:
            want = [s.n for s in slides]
            if nums != want:
                errs.append(f"E-SYNC design_spec §IX has slides {nums} "
                            f"but outline.md has {want}")
    return errs


def main(argv: Optional[list[str]] = None) -> int:
    configure_utf8_stdio()
    args = build_parser().parse_args(argv)
    project = Path(args.project_path).resolve()
    if not project.is_dir():
        print(f"[outline] project not found: {project}", file=sys.stderr)
        return 1

    spec_path = project / "plan_spec.md"

    if args.propose or args.scaffold:
        if not spec_path.is_file():
            print(f"[outline] plan_spec.md not found at {spec_path}", file=sys.stderr)
            return 1
        meta, sections = parse_plan_spec(spec_path.read_text(encoding="utf-8"))
        frame = FRAMES.get(meta.get("frame", ""))
        if frame is None:
            print(f"[outline] unknown frame {meta.get('frame')!r}", file=sys.stderr)
            return 1

    if args.propose:
        print(f"[outline] frame={frame.key} ({frame.label})", file=sys.stderr)
        for i, (key, shape) in enumerate(propose_flows(frame), 1):
            print(f"{i}안  {key}\n     {shape}")
        return 0

    if args.scaffold:
        flow = args.flow or propose_flows(frame)[0][0]
        if flow not in FLOWS:
            print(f"[outline] unknown flow {flow!r} — one of: {', '.join(FLOWS)}",
                  file=sys.stderr)
            return 1
        out = project / "outline.md"
        if out.exists() and not args.force:
            print(f"[outline] {out} exists — pass --force to overwrite", file=sys.stderr)
            return 1
        slides = build_slides(frame, sections, flow)
        out.write_text(dump(frame, flow, slides), encoding="utf-8")
        print(f"[outline] flow={flow}, {len(slides)} slides", file=sys.stderr)
        print(str(out))
        return 0

    if args.render:
        outline_path = project / "outline.md"
        design_path = project / "design_spec.md"
        if not outline_path.is_file() or not design_path.is_file():
            print("[outline] both outline.md and design_spec.md are required",
                  file=sys.stderr)
            return 1
        _, slides = load(outline_path)
        text = design_path.read_text(encoding="utf-8")
        start = text.find("## IX. Content Outline")
        if start < 0:
            print("[outline] design_spec.md has no §IX section", file=sys.stderr)
            return 1
        nxt = text.find("\n## ", start + 1)
        end = len(text) if nxt < 0 else nxt + 1
        design_path.write_text(text[:start] + render_ix(slides) + text[end:],
                               encoding="utf-8")
        print(f"[outline] §IX rewritten from outline.md ({len(slides)} slides)",
              file=sys.stderr)
        return 0

    errors = run_check(project)
    warnings = shape_runs(load(project / "outline.md")[1])
    for w in warnings:
        print(f"  ! {w}", file=sys.stderr)
    if errors:
        print(f"[outline] FAIL ({len(errors)} error(s)):", file=sys.stderr)
        for e in errors:
            print(f"  x {e}", file=sys.stderr)
        return 1
    print("[outline] PASS", file=sys.stderr)
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Build outline.md from plan_spec.md and generate design_spec §IX.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("project_path", help="Path to project directory")
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--propose", action="store_true", help="Print two flow candidates")
    mode.add_argument("--scaffold", action="store_true", help="Write outline.md")
    mode.add_argument("--render", action="store_true",
                      help="Rewrite design_spec.md §IX from outline.md")
    mode.add_argument("--check", action="store_true", help="Validate outline.md")
    parser.add_argument("--flow", help="Flow key for --scaffold")
    parser.add_argument("--force", action="store_true",
                        help="With --scaffold, overwrite an existing outline.md")
    return parser


if __name__ == "__main__":
    raise SystemExit(main())
