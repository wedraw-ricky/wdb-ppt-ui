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
import time
from pathlib import Path

HERE = Path(__file__).resolve()
ROOT = HERE.parent
OUR_STATIC = ROOT / "static"

_ENV_VAR = "WDB_UI_PPT_MASTER_DIR"
OUR_DECKS = ROOT / "decks"
MERGED_DECKS = ROOT / ".decks-merged"


def resolve_skill_dir() -> Path:
    """Locate the ppt-master skill directory.

    The pipeline now lives inside this repository, so the default needs no
    configuration. The env var stays as an escape hatch for pointing a checkout
    at a pipeline somewhere else.
    """
    candidates: list[Path] = []
    env = os.environ.get(_ENV_VAR)
    if env:
        candidates.append(Path(env).expanduser())
    candidates.append(ROOT / ".claude" / "skills" / "ppt-master")

    for cand in candidates:
        if (cand / "scripts" / "confirm_ui" / "server.py").is_file():
            return cand.resolve()

    tried = "\n".join(f"  - {c}" for c in candidates)
    raise SystemExit(
        "[wdb-ui] could not locate the ppt-master pipeline.\n"
        f"Tried:\n{tried}\n\n"
        "The pipeline ships with this repository at .claude/skills/ppt-master.\n"
        "A missing copy usually means an incomplete clone — re-clone, or set\n"
        f"{_ENV_VAR}=<path to .claude/skills/ppt-master> to point elsewhere."
    )


def compose_decks(upstream_decks: Path) -> Path:
    """Symlink upstream's decks and ours into one directory with a merged index.

    Upstream ships its deck library inside the skill; adding a deck there would
    dirty a repository we deliberately never modify. Composing instead keeps the
    overlay's decks in this repo, where they are versioned and shareable, while
    the confirm page still sees one flat library.
    """
    if not OUR_DECKS.is_dir():
        return upstream_decks

    MERGED_DECKS.mkdir(parents=True, exist_ok=True)
    for stale in MERGED_DECKS.iterdir():
        if stale.is_symlink() or stale.is_file():
            stale.unlink()

    index: dict = {}
    up_index = upstream_decks / "decks_index.json"
    if up_index.is_file():
        try:
            index = json.loads(up_index.read_text(encoding="utf-8"))
        except ValueError as exc:
            print(f"[wdb-ui] upstream decks_index.json unreadable: {exc}", file=sys.stderr)
    decks = index.get("decks") if isinstance(index.get("decks"), dict) else index

    for src in (upstream_decks, OUR_DECKS):
        for deck in sorted(p for p in src.iterdir() if p.is_dir()):
            (MERGED_DECKS / deck.name).symlink_to(deck, target_is_directory=True)

    # Overlay decks describe themselves in their own design_spec.md frontmatter.
    for deck in sorted(p for p in OUR_DECKS.iterdir() if p.is_dir()):
        spec = deck / "templates" / "design_spec.md"
        if not spec.is_file():
            continue
        fm: dict[str, str] = {}
        text = spec.read_text(encoding="utf-8")
        if text.startswith("---"):
            for line in text.split("---", 2)[1].splitlines():
                if ":" in line:
                    k, _, v = line.partition(":")
                    fm[k.strip()] = v.strip().strip('"')
        decks[deck.name] = {
            "summary": fm.get("summary", deck.name),
            "canvas_format": fm.get("canvas_format", "ppt169"),
            "page_count": int(fm.get("page_count", "0") or 0),
            "primary_color": fm.get("primary_color", "#000000"),
            "defaults": {"mode": "pyramid", "visual_style": "editorial",
                         "delivery_purpose": "balanced"},
        }

    merged = {**index, "decks": decks} if "decks" in index else decks
    (MERGED_DECKS / "decks_index.json").write_text(
        json.dumps(merged, ensure_ascii=False, indent=2), encoding="utf-8")
    return MERGED_DECKS


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

    # (4) deck library -> upstream's decks composed with ours
    merged = compose_decks(Path(up._DECKS_DIR))
    up._DECKS_DIR = merged
    up._DECKS_INDEX_PATH = merged / "decks_index.json"

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

        # (5) 채팅이 이 프로젝트를 기다리고 있는가. 파이프라인이 --wait 로 띄우면
        # 부모가 표식을 남긴다(아래 main). 화면은 이걸 보고 «채팅에서 만들고
        # 있어요» 와 «지금은 화면만 떠 있어요» 를 가른다. 손으로 띄운 서버에서
        # 버튼을 누르고 채팅에 아무 변화가 없는 것을 화면이 고장처럼 보이게
        # 하지 않기 위해서다.
        project = Path(args[0] if args else kwargs.get("project_dir", "."))

        @app.route("/api/agent")
        def agent_waiting():
            from flask import jsonify
            marker = project / up.CONFIRM_DIR_NAME / AGENT_MARKER
            info = {"waiting": False, "what": None, "since": None}
            if marker.is_file():
                try:
                    data = json.loads(marker.read_text(encoding="utf-8"))
                    os.kill(int(data.get("pid", 0)), 0)
                    info = {"waiting": True, "what": data.get("what"), "since": data.get("since")}
                except (ValueError, OSError, ProcessLookupError):
                    info["stale"] = True
            resp = jsonify(info)
            resp.headers["Cache-Control"] = "no-store"
            return resp

        return app

    up.create_app = create_app
    return up


AGENT_MARKER = "agent_waiting.json"


def _waiting_what(argv: list[str]) -> str | None:
    """What this (parent) process is waiting for, or None when it is not a waiting launch."""
    if "--wait-planning" in argv:
        i = argv.index("--wait-planning")
        return "planning:" + (argv[i + 1] if i + 1 < len(argv) else "?")
    if "--wait" in argv or "--wait-only" in argv:
        return "result"
    return None


def main(argv: list[str] | None = None) -> int:
    argv = sys.argv[1:] if argv is None else argv
    up = build()
    what = _waiting_what(argv)
    positional = [a for a in argv if not a.startswith("-")]
    if what is None or not positional:
        return up.main(argv)
    # 기다리는 부모(파이프라인)다. 표식을 남기고, 끝나면 지운다.
    marker = Path(positional[0]) / up.CONFIRM_DIR_NAME / AGENT_MARKER
    try:
        marker.parent.mkdir(parents=True, exist_ok=True)
        marker.write_text(json.dumps({"pid": os.getpid(), "what": what,
                                      "since": time.strftime("%Y-%m-%dT%H:%M:%S")}),
                          encoding="utf-8")
    except OSError:
        pass
    try:
        return up.main(argv)
    finally:
        try:
            marker.unlink()
        except OSError:
            pass


if __name__ == "__main__":
    raise SystemExit(main())
