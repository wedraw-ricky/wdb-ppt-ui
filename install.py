#!/usr/bin/env python3
"""Point this overlay at a ppt-master install, and (optionally) at the global skill stub.

  python3 install.py --ppt-master ~/dev/slide-master/.claude/skills/ppt-master
  python3 install.py --ppt-master <path> --wire-stub ~/.claude/skills/ppt-master/SKILL.md
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CONFIG = ROOT / "wdb-ui.config.json"
MARKER = "<!-- wdb-confirm-ui -->"


def wire_stub(stub: Path) -> None:
    """Append a launch-override rule to a global skill stub (idempotent)."""
    text = stub.read_text(encoding="utf-8")
    if MARKER in text:
        text = text.split(MARKER)[0].rstrip() + "\n"
    block = f"""
{MARKER}
## Confirm UI override (WDB)

The Strategist confirmation page (SKILL.md Step 4) is served by this overlay
instead of upstream's `scripts/confirm_ui/server.py`. Substitute the launcher
in every Step 4 command — the arguments, the lifecycle, and the
`recommendations.json` / `result.json` contract are unchanged:

    python3 {ROOT / 'server.py'} <project_path> --daemon --wait
    python3 {ROOT / 'server.py'} <project_path> --shutdown

Use the staged three-stage flow by default: write `"stage": "stage1"` into
`recommendations.json`, then re-derive and re-attach with
`--wait-only --wait-stage stage2` and `--wait-only` as SKILL.md Step 4 describes.

## Overlay deck templates

The template card lists upstream's decks composed with this overlay's own, so a
confirmed `template` id may name a deck that does not exist under
`${{SKILL_DIR}}/templates/decks/`. Resolve the Step 3 deferred install against
both roots, upstream first:

    {ROOT / 'decks'}/<deck_id>/

Overlay decks satisfy the same `kind: deck` contract; install them with the same
kind matrix and structured preflight. Never copy one into upstream's tree.
"""
    stub.write_text(text.rstrip() + "\n" + block, encoding="utf-8")
    print(f"[wdb-ui] wired stub: {stub}")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--ppt-master", required=True, help="path to the ppt-master skill dir")
    ap.add_argument("--wire-stub", help="path to a global SKILL.md stub to override")
    args = ap.parse_args()

    skill = Path(args.ppt_master).expanduser().resolve()
    if not (skill / "scripts" / "confirm_ui" / "server.py").is_file():
        print(f"[wdb-ui] not a ppt-master skill dir: {skill}", file=sys.stderr)
        return 1

    CONFIG.write_text(json.dumps({"ppt_master_dir": str(skill)}, indent=2) + "\n", encoding="utf-8")
    print(f"[wdb-ui] config written: {CONFIG}\n           ppt_master_dir = {skill}")

    if args.wire_stub:
        stub = Path(args.wire_stub).expanduser().resolve()
        if not stub.is_file():
            print(f"[wdb-ui] stub not found: {stub}", file=sys.stderr)
            return 1
        wire_stub(stub)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
