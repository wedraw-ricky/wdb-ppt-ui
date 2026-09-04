#!/usr/bin/env python3
"""
PPT Master - Planning Document Renderer

Renders `plan_spec.md` into the 기획서 a person actually reads — Markdown
always, Word (.docx) on request. The frame's section chain is kept exactly as
written: this script formats the contract, it never authors, reorders or
rewrites it.

`plan_spec.md` is the source of truth for both halves of the run. The deck
takes that material through `outline.py` and the golden circle; this is the
other half — the report that falls out of the same planning pass, in the
frame's own order.

Unfinished work stays visible. A section at `초안` or `확인 필요` is rendered
with that state on it rather than silently reading as settled, and the sections
still open are listed at the end.

Usage:
    python3 scripts/render_plan_doc.py <project_path> [--format auto|md|docx|both]

Examples:
    python3 scripts/render_plan_doc.py projects/20260903_speakup_campaign
    python3 scripts/render_plan_doc.py projects/20260903_speakup_campaign --format both
    python3 scripts/render_plan_doc.py projects/20260903_speakup_campaign --format docx

Dependencies:
    python-docx  - only for --format docx / both. Imported lazily, so the
                   default Markdown path runs on the standard library alone.

See references/planner.md §6 for the contract this renders, and
references/report-format.md for the Word form and its register.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Optional

sys.path.insert(0, str(Path(__file__).resolve().parent))

from console_encoding import configure_utf8_stdio  # noqa: E402
from plan_spec import FRAMES, Frame, Section, parse  # noqa: E402
from report_form import strip_markup  # noqa: E402


DOC_SUFFIX = "기획서"

# Report kinds that ask for a document, not just a deck (intake.doc_kind).
DOC_KINDS_WANTING_WORD = {"보고서", "둘 다"}

_BOLD_RE = re.compile(r"\*\*(.+?)\*\*")
_BULLET_RE = re.compile(r"^\s*[-*·]\s+(.*)$")


@dataclass
class Plan:
    """Everything the renderers need, read once from the project."""

    title: str
    meta: dict
    sections: list[Section]
    frame: Optional[Frame]
    intake: dict


def load_intake(project: Path) -> dict:
    """Read `intake.json` if it is there. Rendering does not depend on it."""
    path = project / "intake.json"
    if not path.is_file():
        return {}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        print(f"[render_plan_doc] intake.json unreadable ({exc}) — "
              f"rendering without it", file=sys.stderr)
        return {}
    return data if isinstance(data, dict) else {}


def build_plan(project: Path) -> Plan:
    """Parse `plan_spec.md` into the shape both renderers consume."""
    text = (project / "plan_spec.md").read_text(encoding="utf-8")
    meta, sections = parse(text)
    heading = re.search(r"^#\s+(.+)$", text, re.M)
    frame = FRAMES.get(str(meta.get("frame", "")).strip())
    if frame is None and meta.get("frame"):
        print(f"[render_plan_doc] unknown frame {meta.get('frame')!r} in "
              f"plan_spec.md — rendering the sections as written", file=sys.stderr)
    return Plan(
        title=heading.group(1).strip() if heading else DOC_SUFFIX,
        meta=meta,
        sections=sections,
        frame=frame,
        intake=load_intake(project),
    )


def header_rows(plan: Plan) -> list[tuple[str, str]]:
    """The identifying block at the top of the document."""
    rows: list[tuple[str, str]] = []
    if plan.frame is not None:
        rows.append(("구성", f"{plan.frame.label} · {len(plan.frame.sections)}단"))
    for label, key in (("목적", "purpose"), ("출발", "assignment")):
        value = str(plan.meta.get(key) or plan.intake.get(key) or "").strip()
        if value:
            rows.append((label, value))
    audience = str(plan.intake.get("audience") or "").strip()
    if audience:
        rows.append(("대상", audience))
    rows.append(("작성", _stamp_date(str(plan.meta.get("generated_at") or ""))))
    return rows


def _stamp_date(stamp: str) -> str:
    """`generated_at` as a plain date; today's when the stamp is unreadable."""
    try:
        return datetime.fromisoformat(stamp).strftime("%Y-%m-%d")
    except ValueError:
        return datetime.now().strftime("%Y-%m-%d")


def _empty_note(plan: Plan, section: Section) -> str:
    """Why a section is blank — the frame's own reason, not a guess."""
    if plan.frame is not None and section.name in plan.frame.fact_required:
        return "자료 근거 없음 — 미작성"
    return "미작성"


def pending_sections(plan: Plan) -> list[Section]:
    return [s for s in plan.sections if s.status != "확정"]


# ---- Markdown ---------------------------------------------------------------


def render_markdown(plan: Plan) -> str:
    out: list[str] = [f"# {plan.title}", ""]

    rows = header_rows(plan)
    if rows:
        out += ["| | |", "|---|---|"]
        out += [f"| {k} | {v} |" for k, v in rows]
        out.append("")

    for i, sec in enumerate(plan.sections, 1):
        out += [f"## {i}. {sec.name}", ""]
        if sec.status != "확정":
            out += [f"> **{sec.status}**", ""]
        if sec.body:
            out += [strip_markup(sec.body), ""]
        else:
            out += [f"_{_empty_note(plan, sec)}_", ""]
        if sec.source:
            out += [f"근거: `{sec.source}`", ""]

    pending = pending_sections(plan)
    if pending:
        out += ["---", "", "## 아직 닫히지 않은 항목", ""]
        out += [f"- {s.name} — {s.status}" for s in pending]
        out.append("")

    return "\n".join(out).rstrip() + "\n"


# ---- Word --------------------------------------------------------------------


def render_docx(plan: Plan, out_path: Path, form_name: str) -> None:
    """Typeset the 기획서 in the chosen report form.

    The mechanics live in `report_form.py`; the form's glyphs, fonts and colours
    live in `templates/report_forms/`. This function only says what goes where.
    """
    try:
        import report_form
        writer = report_form.ReportWriter(report_form.load_form(form_name))
    except ImportError as exc:
        raise RuntimeError(
            "python-docx is not installed — it is needed only for --format docx/both. "
            "Install it with:  pip install python-docx"
        ) from exc

    writer.write_chrome(plan.intake.get("department") or "기획", plan.title)
    writer.write_title(plan.title)
    _meta_table(writer, plan)

    for i, sec in enumerate(plan.sections):
        writer.write_section(i, sec.name, sec.status)
        blocks = report_form.parse_body(sec.body) if sec.body else []
        if not blocks:
            writer.write_line("detail", _empty_note(plan, sec))
        for level, payload in blocks:
            if level == "table":
                writer.write_table(payload)
            else:
                writer.write_line(level, payload)
        if sec.source:
            writer.write_line("note", f"근거: {sec.source}")

    pending = pending_sections(plan)
    if pending:
        writer.write_block("아직 닫히지 않은 항목")
        for sec in pending:
            writer.write_line("detail", f"{sec.name} — [{sec.status}]")

    writer.save(out_path)


def _meta_table(writer, plan: Plan) -> None:
    """The identifying block, as the form's 통계표."""
    rows = header_rows(plan)
    if rows:
        writer.write_table([["구분", "내용"]] + [[k, v] for k, v in rows])


# ---- CLI --------------------------------------------------------------------


def resolve_format(requested: str, intake: dict) -> str:
    """`auto` follows what the person said they wanted at intake."""
    if requested != "auto":
        return requested
    kind = str(intake.get("doc_kind") or "").strip()
    return "both" if kind in DOC_KINDS_WANTING_WORD else "md"


def main(argv: Optional[list[str]] = None) -> int:
    configure_utf8_stdio()
    args = build_parser().parse_args(argv)

    project = Path(args.project_path).resolve()
    if not project.is_dir():
        print(f"[render_plan_doc] project not found: {project}", file=sys.stderr)
        return 1

    plan_path = project / "plan_spec.md"
    if not plan_path.is_file():
        print(f"[render_plan_doc] plan_spec.md not found at {plan_path} — "
              f"run plan_spec.py --scaffold first", file=sys.stderr)
        return 1

    plan = build_plan(project)
    fmt = resolve_format(args.format, plan.intake)
    out_dir = project / "exports"
    stem = f"{project.name}_{DOC_SUFFIX}"
    written: list[Path] = []

    if fmt in {"md", "both"}:
        out_dir.mkdir(parents=True, exist_ok=True)
        md_path = out_dir / f"{stem}.md"
        md_path.write_text(render_markdown(plan), encoding="utf-8")
        written.append(md_path)

    if fmt in {"docx", "both"}:
        docx_path = out_dir / f"{stem}.docx"
        try:
            render_docx(plan, docx_path, args.form)
            written.append(docx_path)
        except ValueError as exc:
            # A named form that does not exist is always the caller's mistake,
            # never something to fall back from.
            print(f"[render_plan_doc] {exc}", file=sys.stderr)
            return 1
        except RuntimeError as exc:
            # Asked for explicitly: refuse rather than quietly hand back less.
            # Chosen by `auto`: the Markdown is already written, so say what is
            # missing and how to get it instead of failing the run.
            if args.format != "auto":
                print(f"[render_plan_doc] {exc}", file=sys.stderr)
                return 1
            print(f"[render_plan_doc] Word skipped — {exc}", file=sys.stderr)

    pending = pending_sections(plan)
    label = plan.frame.label if plan.frame else "알 수 없는 구성"
    print(f"[render_plan_doc] {label} · {len(plan.sections)}절 · "
          f"닫히지 않은 절 {len(pending)}개", file=sys.stderr)
    for path in written:
        print(str(path))
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Render plan_spec.md into the 기획서 document.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("project_path", help="Path to project directory")
    parser.add_argument(
        "--format", choices=("auto", "md", "docx", "both"), default="auto",
        help="auto follows intake.doc_kind (보고서/둘 다 → both, otherwise md)",
    )
    parser.add_argument(
        "--form", default="auto",
        help="Word report form from templates/report_forms/ (auto = the index default)",
    )
    return parser


if __name__ == "__main__":
    raise SystemExit(main())
