#!/usr/bin/env python3
"""
PPT Master - Planning Frame Scaffolder and Validator

Builds and checks `plan_spec.md`, the planning document the outline is derived
from. `--scaffold` writes the section chain for the frame that `intake.json`
resolves to; `--check` runs the frame's validation rules against a filled one.

The agent fills the section bodies between those two calls. This script never
writes body text — it owns the frame contract, not the content.

Checks (per selected frame, see references/planner.md §4):
    - E-FACT   fact-required section filled without a `source:` line
    - E-PAIR   paired section carries a claim with no counterpart
    - E-GOAL   target section missing a period or a level
    - E-ALT    option block present where the frame suppresses options,
               or absent where the frame requires one
    - E-ORDER  sections missing, extra, or out of chain order

Usage:
    python3 scripts/plan_spec.py <project_path> --scaffold
    python3 scripts/plan_spec.py <project_path> --check

Examples:
    python3 scripts/plan_spec.py projects/20260903_speakup_campaign --scaffold
    python3 scripts/plan_spec.py projects/20260903_speakup_campaign --check

Dependencies:
    None (only uses standard library)

See references/planner.md for the authored contract these checks enforce.
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


PERIOD_HINTS = ("년", "개월", "주", "일", "분기", "반기", "까지", "이내")
LEVEL_HINTS = ("%", "%p", "점", "건", "명", "원", "배", "이상", "이하", "달성")


@dataclass(frozen=True)
class Frame:
    """One planning frame: its ordered chain plus the rules that apply to it."""

    key: str
    label: str
    sections: tuple[str, ...]
    fact_required: tuple[str, ...]
    pairs: tuple[tuple[str, str], ...]
    target: Optional[str]
    action: str
    options: str  # "on" | "off" | "tail" | "scenario"


FRAMES: dict[str, Frame] = {
    "problem": Frame(
        key="problem",
        label="문제 해결형",
        sections=("현상", "영향", "원인", "배경", "목표", "목적 검증", "기대효과", "과제"),
        fact_required=("현상", "원인", "배경"),
        pairs=(("영향", "기대효과"),),
        target="목표",
        action="과제",
        options="on",
    ),
    "hypothesis": Frame(
        key="hypothesis",
        label="가설 검증형",
        sections=("가설", "착안 근거", "기회 크기", "검증 방법", "예상 결과", "리스크", "다음 단계"),
        fact_required=("착안 근거", "기회 크기"),
        pairs=(("가설", "예상 결과"),),
        target="예상 결과",
        action="다음 단계",
        options="on",
    ),
    "report": Frame(
        key="report",
        label="성과 보고형",
        sections=("하기로 한 것", "한 것", "결과", "결과 해석", "한계", "다음"),
        fact_required=("한 것", "결과"),
        pairs=(("하기로 한 것", "결과"),),
        target="하기로 한 것",
        action="다음",
        options="tail",
    ),
    "intro": Frame(
        key="intro",
        label="소개형",
        sections=("왜 존재하나", "무엇인가", "무엇이 다른가", "근거·사례", "다음 행동"),
        fact_required=("근거·사례",),
        pairs=(),
        target=None,
        action="다음 행동",
        options="off",
    ),
    "teach": Frame(
        key="teach",
        label="교육·강의형",
        sections=("학습 목표", "왜 필요한가", "개념", "예시", "실습·적용", "정리"),
        fact_required=(),
        pairs=(("학습 목표", "정리"),),
        target=None,
        action="실습·적용",
        options="off",
    ),
    "ir": Frame(
        key="ir",
        label="IR 피칭형",
        sections=("문제", "해결책", "시장 크기", "제품", "수익 모델", "트랙션",
                  "경쟁", "팀", "재무", "요청"),
        fact_required=("트랙션", "시장 크기", "재무"),
        pairs=(("문제", "해결책"), ("요청", "재무")),
        target="재무",
        action="요청",
        options="scenario",
    ),
}

PURPOSE_TO_FRAME: dict[str, str] = {
    "사내 예산 · 의사결정 승인": "_assigned",
    "전략 제안": "_assigned",
    "성과 보고": "report",
    "회사 · 서비스 · 프로그램 소개 / 제안서": "intro",
    "교육 · 강의": "teach",
    "IR 투자 유치": "ir",
}

ASSIGNMENT_TO_FRAME = {"지시수명": "problem", "신규제안": "hypothesis"}


@dataclass
class Section:
    """One parsed `plan_spec.md` section."""

    name: str
    status: str
    body: str
    source: str = ""
    options: list[str] = field(default_factory=list)


def resolve_frame(intake: dict) -> str:
    """Derive the frame key from intake answers. See planner.md §2."""
    purpose = str(intake.get("purpose", "")).strip()
    mapped = PURPOSE_TO_FRAME.get(purpose)
    if mapped is None:
        raise ValueError(
            f"unknown intake.purpose {purpose!r} — "
            f"expected one of: {', '.join(PURPOSE_TO_FRAME)}"
        )
    if mapped != "_assigned":
        return mapped
    assignment = str(intake.get("assignment", "")).strip()
    frame = ASSIGNMENT_TO_FRAME.get(assignment)
    if frame is None:
        raise ValueError(
            f"intake.purpose {purpose!r} needs intake.assignment "
            f"(지시수명 or 신규제안); got {assignment!r}"
        )
    return frame


def scaffold(frame: Frame, intake: dict) -> str:
    """Return an empty `plan_spec.md` carrying the frame's chain."""
    stamp = datetime.now().isoformat(timespec="seconds")
    head = (
        "---\n"
        f"frame: {frame.key}\n"
        f"purpose: {intake.get('purpose', '')}\n"
        f"assignment: {intake.get('assignment', '')}\n"
        f"generated_at: {stamp}\n"
        "---\n\n"
        f"# {intake.get('conclusion') or '제목 미정'}\n\n"
    )
    blocks = []
    for i, name in enumerate(frame.sections, 1):
        lines = [f"## {i}. {name}", "status: 확인 필요", ""]
        if name in frame.fact_required:
            lines.append("<!-- 자료 근거가 있을 때만 채운다. source: 줄 필수 -->")
        lines.append("")
        blocks.append("\n".join(lines))
    return head + "\n".join(blocks)


def parse(text: str) -> tuple[dict, list[Section]]:
    """Split `plan_spec.md` into frontmatter and sections."""
    meta: dict = {}
    body = text
    if text.startswith("---"):
        _, front, body = text.split("---", 2)
        for line in front.splitlines():
            if ":" in line:
                k, _, v = line.partition(":")
                meta[k.strip()] = v.strip()

    sections: list[Section] = []
    parts = re.split(r"^## \d+\.\s*", body, flags=re.M)[1:]
    for part in parts:
        head, _, rest = part.partition("\n")
        status_match = re.search(r"^status:\s*(\S+)", rest, re.M)
        source_match = re.search(r"^source:\s*(.+)$", rest, re.M)
        opts = re.findall(r"^\*\*([12]안)\*\*", rest, re.M)
        clean = re.sub(r"^(status|source):.*$", "", rest, flags=re.M)
        clean = re.sub(r"<!--.*?-->", "", clean, flags=re.S).strip()
        sections.append(
            Section(
                name=head.strip(),
                status=status_match.group(1) if status_match else "확인 필요",
                body=clean,
                source=source_match.group(1).strip() if source_match else "",
                options=opts,
            )
        )
    return meta, sections


def check_order(frame: Frame, sections: list[Section]) -> list[str]:
    got = [s.name for s in sections]
    want = list(frame.sections)
    if got == want:
        return []
    missing = [n for n in want if n not in got]
    extra = [n for n in got if n not in want]
    errs = []
    if missing:
        errs.append(f"E-ORDER missing section(s): {', '.join(missing)}")
    if extra:
        errs.append(f"E-ORDER unexpected section(s): {', '.join(extra)}")
    if not missing and not extra:
        errs.append(f"E-ORDER out of chain order — expected {' → '.join(want)}")
    return errs


def check_facts(frame: Frame, by_name: dict[str, Section]) -> list[str]:
    errs = []
    for name in frame.fact_required:
        sec = by_name.get(name)
        if sec is None or not sec.body:
            continue
        if not sec.source:
            errs.append(
                f"E-FACT '{name}' is fact-required but carries no source: line — "
                f"cite sources/ or leave it at status 확인 필요"
            )
    return errs


def check_pairs(frame: Frame, by_name: dict[str, Section]) -> list[str]:
    errs = []
    for first, second in frame.pairs:
        a, b = by_name.get(first), by_name.get(second)
        if a is None or b is None:
            continue
        if b.body and not a.body:
            errs.append(
                f"E-PAIR '{second}' is filled but '{first}' is empty — "
                f"'{second}' must correspond to something stated in '{first}'"
            )
    return errs


def check_target(frame: Frame, by_name: dict[str, Section]) -> list[str]:
    if frame.target is None:
        return []
    sec = by_name.get(frame.target)
    if sec is None or not sec.body:
        return []
    has_period = any(h in sec.body for h in PERIOD_HINTS)
    has_level = any(h in sec.body for h in LEVEL_HINTS)
    if has_period and has_level:
        return []
    lacking = []
    if not has_period:
        lacking.append("기간")
    if not has_level:
        lacking.append("수준")
    return [
        f"E-GOAL '{frame.target}' lacks {' and '.join(lacking)} — "
        f"a target states both; draft two options instead"
    ]


def check_options(frame: Frame, by_name: dict[str, Section]) -> list[str]:
    errs = []
    with_opts = [s.name for s in by_name.values() if s.options]
    if frame.options in {"off", "scenario"} and with_opts:
        errs.append(
            f"E-ALT frame '{frame.key}' suppresses options but "
            f"{', '.join(with_opts)} carries 1안/2안"
        )
    if frame.options == "tail" and with_opts:
        stray = [n for n in with_opts if n != frame.action]
        if stray:
            errs.append(
                f"E-ALT frame '{frame.key}' allows options only in "
                f"'{frame.action}'; found in {', '.join(stray)}"
            )
    if frame.options == "scenario":
        fin = by_name.get("재무")
        if fin is not None and fin.body:
            if not all(k in fin.body for k in ("보수", "기본", "공격")):
                errs.append(
                    "E-IR '재무' must carry 보수 / 기본 / 공격 scenarios"
                )
    return errs


def run_check(project: Path) -> list[str]:
    spec_path = project / "plan_spec.md"
    if not spec_path.is_file():
        return [f"plan_spec.md not found at {spec_path}"]

    meta, sections = parse(spec_path.read_text(encoding="utf-8"))
    frame = FRAMES.get(meta.get("frame", ""))
    if frame is None:
        return [f"unknown frame {meta.get('frame')!r} in plan_spec.md frontmatter"]

    by_name = {s.name: s for s in sections}
    errs = check_order(frame, sections)
    errs += check_facts(frame, by_name)
    errs += check_pairs(frame, by_name)
    errs += check_target(frame, by_name)
    errs += check_options(frame, by_name)
    return errs


def main(argv: Optional[list[str]] = None) -> int:
    configure_utf8_stdio()
    parser = build_parser()
    args = parser.parse_args(argv)

    project = Path(args.project_path).resolve()
    if not project.is_dir():
        print(f"[plan_spec] project not found: {project}", file=sys.stderr)
        return 1

    if args.scaffold:
        intake_path = project / "intake.json"
        if not intake_path.is_file():
            print(f"[plan_spec] intake.json not found at {intake_path}", file=sys.stderr)
            return 1
        intake = json.loads(intake_path.read_text(encoding="utf-8"))
        try:
            frame = FRAMES[resolve_frame(intake)]
        except ValueError as exc:
            print(f"[plan_spec] {exc}", file=sys.stderr)
            return 1
        out = project / "plan_spec.md"
        if out.exists() and not args.force:
            print(f"[plan_spec] {out} exists — pass --force to overwrite", file=sys.stderr)
            return 1
        out.write_text(scaffold(frame, intake), encoding="utf-8")
        print(f"[plan_spec] frame={frame.key} ({frame.label}), "
              f"{len(frame.sections)} sections", file=sys.stderr)
        print(str(out))
        return 0

    errors = run_check(project)
    if errors:
        print(f"[plan_spec] FAIL ({len(errors)} error(s)):", file=sys.stderr)
        for e in errors:
            print(f"  x {e}", file=sys.stderr)
        return 1
    print("[plan_spec] PASS", file=sys.stderr)
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Scaffold or validate plan_spec.md against its planning frame.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("project_path", help="Path to project directory")
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--scaffold", action="store_true",
                      help="Write an empty plan_spec.md for the resolved frame")
    mode.add_argument("--check", action="store_true",
                      help="Validate a filled plan_spec.md")
    parser.add_argument("--force", action="store_true",
                        help="With --scaffold, overwrite an existing plan_spec.md")
    return parser


if __name__ == "__main__":
    raise SystemExit(main())
