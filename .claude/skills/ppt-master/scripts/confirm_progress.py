#!/usr/bin/env python3
"""
PPT Master - Confirm UI Progress Note

Record one line about what is happening right now, so the person watching the
confirm page can see the wait moving. Between confirming a stage and the next
one appearing, several minutes can pass with a single unchanging label on
screen — the screen reads as frozen and the question becomes "왜 이렇게 오래
걸려".

Notes are what already happened, never what is left. Nothing here measures the
agent's remaining work, so nothing may imply a total or a percentage.

Usage:
    python3 scripts/confirm_progress.py <project_path> "<한 줄>"

Examples:
    python3 scripts/confirm_progress.py projects/x "자료 3건 읽는 중"
    python3 scripts/confirm_progress.py projects/x "덱 템플릿 설치 중"

Dependencies:
    None (only uses standard library)
"""

import argparse
import json
import os
import sys
import time
from pathlib import Path
from typing import Optional

TOOLS_DIR = Path(__file__).resolve().parent
if str(TOOLS_DIR) not in sys.path:
    sys.path.insert(0, str(TOOLS_DIR))

from console_encoding import configure_utf8_stdio  # noqa: E402

CONFIRM_DIR_NAME = 'confirm_ui'
PROGRESS_NAME = 'progress.json'

# Enough to show the shape of a wait; old notes stop being interesting once the
# page has scrolled past them, and an unbounded file would grow all session.
MAX_NOTES = 20

# A note this old belongs to an earlier wait. Reading it back would tell the
# person the agent is doing something it finished ten minutes ago.
STALE_AFTER = 1800


def progress_path(project_path: Path) -> Path:
    return project_path / CONFIRM_DIR_NAME / PROGRESS_NAME


def read_notes(project_path: Path, *, now: Optional[float] = None) -> list[dict]:
    """Return the recorded notes, oldest first, with a stale cutoff applied."""
    path = progress_path(project_path)
    try:
        data = json.loads(path.read_text(encoding='utf-8'))
    except (OSError, json.JSONDecodeError):
        return []
    notes = data.get('notes') if isinstance(data, dict) else None
    if not isinstance(notes, list):
        return []
    clock = time.time() if now is None else now
    fresh = []
    for note in notes:
        if not isinstance(note, dict) or not note.get('note'):
            continue
        try:
            at = float(note.get('at', 0))
        except (TypeError, ValueError):
            continue
        if clock - at > STALE_AFTER:
            continue
        fresh.append({'note': str(note['note']), 'at': at})
    return fresh[-MAX_NOTES:]


def append_note(project_path: Path, text: str, *, now: Optional[float] = None) -> Path:
    """Append one note, keeping the file readable at any moment.

    Written through a temporary file and renamed: the page polls this while it
    is being written, and a half-written file would show as no progress at all.
    """
    clock = time.time() if now is None else now
    notes = read_notes(project_path, now=clock)
    notes.append({'note': text, 'at': clock})
    path = progress_path(project_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(f'.{path.name}.{os.getpid()}.tmp')
    try:
        tmp.write_text(
            json.dumps({'notes': notes[-MAX_NOTES:]}, ensure_ascii=False, indent=2),
            encoding='utf-8',
        )
        os.replace(tmp, path)
    finally:
        try:
            tmp.unlink(missing_ok=True)
        except OSError:
            pass
    return path


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Record one progress line for the confirm page.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("project_path", help="Project directory")
    parser.add_argument("note", help="One short Korean line — what is happening now")
    return parser


def main(argv: Optional[list[str]] = None) -> int:
    configure_utf8_stdio()
    args = build_parser().parse_args(argv)

    project_path = Path(args.project_path)
    if not project_path.is_dir():
        print(f"[ERROR] 프로젝트 폴더가 없습니다: {project_path}", file=sys.stderr)
        return 1

    text = args.note.strip()
    if not text:
        print("[ERROR] 빈 줄은 기록하지 않습니다.", file=sys.stderr)
        return 1

    append_note(project_path, text)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
