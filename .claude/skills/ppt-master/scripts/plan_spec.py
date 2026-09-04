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
    - E-MARK   an empty `{+}` / `{-}` — the mark wraps the figure, it does not follow it
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
    heading: str = ""   # 소제목 as it appears in the document; falls back to name
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
        # intake's `conclusion` is the writer's own sentence, not a 제목. It is
        # parked as the governing message's raw material; the 제목 is written
        # to shape (report-format.md §2.2) and cannot be a lifted sentence.
        "# [핵심 수단] + [결과 수치] — 12~18자\n\n"
        "## 거버닝 메시지\n"
        "<!-- [현황/문제 1문장] + [해결 1문장] + [정량 결과 1문장]. "
        "현황 진단으로 시작한다 — 선언으로 시작하지 않는다. -->\n"
        f"{intake.get('conclusion', '')}\n\n"
    )
    blocks = []
    for i, name in enumerate(frame.sections, 1):
        lines = [f"## {i}. {name}", "status: 확인 필요", ""]
        if name in frame.fact_required:
            lines.append("<!-- 자료 근거가 있을 때만 채운다. source: 줄 필수 -->")
        lines.append("")
        blocks.append("\n".join(lines))
    return head + "\n".join(blocks)


APPENDIX_RE = re.compile(r"^##\s*(별첨[^\n]*)$", re.M)


def split_appendix(text: str) -> tuple[str, list[tuple[str, str]]]:
    """Cut `## 별첨 …` blocks off the end.

    Appendices carry the supporting material a report attaches rather than
    argues from. They are not frame sections, so the chain check must not see
    them and the reader meets them after the argument, not inside it.
    """
    marks = list(APPENDIX_RE.finditer(text))
    if not marks:
        return text, []
    blocks = []
    for i, m in enumerate(marks):
        end = marks[i + 1].start() if i + 1 < len(marks) else len(text)
        blocks.append((m.group(1).strip(), text[m.end():end].strip()))
    return text[:marks[0].start()], blocks


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

    body, _appendix = split_appendix(body)

    title_match = re.search(r"^#\s+(.+?)\s*$", body, re.M)
    meta["title"] = title_match.group(1) if title_match else ""
    gov_match = re.search(
        r"^##\s*거버닝 메시지\s*$(.*?)(?=^##\s|\Z)", body, re.M | re.S)
    gov = gov_match.group(1) if gov_match else ""
    gov = re.sub(r"<!--.*?-->", "", gov, flags=re.S).strip()
    meta["governing"] = gov
    # The governing block is not a frame section; the chain check must not see it.
    if gov_match:
        body = body[:gov_match.start()] + body[gov_match.end():]

    sections: list[Section] = []
    parts = re.split(r"^## \d+\.\s*", body, flags=re.M)[1:]
    for part in parts:
        head, _, rest = part.partition("\n")
        # `\S+` would stop at the space and read "확인 필요" as "확인", which
        # then matches no comparison anywhere downstream.
        status_match = re.search(r"^status:\s*(.+?)\s*$", rest, re.M)
        heading_match = re.search(r"^heading:\s*(.+?)\s*$", rest, re.M)
        source_match = re.search(r"^source:\s*(.+)$", rest, re.M)
        opts = re.findall(r"^\*\*([12]안)\*\*", rest, re.M)
        clean = re.sub(r"^(status|source|heading):.*$", "", rest, flags=re.M)
        clean = re.sub(r"<!--.*?-->", "", clean, flags=re.S).strip()
        sections.append(
            Section(
                name=head.strip(),
                status=status_match.group(1) if status_match else "확인 필요",
                body=clean,
                heading=heading_match.group(1) if heading_match else "",
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


# `{+…}` / `{-…}` wrap the figure whose direction the author is asserting. An
# empty one is a near miss for `75.7%{+}`, where the marker follows the figure
# instead of enclosing it.
_EMPTY_DIRECTION_RE = re.compile(r"\{([+-])\s*\}")


def check_direction_marks(sections: list[Section]) -> list[str]:
    """Catch a direction mark that colours nothing.

    It renders as no mark at all — no error, no colour, the figure simply
    stays black — so without this the author's intent is dropped in silence
    and only a careful reading of the finished document would show it.
    """
    errs = []
    for sec in sections:
        for sign in _EMPTY_DIRECTION_RE.findall(sec.body or ""):
            errs.append(
                f"E-MARK '{sec.name}' has an empty {{{sign}}} — the mark wraps "
                f"the figure it describes: write {{{sign}75.7%}}, not 75.7%{{{sign}}}"
            )
    return errs


# report-format.md §2.1. Each of these carries no information: delete it, or
# replace it with the concrete term it is standing in for.
BANNED_WORDS = (
    "차세대", "지능형", "혁신적", "종합적", "획기적", "최적의", "효과적인",
    "다양한", "폭넓은", "여러 가지", "전반적", "적극적", "다각적",
)

_FIGURE_RE = re.compile(r"\d")
# `*` and `※` are 각주 — explanatory prose that takes a full stop. The 개조식
# rule governs the 핵심/세부 markers only.
_BULLET_RE = re.compile(r"^\s*[▢◦─·\-]\s*(.+?)\s*$", re.M)
# 개조식 must end 명사형 / ~함 / 추진 / 구축 — a 서술형 ending is the other register.
_NARRATIVE_END_RE = re.compile(r"(?:다|까|요|죠)\.?$")
# Two independent signals, because either alone misses: "무엇을 했나" ends in
# 나, "어디가 문제인가" ends in 인가, and both open with a question word.
_QUESTION_END_RE = re.compile(r"(?:\?|나|까|은가|는가|인가|한가|런가|던가|ㄹ까)$")
_QUESTION_START_RE = re.compile(r"^(?:무엇|무슨|어디|어떤|어떻게|왜|언제|누가|얼마)")


def _is_question(head: str) -> bool:
    return bool(_QUESTION_END_RE.search(head) or _QUESTION_START_RE.match(head))


def _banned_in(text: str) -> list[str]:
    return [w for w in BANNED_WORDS if w in text]


def check_title(meta: dict) -> list[str]:
    """report-format.md §2.2 제목 — `[핵심 수단] + [결과/수치]`, 12~18자.

    The scaffold used to drop `intake.conclusion` here, so the 제목 arrived as
    whatever sentence the writer had typed about their conclusion: two clauses,
    no figure, thirty-odd characters. That is a 거버닝 메시지, not a 제목.
    """
    errs = []
    title = (meta.get("title") or "").strip()
    if not title or title.startswith("["):
        return ["E-TITLE 제목이 비어 있다 — [핵심 수단] + [결과 수치] 로 12~18자"]
    length = len(re.sub(r"\s", "", title))
    if length > 24:
        errs.append(f"E-TITLE 제목이 {length}자 — 12~18자로 줄인다 "
                    f"(수단과 결과 수치만 남긴다)")
    if len(re.findall(r"[.!?]\s|[.!?]$", title)) >= 2 or title.count(". ") >= 1:
        errs.append("E-TITLE 제목이 두 문장 — 제목은 한 덩어리다. "
                    "나머지는 거버닝 메시지로 옮긴다")
    if not _FIGURE_RE.search(title):
        errs.append("E-TITLE 제목에 수치가 없다 — 결과는 정량으로 (§2.2)")
    for w in _banned_in(title):
        errs.append(f"E-TITLE 제목의 '{w}' — 최상위·추상 수식어는 삭제하거나 "
                    f"검증 가능한 구체어로 바꾼다")
    return errs


def check_governing(meta: dict) -> list[str]:
    """report-format.md §2.2 거버닝 메시지 — 2~3문장, 현황 진단으로 시작."""
    gov = (meta.get("governing") or "").strip()
    if not gov:
        return ["E-GOV 거버닝 메시지가 없다 — [현황/문제] + [해결] + [정량 결과] "
                "2~3문장으로 제목 아래에 쓴다"]
    errs = []
    sentences = [x for x in re.split(r"(?<=[.다])\s+", gov) if x.strip()]
    if not 2 <= len(sentences) <= 3:
        errs.append(f"E-GOV 거버닝 메시지가 {len(sentences)}문장 — 2~3문장")
    if not _FIGURE_RE.search(gov):
        errs.append("E-GOV 거버닝 메시지에 수치가 없다 — 마지막은 정량 결과")
    for w in _banned_in(gov):
        errs.append(f"E-GOV 거버닝 메시지의 '{w}' — 구체어로 바꾼다")
    return errs


def check_headings(sections: list[Section]) -> list[str]:
    """report-format.md §2.2 소제목 — `[대상/범위] + [핵심 조치]`, 명사형 20자 내외."""
    errs = []
    for sec in sections:
        head = (sec.heading or "").strip()
        if not head:
            continue
        if _is_question(head):
            errs.append(f"E-HEAD '{sec.name}' 의 소제목 '{head}' 이 의문형 — "
                        f"[대상] + [조치] 명사형으로 (예: '지역사업소 참여율 56.3%')")
        if len(re.sub(r"\s", "", head)) > 28:
            errs.append(f"E-HEAD '{sec.name}' 의 소제목이 너무 길다 — 20자 내외")
        for w in _banned_in(head):
            errs.append(f"E-HEAD '{sec.name}' 의 소제목에 '{w}' — 형용사 금지")
    return errs


def check_register(sections: list[Section]) -> list[str]:
    """report-format.md §2.1 — 수식어, and 개조식 종결·마침표."""
    errs = []
    for sec in sections:
        for w in _banned_in(sec.body or ""):
            errs.append(f"E-WORD '{sec.name}' 본문의 '{w}' — 삭제하거나 "
                        f"검증 가능한 구체어로 바꾼다")
        for line in _BULLET_RE.findall(sec.body or ""):
            if line.endswith("."):
                errs.append(f"E-PUNCT '{sec.name}' 개조식 줄에 마침표 — "
                            f"개조식은 마침표 없이 끝난다: '{line[:24]}…'")
            elif _NARRATIVE_END_RE.search(line):
                errs.append(f"E-PUNCT '{sec.name}' 개조식 줄이 서술형 종결 — "
                            f"명사형·~함·추진·구축 으로: '{line[:24]}…'")
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
    errs += check_direction_marks(sections)
    errs += check_title(meta)
    errs += check_governing(meta)
    errs += check_headings(sections)
    errs += check_register(sections)
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
