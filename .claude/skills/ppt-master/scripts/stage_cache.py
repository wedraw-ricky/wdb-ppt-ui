#!/usr/bin/env python3
"""
PPT Master - Pre-derivation cache and transition timing

PRD §14 item 7 (E-6): between confirming one artifact and the next one
appearing, minutes pass. Most of that work does not actually depend on what
the user just decided — the flow candidates follow from the frame, the colour
and type candidates follow from intake and the plan. It can be done while the
person is still reading.

Doing it early is only safe if we can tell afterwards whether it still holds.
So the agent records the values it *assumed* while working ahead, and after
the confirmation asks which of them the user changed:

    - nothing changed  -> hand over the pre-derived artifact immediately
    - some changed     -> re-derive only what depends on those, keep the rest

Guessing wrong is the expensive failure here, so the comparison is exact and
a missing stash is always "stale". Working ahead may never make a run wrong;
at worst it wasted work nobody saw.

Usage:
    python3 scripts/stage_cache.py <project> --stash outline --assumed '{"frame":"problem"}'
    python3 scripts/stage_cache.py <project> --check outline --confirmed '{"frame":"problem"}'
    python3 scripts/stage_cache.py <project> --begin outline
    python3 scripts/stage_cache.py <project> --end outline
    python3 scripts/stage_cache.py <project> --report

`--check` exits 0 when the pre-derived work still holds and 1 when it does
not, and either way prints the anchors that moved.

Dependencies:
    None (only uses standard library)
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path
from typing import Optional

CACHE_DIR = ".stage_cache"


def cache_dir(project: Path) -> Path:
    return project / CACHE_DIR


def _stash_path(project: Path, stage: str) -> Path:
    return cache_dir(project) / f"{stage}.json"


def _timing_path(project: Path) -> Path:
    return cache_dir(project) / "timing.json"


def _load(path: Path) -> dict:
    if not path.is_file():
        return {}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {}
    return data if isinstance(data, dict) else {}


def _save(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n",
                   encoding="utf-8")
    tmp.replace(path)


def stash(project: Path, stage: str, assumed: dict,
          *, now: Optional[float] = None) -> Path:
    """Record what the work-ahead assumed, so it can be judged later."""
    path = _stash_path(project, stage)
    _save(path, {"stage": stage, "assumed": assumed,
                 "at": now if now is not None else time.time()})
    return path


def drifted(project: Path, stage: str, confirmed: dict) -> Optional[list[str]]:
    """Anchors whose confirmed value differs from what was assumed.

    ``None`` means there is nothing stashed — no work was done ahead, so there
    is nothing to reuse. An empty list means every assumption held.
    """
    data = _load(_stash_path(project, stage))
    if not data or "assumed" not in data:
        return None
    assumed = data["assumed"]
    keys = set(assumed) | set(confirmed)
    return sorted(k for k in keys if assumed.get(k) != confirmed.get(k))


def mark(project: Path, stage: str, event: str,
         *, now: Optional[float] = None) -> None:
    """Timestamp one end of a transition, so the wait can be measured."""
    path = _timing_path(project)
    data = _load(path)
    data.setdefault(stage, {})[event] = now if now is not None else time.time()
    _save(path, data)


def timings(project: Path) -> list[tuple[str, Optional[float]]]:
    data = _load(_timing_path(project))
    out: list[tuple[str, Optional[float]]] = []
    for stage, marks in sorted(data.items()):
        begin, end = marks.get("begin"), marks.get("end")
        out.append((stage, end - begin if begin and end else None))
    return out


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Work ahead between confirmations, and know when it holds.")
    parser.add_argument("project_path", help="Project directory")
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--stash", metavar="STAGE",
                      help="Record the anchors the work-ahead assumed")
    mode.add_argument("--check", metavar="STAGE",
                      help="Ask whether the pre-derived work still holds")
    mode.add_argument("--begin", metavar="STAGE", help="Start timing a transition")
    mode.add_argument("--end", metavar="STAGE", help="Stop timing a transition")
    mode.add_argument("--report", action="store_true",
                      help="Print how long each transition took")
    parser.add_argument("--assumed", help="JSON object of assumed anchor values")
    parser.add_argument("--confirmed", help="JSON object of confirmed anchor values")
    return parser


def _payload(raw: Optional[str], flag: str) -> dict:
    if not raw:
        raise SystemExit(f"[stage_cache] {flag} requires a JSON object")
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise SystemExit(f"[stage_cache] {flag} is not valid JSON — {exc}")
    if not isinstance(data, dict):
        raise SystemExit(f"[stage_cache] {flag} must be a JSON object")
    return data


def main(argv: Optional[list[str]] = None) -> int:
    args = build_parser().parse_args(argv)
    project = Path(args.project_path).resolve()
    if not project.is_dir():
        print(f"[stage_cache] project not found: {project}", file=sys.stderr)
        return 1

    if args.report:
        rows = timings(project)
        if not rows:
            print("[stage_cache] nothing timed yet")
            return 0
        for stage, seconds in rows:
            shown = f"{seconds:.0f}s" if seconds is not None else "미완료"
            print(f"  {stage:<12} {shown}")
        return 0

    if args.begin or args.end:
        stage = args.begin or args.end
        mark(project, stage, "begin" if args.begin else "end")
        return 0

    if args.stash:
        path = stash(project, args.stash, _payload(args.assumed, "--assumed"))
        print(str(path))
        return 0

    moved = drifted(project, args.check, _payload(args.confirmed, "--confirmed"))
    if moved is None:
        print(f"[stage_cache] STALE — nothing was stashed for '{args.check}'",
              file=sys.stderr)
        return 1
    if not moved:
        print(f"[stage_cache] VALID — every assumption for '{args.check}' held")
        return 0
    print(f"[stage_cache] STALE — the user changed: {', '.join(moved)}",
          file=sys.stderr)
    print("Re-derive only what depends on those; keep the rest.", file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
