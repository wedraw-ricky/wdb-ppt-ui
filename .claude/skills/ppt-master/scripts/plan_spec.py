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
    - E-BROAD  목적 rests on a 대목적 — 매출 증대 and friends (교안 48)
    - E-DUP    현상·영향·원인 carry the same line (2강 첨삭)
    - E-ACT    과제 states no period (교안 74·79·80)

  Advisories, printed but never blocking:
    - W-GAIN   기대효과 lists more than 영향 costs (교안 73)
    - W-AIM    목적 검증 lists several ends instead of picking one (교안 73)
    - W-BASE   현상 states a figure with nothing to read it against
    - W-SPEC   과제 reads as a build requirement (교안 122)

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
    # "full"  — 기획부터 한다. The planner block is part of the chain and
    #           the document is grouped into reader-facing items.
    # "short" — the content is already settled. The frame carries its own
    #           chain and nothing is appended; a 교안 or a 소개서 does not
    #           need 실행 계획 and 리스크 대책 to be a finished thing.
    route: str  # "full" | "short"


FRAMES: dict[str, Frame] = {
    "problem": Frame(
        key="problem",
        label="문제 해결형",
        # 교안 63·65·66: the client block (1-8) is followed by the concept
        # block (9·10) and the planner block (11·12). Stopping at 8 yields
        # what to do but never when, by whom, at what cost, or what breaks —
        # the four things an approver asks first.
        sections=("현상", "영향", "원인", "배경", "목표", "목적 검증", "기대효과",
                  "과제", "컨셉", "해결책", "실행 계획", "리스크 대책"),
        fact_required=("현상", "원인", "배경"),
        pairs=(("영향", "기대효과"),),
        target="목표",
        action="과제",
        options="on",
        route="full",
    ),
    "hypothesis": Frame(
        key="hypothesis",
        label="가설 검증형",
        # 검증도 사람이 일정과 예산을 들여 하는 일이라 실행 계획을 진다.
        # 리스크 대책은 따로 두지 않는다 — 여기서는 `리스크` 가 그 자리다.
        sections=("가설", "착안 근거", "기회 크기", "검증 방법", "예상 결과",
                  "리스크", "다음 단계", "실행 계획"),
        fact_required=("착안 근거", "기회 크기"),
        pairs=(("가설", "예상 결과"),),
        target="예상 결과",
        action="다음 단계",
        options="on",
        route="full",
    ),
    "report": Frame(
        key="report",
        label="성과 보고형",
        # 보고서에도 다음 계획이 따라붙는다 — 무엇을 했는지로 끝나는 보고는
        # 읽는 사람이 "그래서 다음은" 을 되묻게 만든다.
        sections=("하기로 한 것", "한 것", "결과", "결과 해석", "한계", "다음",
                  "실행 계획", "리스크 대책"),
        fact_required=("한 것", "결과"),
        pairs=(("하기로 한 것", "결과"),),
        target="하기로 한 것",
        action="다음",
        options="tail",
        route="full",
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
        route="short",
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
        route="short",
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
        route="short",
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
        if sec is None:
            continue
        if not sec.body:
            # 비어 있는 것 자체는 잘못이 아니다 — 아직 안 채운 상태다. 잘못은
            # 비어 있으면서 `확정` 이라고 말하는 것이다. IR 의 재무를 통째로
            # 비워두면 E-IR 도 같은 이유로 조용해, 재무 없는 IR 이 통과했다.
            if sec.status == "확정":
                errs.append(
                    f"E-FACT '{name}' is 확정 but empty — a settled section "
                    f"with nothing in it claims a fact nobody wrote"
                )
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


# A 기획서 proposes; a 보고서 reports a result that already exists. Their 제목 は
# different sentences and were being judged by one rule: demanding a figure in
# the 제목 of a proposal asks for a result it has not produced yet.
PROPOSAL_FRAMES = frozenset({"problem", "hypothesis", "intro", "ir", "teach"})

# `[목적] 을 위한 [실행안]` 골자는 유지한다. 문제는 골자가 아니라 그 자리에
# 들어가는 말이었다 — "출장 동선 여섯 자리를 위한 PLATINUM ELITE" 는 골자를
# 지켰지만 아무도 그렇게 말하지 않는다. 그래서 아래 검사는 모양이 아니라
# 낱말을 본다 (planner.md §2.6).

# 독자가 대화에서 쓰지 않는 말. 제목에 있으면 그 순간 문서 제목이 된다.
TRADE_WORDS = ("동선", "실행안", "제고", "고도화", "확보 방안", "개선안",
               "방안", "활성화", "내실화", "선진화")

# 셀 수 있는 값을 한글 수사로 쓴 것. 말은 "여섯 곳" 이라 해도 화면은 `6곳` 이다 —
# 눈은 숫자를 한 번에 잡고 한글 수사는 읽어야 안다 (planner.md §2.7).
_KO_NUM = "한|두|세|네|다섯|여섯|일곱|여덟|아홉|열|스무|하나|둘|셋|넷"
_COUNTER = ("곳|개|가지|번|회|장|명|건|원|배|쪽|단|칸|줄|시간|분|일|달|년|주|자리|"
            "번째|묶음|갈래|종류|권|대|잔|팀|층|단계")
# 셈 단위 뒤에는 조사가 붙는 것이 보통이다 — "일곱 가지는", "두 곳을".
# 조사를 안 봐주면 규칙이 실제 문장에서 거의 안 걸린다. 반대로 아무 글자나
# 허용하면 "세 장면" 의 '세 장' 을 잘못 잡는다. 조사만 골라 허용한다.
_PARTICLE = "은|는|이|가|을|를|도|만|의|와|과|로|에|서|씩|뿐|째|밖에|부터|까지"
_KO_COUNT_RE = re.compile(
    rf"(?<![가-힣])({_KO_NUM})\s*({_COUNTER})(?:{_PARTICLE})?(?![가-힣])")

# 세고 있지 않은 말버릇은 그대로 둔다. "한 번쯤 들러보세요" 는 수가 아니다.
_IDIOM_RE = re.compile(r"한\s*번(?:쯤|은|씩|만|더)|두어|한두|서너|대여섯|"
                       r"몇\s*가지|한\s*가지도|여러\s*번")

# `[목적] 을 위한 [실행안]` — the proposal 제목 shape (planner.md §2.5).
_PURPOSE_RE = re.compile(r"(.+?)\s*(?:을|를)\s*위(?:한|해)\s*(.+)")

# A purpose so broad it locates nothing: it names a direction, not what is
# failing. "업무 효율을 위한" passes a naive check and still tells no one anything.
BROAD_PURPOSE = (
    "업무 효율", "효율화", "생산성", "역량 강화", "매출 증대", "이익 증대",
    "성과 향상", "경쟁력 강화", "혁신", "고도화", "선진화", "활성화",
    "내실화", "개선", "발전",
)


# 그 장이 무엇인지가 아니라 문서의 목차 항목을 적은 제목. 목차는 목차 자리에
# 있으면 되고, 제목 자리에는 독자가 그 장에서 알게 되는 것이 와야 한다.
LABEL_TITLES = (
    "개요", "배경", "현황", "결론", "요약", "정리", "마무리", "목차", "소개",
    "주요 내용", "세부 내용", "기타", "참고", "부록", "숫자로 보면", "한눈에 보기",
)

# 설명문 어미로 끝나는 제목 — 제목은 문장을 요약하는 자리가 아니다.
_EXPLAIN_TAIL_RE = re.compile(
    r"(?:에 대(?:해|하여)\s*(?:알아봅니다|살펴봅니다|설명합니다)|"
    r"로 이(?:뤄|루어)집니다|를 설명합니다|를 소개합니다|에 대한 안내)$")

def check_copy(title: str, where: str, max_len: Optional[int] = None) -> list[str]:
    """제목의 낱말과 문장 (planner.md §2.6).

    골자는 §2.5 가 본다. 여기는 그 골자에 들어간 말이 독자의 말인지를 본다 —
    라벨을 적어놓지 않았는지, 설명문으로 끝나지 않는지, 업계 말이 없는지,
    구체적인 것이 하나라도 있는지.
    """
    title = (title or "").strip()
    if not title:
        return []
    errs = []
    bare = re.sub(r"\s", "", title)
    for lab in LABEL_TITLES:
        if bare == re.sub(r"\s", "", lab):
            errs.append(f"E-COPY {where}이 '{title}' — 목차 항목이지 제목이 아니다. "
                        f"그 장에서 독자가 알게 되는 것을 쓴다 "
                        f"(예: '숫자로 보면' → '호텔 23곳, 주차장 17곳')")
            break
    if _EXPLAIN_TAIL_RE.search(title):
        errs.append(f"E-COPY {where}이 설명문으로 끝난다 — '{title}'. "
                    f"제목은 내용을 요약하는 자리가 아니라 독자를 붙드는 자리다")
    for w in TRADE_WORDS:
        if w in title:
            errs.append(f"E-COPY {where}의 '{w}' — 독자가 대화에서 쓰지 않는 말이다. "
                        f"그 사람이 친구에게 설명하듯 바꾼다 (planner.md §2.6)")
    # 길이 제한은 장 제목에만 건다. 문서 제목은 표지와 파일 목록에서 읽히는
    # 것이라 한 줄에 갇히지 않는다 — "신입사원 1년 이내 퇴사율 40% 해소를 위한
    # 온보딩 재설계안" 은 26자지만 좋은 기획서 제목이다.
    if max_len and len(bare) > max_len:
        errs.append(f"E-COPY {where}이 {len(bare)}자 — {max_len}자 안으로. "
                    f"화면에서 두 줄이 되면 제목이 아니라 문단이다")
    # "구체적인 것을 앞에 둔다" 는 판단이 섞이므로 검사로 막지 않는다 — 맞는
    # 제목까지 막는 검사는 결국 아무도 안 본다. 규칙은 planner.md §2.6 에 두고,
    # 여기서는 기계가 확실히 아는 것만 잡는다.
    errs += check_screen_numerals(title, where)
    return errs


def check_screen_numerals(text: str, where: str) -> list[str]:
    """화면에 나가는 글의 숫자 표기 (planner.md §2.7).

    말은 "여섯 곳" 이라 하지만 자료는 보는 것이다. 눈은 `6곳` 을 한 번에 잡고
    `여섯 곳` 은 읽어야 안다. 그래서 제목과 screen 은 숫자, script 는 한글이다 —
    발표자는 화면의 `6곳` 을 보고 입으로 "여섯 곳" 이라 말하면 된다.

    말버릇("한 번쯤", "두어 곳")은 수를 세고 있지 않으므로 건드리지 않는다.
    """
    errs = []
    for m in _KO_COUNT_RE.finditer(text or ""):
        span = m.group(0)
        head = max(0, m.start() - 3)
        if _IDIOM_RE.search(text[head:m.end() + 3]):
            continue
        errs.append(f"E-NUM {where}의 '{span}' — 화면에 나가는 글에서 셀 수 있는 "
                    f"값은 숫자로 쓴다. 말할 때만 한글로 읽는다 (planner.md §2.7)")
    return errs


def check_title(meta: dict, frame: Optional[Frame] = None) -> list[str]:
    """The 제목 rule, by document kind.

    A proposal's 제목 is `[목적] 을 위한 [실행안]` (planner.md §2.5); a report's
    leads with the figure (report-format.md §2.2). One rule for both demanded a
    result the proposal had not produced, and let a proposal ship with no
    purpose in its 제목 at all — which is the one thing a decision-maker reads.
    """
    title = (meta.get("title") or "").strip()
    key = frame.key if frame else None
    is_proposal = frame is None or key in PROPOSAL_FRAMES
    if not title or title.startswith("["):
        shape = ("[목적] 을 위한 [실행안]" if is_proposal
                 else "[핵심 수단] + [결과 수치] 로 12~18자")
        return [f"E-TITLE 제목이 비어 있다 — {shape}"]

    errs = []
    if len(re.findall(r"[.!?]\s|[.!?]$", title)) >= 2 or title.count(". ") >= 1:
        errs.append("E-TITLE 제목이 두 문장 — 제목은 한 덩어리다. "
                    "나머지는 거버닝 메시지로 옮긴다")
    for w in _banned_in(title):
        errs.append(f"E-TITLE 제목의 '{w}' — 최상위·추상 수식어는 삭제하거나 "
                    f"검증 가능한 구체어로 바꾼다")

    errs += check_copy(title, "제목")

    if not is_proposal:
        length = len(re.sub(r"\s", "", title))
        if length > 24:
            errs.append(f"E-TITLE 제목이 {length}자 — 12~18자로 줄인다 "
                        f"(수단과 결과 수치만 남긴다)")
        if not _FIGURE_RE.search(title):
            errs.append("E-TITLE 보고서 제목에 수치가 없다 — 결과는 정량으로 "
                        "(report-format.md §2.2)")
        return errs

    match = _PURPOSE_RE.match(title)
    if not match:
        errs.append("E-TITLE 제목에 목적이 없다 — '[목적] 을 위한 [실행안]' 으로 "
                    "쓴다. 무엇이 나아지는지가 없으면 결재자는 승인 대신 "
                    "질문을 한다 (planner.md §2.5)")
        return errs

    purpose = match.group(1).strip()
    for w in BROAD_PURPOSE:
        if purpose == w or purpose.endswith(w):
            errs.append(f"E-TITLE 제목의 목적 '{purpose}' 이 너무 넓다 — "
                        f"무엇이 안 되고 있는지를 짚는다 "
                        f"(예: '실시간 업무 소통의 극대화를 위한 …')")
            break
    if len(re.sub(r"\s", "", purpose)) < 4:
        errs.append(f"E-TITLE 제목의 목적 '{purpose}' 이 너무 짧다 — "
                    f"달성하려는 것을 한 구절로 적는다")
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


# ---- 강의 첨삭이 잡아낸 것들 --------------------------------------------------
# 2강 첨삭과 교안 28·48·73·122. 기계가 확실히 아는 것만 오류(E-)로 두고, 사람의
# 판단이 섞이는 것은 경고(W-)로 둔다. 맞는 기획서를 막는 검사는 결국 아무도 보지
# 않게 되고, 그러면 검사가 없는 것과 같다.

def _items(body: str) -> list[str]:
    """한 절이 말하는 것의 개수. 낱말이 아니라 개수로 세는 이유는, 같은 뜻을
    다른 낱말로 쓰는 글에서 낱말 겹침이 멀쩡한 기획서를 잡기 때문이다."""
    out = []
    for raw in body.splitlines():
        if raw.lstrip().startswith(("▢", "□", "◦", "○", "─", "-", "·")):
            line = _MARKER_RE.sub("", raw).strip()
            if line:
                out.append(line)
    return out


# 교안 48: 매출증대·이익증대·역량강화 는 목적이 아니라 대목적이다.
BROAD_ENDS = ("매출증대", "매출 증대", "이익증대", "이익 증대", "역량강화",
              "역량 강화", "이윤창출", "이윤 창출", "이윤 극대화", "매출 극대화",
              "수익 극대화", "경쟁력 강화")

# 수치를 읽을 바탕. 하나도 없으면 50% 가 좋은 건지 나쁜 건지 알 수 없다.
GROUND_HINTS = ("바람직", "전년", "작년", "대비", "기준", "평균", "목표", "정상",
                "이었", "였으", "에서", "수준", "동기", "업계")

# 368행의 `_FIGURE_RE` 는 "숫자가 있느냐" 를 묻는다. 이쪽은 "단위까지 붙은
# 수치냐" 를 묻는 다른 질문이라 이름도 달라야 한다. 같은 이름을 쓰면 뒤에
# 정의된 것이 앞을 덮어, 제목·거버닝 메시지 검사가 조용히 다르게 동작한다.
_MEASURED_RE = re.compile(
    r"\d[\d,.]*\s*(?:%p|%|만원|억원|천원|억|점|건|명|원|일|배|개월|회|시간)")
_SPEC_RE = re.compile(r"기능\s*(?:추가|개발|구현)|버튼|팝업|화면\s*개발|API")
_MARKER_RE = re.compile(r"^[\s▢□◦○─\-*※·]+")


def check_broad_purpose(by_name: dict[str, Section]) -> list[str]:
    errs = []
    for name in ("목적 검증", "목표"):
        sec = by_name.get(name)
        if sec is None or not sec.body:
            continue
        hit = next((p for p in BROAD_ENDS if p in sec.body), None)
        if hit:
            errs.append(
                f"E-BROAD '{name}' rests on {hit} — a 대목적 names no place to "
                f"act on. Say what stops working, for whom"
            )
    return errs


def check_overlap(by_name: dict[str, Section]) -> list[str]:
    """현상·영향·원인이 같은 줄을 나눠 가지면 셋 중 둘은 사실 비어 있다."""
    seen: dict[str, str] = {}
    errs = []
    for name in ("현상", "영향", "원인"):
        sec = by_name.get(name)
        if sec is None or not sec.body:
            continue
        for raw in sec.body.splitlines():
            line = _MARKER_RE.sub("", raw).strip()
            if len(line) < 8:
                continue
            owner = seen.get(line)
            if owner is not None and owner != name:
                errs.append(
                    f"E-DUP '{owner}' and '{name}' carry the same line — "
                    f"\"{line[:28]}…\". One of the two is not filled in"
                )
            seen.setdefault(line, name)
    return errs


def check_task_shape(frame: Frame, by_name: dict[str, Section]) -> list[str]:
    """교안 74·79·80: 기획과제는 언제까지 무엇을 하는지까지 간다."""
    if frame.key != "problem":
        return []
    sec = by_name.get("과제")
    if sec is None or not sec.body:
        return []
    if any(h in sec.body for h in PERIOD_HINTS):
        return []
    return ["E-ACT '과제' states no period — the lecture's 기획과제 always says "
            "by when. Without it nobody can say whether it was done"]


def advisories(frame: Frame, by_name: dict[str, Section]) -> list[str]:
    """Judgement calls. These are said out loud, never used to block a run."""
    if frame.key != "problem":
        return []
    out: list[str] = []

    영향, 기대효과 = by_name.get("영향"), by_name.get("기대효과")
    if 영향 and 영향.body and 기대효과 and 기대효과.body:
        # 교안 73: 기대효과는 "문제로 인한 영향 중" 얻는 것이다. 영향보다 긴
        # 기대효과는 문제가 값을 치르지 않은 이득을 세고 있다는 뜻이다.
        if len(_items(기대효과.body)) > len(_items(영향.body)):
            out.append("W-GAIN '기대효과' lists more than '영향' costs — the "
                       "lecture takes the gain out of the impact, so it cannot "
                       "be the longer list")

    목적 = by_name.get("목적 검증")
    if 목적 and 목적.body and len(_items(목적.body)) > 1:
        # 교안 73: 바람직한 상태란 "발생가능한 영향에서 가장 우선순위를 선택"한 것.
        out.append("W-AIM '목적 검증' lists several ends — the lecture picks one "
                   "impact, the one that matters most, and lets the rest go")

    현상 = by_name.get("현상")
    if (현상 is not None and 현상.body and _MEASURED_RE.search(현상.body)
            and not any(g in 현상.body for g in GROUND_HINTS)):
        out.append("W-BASE '현상' states a figure with nothing to read it against "
                   "— 바람직한 상태, 전년, 목표, 평균. Without one, 50% is neither "
                   "good nor bad")

    과제 = by_name.get("과제")
    if (과제 is not None and 과제.body and _SPEC_RE.search(과제.body)
            and not any(k in 과제.body for k in ("위한", "위해", "통해", "통한"))):
        out.append("W-SPEC '과제' reads as a build request — 기능 추가 is a "
                   "requirement, not a plan (교안 122). Say what it changes")
    return out


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
    errs += check_title(meta, frame)
    errs += check_governing(meta)
    errs += check_headings(sections)
    errs += check_register(sections)
    errs += check_broad_purpose(by_name)
    errs += check_overlap(by_name)
    errs += check_task_shape(frame, by_name)
    return errs


def run_advisories(project: Path) -> list[str]:
    spec_path = project / "plan_spec.md"
    if not spec_path.is_file():
        return []
    meta, sections = parse(spec_path.read_text(encoding="utf-8"))
    frame = FRAMES.get(meta.get("frame", ""))
    if frame is None:
        return []
    return advisories(frame, {s.name: s for s in sections})


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

    for note in run_advisories(project):
        print(f"  ! {note}", file=sys.stderr)
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
