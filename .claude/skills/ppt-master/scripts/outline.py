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
    - E-COVER  a `확정` plan_spec section reaches no slide
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
                "목표": "how", "목적 검증": "how", "기대효과": "what", "과제": "what"},
    "hypothesis": {"가설": "why", "착안 근거": "why", "기회 크기": "how",
                   "검증 방법": "how", "예상 결과": "what", "리스크": "what",
                   "다음 단계": "what"},
    "report": {"하기로 한 것": "why", "한 것": "how", "결과": "how",
               "결과 해석": "how", "한계": "what", "다음": "what"},
    "intro": {"왜 존재하나": "why", "무엇인가": "how", "무엇이 다른가": "how",
              "근거·사례": "what", "다음 행동": "what"},
    "teach": {"학습 목표": "why", "왜 필요한가": "why", "개념": "how",
              "예시": "how", "실습·적용": "what", "정리": "what"},
    "ir": {"문제": "why", "해결책": "how", "시장 크기": "how", "제품": "how",
           "수익 모델": "how", "트랙션": "how", "경쟁": "how", "팀": "how",
           "재무": "what", "요청": "what"},
}

SHAPE_SIGNALS: tuple[tuple[str, str], ...] = (
    (r"(?:①|1단계|먼저|첫째).*(?:②|2단계|다음|둘째)", "numbered_steps"),
    (r"(?:→|vs\.?|대비|전후|전 ?→ ?후)", "comparison_columns"),
    (r"\d{4}년.*\d{4}년|\d+분기.*\d+분기", "grouped_bar_chart"),
)


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
    edited: bool = False


def load_shapes() -> set[str]:
    data = json.loads(CHARTS_INDEX.read_text(encoding="utf-8"))
    return set(data["charts"]) | {"body", "cover"}


def pick_shape(body: str) -> str:
    """Choose a layout from the content's shape. See storyline.md §5."""
    figures = re.findall(r"\d[\d,.]*\s*(?:%|%p|점|건|명|원|일|배)", body)
    if len(figures) >= 3:
        return "kpi_cards"
    for pattern, shape in SHAPE_SIGNALS:
        if re.search(pattern, body, re.S):
            return shape
    bullets = re.findall(r"^\s*[-*·]\s+\S", body, re.M)
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
                title=sec.name,
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
        out.append("")
    return "\n".join(out)


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

    design_path = project / "design_spec.md"
    if design_path.is_file():
        text = design_path.read_text(encoding="utf-8")
        nums = [int(n) for n in re.findall(r"^#### Slide (\d+)", text, re.M)]
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
