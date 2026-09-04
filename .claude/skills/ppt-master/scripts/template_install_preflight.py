#!/usr/bin/env python3
"""
PPT Master - Template Install Preflight

Compares the project's canvas format with the template's before a template is
installed, and stops the install when the two disagree. A deck template's
Master/Layout geometry is fixed to the canvas it was drawn for, so installing
it onto a different canvas promises a re-layout that never happens — the pages
get drawn and then thrown away. This runs before the first file is copied, so
a stop leaves the project exactly as it was.

Usage:
    python3 scripts/template_install_preflight.py <project_path> --template <deck_id>
    python3 scripts/template_install_preflight.py <project_path> --template-path <workspace_path>

Examples:
    python3 scripts/template_install_preflight.py projects/20260904_campaign --template apple
    python3 scripts/template_install_preflight.py projects/x --template-path templates/decks/apple

Exit codes:
    0  canvas matches (or the template declares none) — install may proceed
    2  canvas mismatch — install MUST NOT run; ask the user which option they want
    1  bad arguments / unreadable project or template

Dependencies:
    None (only uses standard library)
"""

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Optional, Tuple

TOOLS_DIR = Path(__file__).resolve().parent
if str(TOOLS_DIR) not in sys.path:
    sys.path.insert(0, str(TOOLS_DIR))

from console_encoding import configure_utf8_stdio  # noqa: E402

try:
    from project_utils import CANVAS_FORMATS, normalize_canvas_format
except ImportError:  # pragma: no cover - project_utils always ships alongside
    CANVAS_FORMATS = {}

    def normalize_canvas_format(value: str) -> str:
        return value

SKILL_DIR = TOOLS_DIR.parent
DECKS_DIR = SKILL_DIR / "templates" / "decks"
DECKS_INDEX = DECKS_DIR / "decks_index.json"

# `canvas_format: ppt169` inside a design_spec.md frontmatter block.
_FRONTMATTER_CANVAS = re.compile(
    r"^canvas_format:\s*[\"']?([A-Za-z0-9_-]+)[\"']?\s*$", re.M)


def canvas_label(fmt: str) -> str:
    """Human label for a canvas id — '16:9 (1280×720)', or the id itself."""
    spec = CANVAS_FORMATS.get(fmt)
    if not spec:
        return fmt
    ratio = spec.get("aspect_ratio", "")
    dims = spec.get("dimensions", "")
    if ratio and dims:
        return f"{fmt} — {ratio} ({dims})"
    return f"{fmt} — {ratio or dims}".strip(" —")


def read_project_canvas(project_path: Path) -> Optional[str]:
    """Canvas the project was created with, from project_meta.json."""
    meta = project_path / "project_meta.json"
    if not meta.is_file():
        return None
    try:
        data = json.loads(meta.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    value = data.get("canvas_format")
    return normalize_canvas_format(value) if value else None


def read_template_canvas(path: Path) -> Optional[str]:
    """Canvas a template workspace declares in its design_spec.md frontmatter.

    Both packaging shapes are accepted: the current `<root>/templates/
    design_spec.md` and the legacy flat `<root>/design_spec.md`.
    """
    for candidate in (path / "templates" / "design_spec.md",
                      path / "design_spec.md"):
        if not candidate.is_file():
            continue
        try:
            head = candidate.read_text(encoding="utf-8")[:4000]
        except OSError:
            continue
        match = _FRONTMATTER_CANVAS.search(head)
        if match:
            return normalize_canvas_format(match.group(1))
    return None


def read_deck_canvas(deck_id: str) -> Tuple[Optional[str], Optional[Path]]:
    """Canvas of a catalog deck, from decks_index.json then its workspace."""
    workspace = DECKS_DIR / deck_id
    if DECKS_INDEX.is_file():
        try:
            index = json.loads(DECKS_INDEX.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            index = {}
        entry = index.get(deck_id) or {}
        value = entry.get("canvas_format")
        if value:
            return normalize_canvas_format(value), workspace
    if workspace.is_dir():
        return read_template_canvas(workspace), workspace
    return None, None


def report_mismatch(name: str, project_canvas: str, template_canvas: str) -> None:
    """Print the stop notice and the two options, in the user's language.

    The wording matches the confirm UI's own guard (`ui/src/hero.tsx`) so the
    user does not meet two different explanations of the same situation.
    """
    template_dim = (CANVAS_FORMATS.get(template_canvas) or {}).get("dimensions", "")
    print()
    print("[정지] 캔버스 크기가 템플릿과 다릅니다 — 설치하지 않았습니다.")
    print()
    print(f"  프로젝트 캔버스 : {canvas_label(project_canvas)}")
    print(f"  템플릿 {name} : {canvas_label(template_canvas)}")
    print()
    print("  크기가 다르면 템플릿의 페이지 구조를 쓸 수 없습니다. 시안의 자리 배치와")
    print("  슬라이드 마스터는 원래 크기에 고정돼 있어서, 다른 크기에서는 색·서체·괘선만")
    print("  가져오고 지면은 처음부터 새로 짭니다. 결과물에 슬라이드 마스터가 없는")
    print("  평면 문서로 나옵니다.")
    print()
    print("  두 가지 중에서 고르셔야 합니다.")
    print(f"    1) 크기를 템플릿에 맞추기 ({template_dim or template_canvas})")
    print("       — 프로젝트를 그 크기로 다시 만들고 구조까지 그대로 씁니다")
    print("    2) 구조 없이 색·서체만 가져오기")
    print("       — 템플릿 구조는 쓰지 않고 자유 배치(flat)로 진행합니다")
    print()
    print("  프로젝트는 그대로입니다. templates/ 에 아무것도 쓰지 않았습니다.")
    print()


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Stop a template install when the canvas does not match.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("project_path", help="Project directory to install into")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--template", help="Deck id from templates/decks/")
    group.add_argument("--template-path", help="Explicit template workspace path")
    return parser


def main(argv: Optional[list[str]] = None) -> int:
    configure_utf8_stdio()
    args = build_parser().parse_args(argv)

    project_path = Path(args.project_path)
    if not project_path.is_dir():
        print(f"[ERROR] 프로젝트 폴더가 없습니다: {project_path}", file=sys.stderr)
        return 1

    project_canvas = read_project_canvas(project_path)
    if not project_canvas:
        print("[ERROR] project_meta.json 에서 캔버스를 읽지 못했습니다. "
              "프로젝트를 project_manager.py 로 만들었는지 확인해 주세요.",
              file=sys.stderr)
        return 1

    if args.template:
        name = args.template
        template_canvas, workspace = read_deck_canvas(name)
        if workspace is None:
            print(f"[ERROR] 덱을 찾지 못했습니다: {name}", file=sys.stderr)
            return 1
    else:
        workspace = Path(args.template_path)
        name = workspace.name
        if not workspace.is_dir():
            print(f"[ERROR] 템플릿 폴더가 없습니다: {workspace}", file=sys.stderr)
            return 1
        template_canvas = read_template_canvas(workspace)

    if not template_canvas:
        # A brand-only package may legitimately declare no canvas: it carries
        # identity, not geometry, so there is nothing to disagree with.
        print(f"[OK] {name} 은 캔버스를 지정하지 않습니다 — 설치를 진행하세요.")
        return 0

    if template_canvas != project_canvas:
        report_mismatch(name, project_canvas, template_canvas)
        return 2

    print(f"[OK] 캔버스가 같습니다 ({canvas_label(project_canvas)}) — "
          "설치를 진행하세요.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
