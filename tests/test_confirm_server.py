#!/usr/bin/env python3
"""
What the confirm page needs from the server while a person is waiting on it.

Two failures, one root: the page had no way to say it was still there, and the
server had no way to say what it was doing.

Filling in the confirm form makes no requests — a person reads, thinks and
types for minutes — and the watchdog cannot tell that apart from a closed tab.
It shut the server down under a waiting user twice. The heartbeat is the fix,
and it has to work in both directions: hold the server open while the page is
there, and still let it go when the page is gone.

The progress notes are what the waiting screen reads. They are a record of
what happened, never a forecast: a count or a total would be invented, since
nothing here knows how much work is left.

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
sys.path.insert(0, str(SCRIPTS))
sys.path.insert(0, str(SCRIPTS / "confirm_ui"))

import confirm_progress  # noqa: E402

try:
    import server as confirm_server
except ImportError:  # Flask missing
    confirm_server = None


class StageFieldMap(unittest.TestCase):
    """어느 필드가 어느 단계 것인지가 두 언어에 손으로 적혀 있다 (E-8 v1).

    서버는 `CONFIRMED_BY_STAGE` 로 확정 값을 되읽고, 화면은 `PREVIEW_FIELDS` 로
    무엇을 비출지 정한다. 같은 분류인데 파일이 둘이라, 한쪽만 고치면 조용히
    어긋난다 — E-10 과 정확히 같은 모양이므로 여기서 대조한다.

    Flask 없이도 도는 검사다. 이 파일에서 유일하게 서버 실행이 필요 없다.
    """

    API_TS = Path(__file__).resolve().parent.parent / "ui/src/api.ts"

    def preview_fields(self):
        """`PREVIEW_FIELDS` 를 api.ts 에서 그대로 읽는다."""
        import re
        text = self.API_TS.read_text(encoding="utf-8")
        block = re.search(r"PREVIEW_FIELDS[^=]*=\s*\{(.*?)\n\};", text, re.S)
        self.assertIsNotNone(block, "api.ts 에서 PREVIEW_FIELDS 를 못 찾았다")
        out = {}
        for stage, body in re.findall(r"(\d+):\s*\[(.*?)\]", block.group(1), re.S):
            out[int(stage)] = set(re.findall(r'"([^"]+)"', body))
        return out

    @unittest.skipIf(confirm_server is None, "Flask not installed")
    def test_두_언어의_단계_분류가_같다(self):
        server_map = {k: set(v) for k, v in
                      confirm_server.CONFIRMED_BY_STAGE.items()}
        self.assertEqual(server_map, self.preview_fields())

    def test_화면_쪽_분류를_읽을_수_있다(self):
        # 정규식이 조용히 빈 사전을 돌려주면 위 검사가 통과해버린다.
        fields = self.preview_fields()
        self.assertEqual(sorted(fields), [1, 2, 3])
        self.assertIn("canvas", fields[1])


@unittest.skipIf(confirm_server is None, "Flask not installed")
class ConfirmedReadback(unittest.TestCase):
    """확정한 값을 되읽는 길 (E-8 v1). 한 필드를 바꾸려고 처음부터 다시 하는
    일을 없애려면, 먼저 무엇을 확정했는지 볼 수 있어야 한다."""

    def result(self, payload):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        path = Path(tmp.name) / "result.json"
        path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
        return path

    def test_확정한_값을_단계별로_묶어_돌려준다(self):
        got = confirm_server.confirmed_values(self.result({
            "canvas": "16:9", "audience": "행정실장",
            "page_count": 12, "generation_mode": "split",
        }))
        self.assertEqual(got["1"], {"canvas": "16:9", "audience": "행정실장"})
        self.assertEqual(got["2"], {"page_count": 12})
        self.assertEqual(got["3"], {"generation_mode": "split"})

    def test_안_고른_것은_빈_칸으로_남기지_않는다(self):
        got = confirm_server.confirmed_values(self.result({
            "canvas": "16:9", "audience": "", "icons": None, "image_usage": [],
        }))
        self.assertEqual(got, {"1": {"canvas": "16:9"}})

    def test_아직_아무것도_확정_안_했으면_빈_답(self):
        self.assertEqual(confirm_server.confirmed_values(self.result({})), {})

    def test_읽을_수_없는_파일은_오류가_아니라_빈_답(self):
        # 확정 전에 조회하는 것은 흔한 일이라 오류로 만들면 안 된다.
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        path = Path(tmp.name) / "result.json"
        path.write_text("{ 깨짐", encoding="utf-8")
        self.assertEqual(confirm_server.confirmed_values(path), {})
        self.assertEqual(
            confirm_server.confirmed_values(Path(tmp.name) / "없음.json"), {})


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


class ProgressNotes(unittest.TestCase):
    """The waiting screen's only real content. Everything else on it is either
    a loop or a clock."""

    def project(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        root = Path(tmp.name)
        (root / "confirm_ui").mkdir()
        return root

    def test_notes_come_back_in_the_order_they_happened(self):
        root = self.project()
        for i, note in enumerate(["자료 읽는 중", "뼈대 세우는 중", "대본 쓰는 중"]):
            confirm_progress.append_note(root, note, now=1000.0 + i)
        self.assertEqual([n["note"] for n in confirm_progress.read_notes(root, now=1010.0)],
                         ["자료 읽는 중", "뼈대 세우는 중", "대본 쓰는 중"])

    def test_a_note_from_an_earlier_wait_is_dropped(self):
        # Otherwise the page tells the person the agent is doing something it
        # finished before they even got there.
        root = self.project()
        confirm_progress.append_note(root, "지난번 것", now=0.0)
        confirm_progress.append_note(root, "지금 것", now=10_000.0)
        self.assertEqual([n["note"] for n in confirm_progress.read_notes(root, now=10_000.0)],
                         ["지금 것"])

    def test_the_file_does_not_grow_without_bound(self):
        root = self.project()
        for i in range(confirm_progress.MAX_NOTES + 15):
            confirm_progress.append_note(root, f"{i}번", now=1000.0 + i)
        kept = confirm_progress.read_notes(root, now=1000.0 + confirm_progress.MAX_NOTES + 20)
        self.assertEqual(len(kept), confirm_progress.MAX_NOTES)
        self.assertEqual(kept[-1]["note"], f"{confirm_progress.MAX_NOTES + 14}번")

    def test_no_file_is_not_an_error(self):
        self.assertEqual(confirm_progress.read_notes(self.project()), [])

    def test_a_damaged_file_is_not_an_error(self):
        # The page polls this while it is being written. A parse failure must
        # read as "nothing yet", never break the waiting screen.
        root = self.project()
        (root / "confirm_ui" / "progress.json").write_text("{ broken", encoding="utf-8")
        self.assertEqual(confirm_progress.read_notes(root), [])

    def test_an_empty_note_is_refused(self):
        root = self.project()
        self.assertEqual(confirm_progress.main([str(root), "   "]), 1)
        self.assertEqual(confirm_progress.read_notes(root), [])


@unittest.skipIf(confirm_server is None, "Flask not installed")
class ProgressRoute(unittest.TestCase):

    def test_route_reports_ages_not_clock_times(self):
        # The page compares these against its own wait, so a timestamp would
        # mean trusting two clocks to agree.
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        root = Path(tmp.name)
        (root / "confirm_ui").mkdir()
        (root / "project_meta.json").write_text(
            json.dumps({"title": "t", "canvas_format": "ppt169"}), encoding="utf-8")
        confirm_progress.append_note(root, "자료 읽는 중", now=time.time() - 5)
        app = confirm_server.create_app(str(root), idle_timeout=0)
        with app.test_client() as client:
            body = client.get("/api/progress").get_json()
        self.assertEqual(len(body["notes"]), 1)
        self.assertEqual(body["notes"][0]["note"], "자료 읽는 중")
        self.assertGreaterEqual(body["notes"][0]["age_seconds"], 4)
        self.assertNotIn("at", body["notes"][0])

    def test_route_is_quiet_when_nothing_has_happened(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        root = Path(tmp.name)
        (root / "confirm_ui").mkdir()
        app = confirm_server.create_app(str(root), idle_timeout=0)
        with app.test_client() as client:
            self.assertEqual(client.get("/api/progress").get_json(), {"notes": []})


if __name__ == "__main__":
    unittest.main()
