#!/usr/bin/env python3
"""
The confirm server's idle watchdog, and the heartbeat that holds it off.

Filling in the confirm form makes no requests — a person reads, thinks and
types for minutes — and the watchdog cannot tell that apart from a closed tab.
It shut the server down under a waiting user twice. The heartbeat is the fix,
and it has to work in both directions: hold the server open while the page is
there, and still let it go when the page is gone.

Skipped where Flask is absent; it is an optional dependency of this repository
(`preflight.py` reports it), and the suite installs nothing.

Usage:
    python3 -m unittest discover -s tests

Dependencies:
    Flask (skipped without it)
"""
import json
import sys
import tempfile
import time
import unittest
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parent.parent / ".claude/skills/ppt-master/scripts"
sys.path.insert(0, str(SCRIPTS / "confirm_ui"))

try:
    import server as confirm_server
except ImportError:  # Flask missing
    confirm_server = None


@unittest.skipIf(confirm_server is None, "Flask not installed")
class Heartbeat(unittest.TestCase):

    def app(self, idle_timeout=0):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        root = Path(tmp.name)
        (root / ".confirm").mkdir()
        (root / "project_meta.json").write_text(
            json.dumps({"title": "t", "canvas_format": "ppt169"}), encoding="utf-8")
        app = confirm_server.create_app(str(root), idle_timeout=idle_timeout)
        return app

    def test_heartbeat_answers(self):
        app = self.app()
        with app.test_client() as client:
            res = client.post("/api/heartbeat")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.get_json()["status"], "ok")

    def test_heartbeat_resets_the_idle_clock(self):
        # This is the whole fix: the watchdog measures time since the last
        # request, and the ping is a request.
        app = self.app()
        app.config["LAST_REQUEST_TIME"] = time.time() - 10_000
        with app.test_client() as client:
            client.post("/api/heartbeat")
        self.assertLess(time.time() - app.config["LAST_REQUEST_TIME"], 5)

    def test_heartbeat_is_not_cached(self):
        # A cached 200 would keep answering after the server is gone, and the
        # page would never notice it had been cut off.
        app = self.app()
        with app.test_client() as client:
            res = client.post("/api/heartbeat")
        self.assertEqual(res.headers.get("Cache-Control"), "no-store")

    def test_heartbeat_refuses_get(self):
        app = self.app()
        with app.test_client() as client:
            self.assertEqual(client.get("/api/heartbeat").status_code, 405)

    def test_heartbeat_reads_nothing_from_disk(self):
        # The point of a separate route from /api/health: a ping every 30s for
        # an afternoon must not re-read and re-parse the project each time.
        app = self.app()
        confirm_dir = Path(app.config["PROJECT_PATH"]) / ".confirm"
        for stray in confirm_dir.iterdir():
            stray.unlink()
        with app.test_client() as client:
            self.assertEqual(client.post("/api/heartbeat").status_code, 200)


if __name__ == "__main__":
    unittest.main()
