#!/usr/bin/env python3
"""
The confirm page has to open before the Strategist has written anything.

The first three screens — interview, plan, outline — come before
recommendations.json exists, and the server used to refuse to start without
it. So the page could show the planning screens only on a project that had
already finished planning: the interview was unreachable from a fresh run.

Two rules, both checked here:

- A project with any planning artifact (intake.json first) may start the
  page without recommendations.json. A bare project still may not.
- `--daemon --wait-planning <name>` starts the page and then blocks on the
  artifact; a plain `--wait-planning` only blocks, as before.

Skipped where Flask is absent (an optional dependency; the suite installs
nothing).

Usage:
    python3 -m unittest discover -s tests
"""
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

SCRIPTS = Path(__file__).resolve().parent.parent / ".claude/skills/ppt-master/scripts"
sys.path.insert(0, str(SCRIPTS))
sys.path.insert(0, str(SCRIPTS / "confirm_ui"))

try:
    import server  # noqa: E402
except ImportError:  # Flask missing
    server = None


@unittest.skipIf(server is None, "Flask is not installed")
class PlanningStageLaunch(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.project = Path(self.tmp.name)

    def tearDown(self):
        self.tmp.cleanup()

    def test_bare_project_still_needs_recommendations(self):
        self.assertFalse(server._planning_underway(self.project))
        rc = server.main([str(self.project), "--daemon", "--no-browser"])
        self.assertEqual(rc, 1)

    def test_intake_alone_opens_the_page(self):
        (self.project / "intake.json").write_text("{}", encoding="utf-8")
        self.assertTrue(server._planning_underway(self.project))
        calls = []
        fake_proc = mock.Mock(pid=4242)
        with mock.patch.object(server, "_launch_background_server",
                               return_value=(fake_proc, 5050, self.project / "log")) as launch, \
             mock.patch.object(server, "_wait_planning",
                               side_effect=lambda p, n, t: calls.append((n, t)) or 0):
            rc = server.main([str(self.project), "--daemon", "--no-browser",
                              "--wait-planning", "intake", "--wait-timeout", "0"])
        self.assertEqual(rc, 0)
        launch.assert_called_once()
        self.assertEqual(calls, [("intake", 0)])

    def test_plain_wait_planning_does_not_launch(self):
        (self.project / "intake.json").write_text("{}", encoding="utf-8")
        with mock.patch.object(server, "_launch_background_server") as launch, \
             mock.patch.object(server, "_wait_planning", return_value=0):
            rc = server.main([str(self.project), "--wait-planning", "intake"])
        self.assertEqual(rc, 0)
        launch.assert_not_called()


if __name__ == "__main__":
    unittest.main()
