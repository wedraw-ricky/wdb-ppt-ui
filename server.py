#!/usr/bin/env python3
"""WDB Confirm UI — a drop-in front-end for the ppt-master Strategist confirm page.

Upstream (`byungjunjang/slide-master`) is never modified. This entry point imports
upstream's confirm server, redirects three things at it, and hands control straight
back so every lifecycle guarantee — lock file, port search, --daemon/--wait/
--shutdown, the /api/* contract, the live catalog sync — is inherited verbatim.

The three redirects:

  1. ``server.__file__``   upstream's ``_launch_background_server`` spawns the child
                           with ``Path(__file__).resolve()``. Every other ``__file__``
                           use in that module is an import-time constant, so
                           reassigning it after import steers ONLY the child spawn —
                           the child becomes this file, and the patches below apply
                           there too.
  2. ``_CATALOGS_PATH``    module-level constant; must be pointed at our catalogs.json
                           or /api/catalogs would keep serving upstream's copy.
  3. ``app.static_folder`` plus a static view that falls back to upstream, so we ship
                           only the files we actually override (style_previews/ and
                           friends keep coming from upstream and stay up to date).
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

HERE = Path(__file__).resolve()
ROOT = HERE.parent
OUR_STATIC = ROOT / "static"

_ENV_VAR = "WDB_UI_PPT_MASTER_DIR"
_CONFIG = ROOT / "wdb-ui.config.json"


def resolve_skill_dir() -> Path:
    """Locate the ppt-master skill directory (the real one, not a global stub)."""
    candidates: list[Path] = []
    env = os.environ.get(_ENV_VAR)
    if env:
        candidates.append(Path(env).expanduser())
    if _CONFIG.is_file():
        try:
            raw = json.loads(_CONFIG.read_text(encoding="utf-8")).get("ppt_master_dir")
            if raw:
                candidates.append(Path(raw).expanduser())
        except (OSError, ValueError) as exc:
            print(f"[wdb-ui] ignoring unreadable {_CONFIG.name}: {exc}", file=sys.stderr)

    for cand in candidates:
        if (cand / "scripts" / "confirm_ui" / "server.py").is_file():
            return cand.resolve()

    tried = "\n".join(f"  - {c}" for c in candidates) or "  (none configured)"
    raise SystemExit(
        "[wdb-ui] could not locate the ppt-master skill directory.\n"
        f"Tried:\n{tried}\n\n"
        f"Fix it by running:  python3 {ROOT / 'install.py'} --ppt-master <path>\n"
        f"or by exporting {_ENV_VAR}=<path to .claude/skills/ppt-master>"
    )


def build() -> "object":
    """Import upstream's confirm server and apply the three redirects."""
    skill_dir = resolve_skill_dir()
    scripts_dir = skill_dir / "scripts"
    if str(scripts_dir) not in sys.path:
        sys.path.insert(0, str(scripts_dir))

    from confirm_ui import server as up  # noqa: E402  (path set above)
    from flask import send_from_directory  # noqa: E402

    upstream_static = Path(up.__file__).resolve().parent / "static"

    # (1) child spawn -> this file
    up.__file__ = str(HERE)
    # (2) /api/catalogs -> our catalogs.json
    up._CATALOGS_PATH = OUR_STATIC / "catalogs.json"

    # (3) static files -> ours, falling back to upstream
    _orig_create_app = up.create_app

    def create_app(*args, **kwargs):
        app = _orig_create_app(*args, **kwargs)
        app.static_folder = str(OUR_STATIC)

        def _static(filename: str):
            local = OUR_STATIC / filename
            base = OUR_STATIC if local.is_file() else upstream_static
            return send_from_directory(str(base), filename)

        app.view_functions["static"] = _static
        return app

    up.create_app = create_app
    return up


def main(argv: list[str] | None = None) -> int:
    up = build()
    return up.main(sys.argv[1:] if argv is None else argv)


if __name__ == "__main__":
    raise SystemExit(main())
