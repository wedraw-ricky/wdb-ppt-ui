#!/usr/bin/env python3
"""
The four judgment gates: canvas mismatch, conversion loss, checker verdict.

Each of these exists because the pipeline once decided something in silence
and the decision was expensive to undo — eight pages drawn against a canvas
the template could not use, three tables that vanished in conversion without
a word, a "0 errors" pass declared off a truncated read. A rule in a prompt
did not stop any of them; these tests hold the code that does.

Both directions matter. A gate that fires on a healthy run blocks the
pipeline as badly as one that never fires, so every fault case here has a
matching clean case.

Usage:
    python3 -m unittest discover -s tests

Dependencies:
    None (standard library only)
"""
import json
import sys
import tempfile
import unittest
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parent.parent / ".claude/skills/ppt-master/scripts"
sys.path.insert(0, str(SCRIPTS))
sys.path.insert(0, str(SCRIPTS / "source_to_md"))

import template_install_preflight as gate  # noqa: E402
from _conversion_profile import (  # noqa: E402
    compare_source_counts,
    write_conversion_profile,
)


class CanvasGate(unittest.TestCase):
    """A deck's Master geometry is fixed to its canvas — installing it onto
    another one promises a re-layout that never happens."""

    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.root = Path(self._tmp.name)
        self.addCleanup(self._tmp.cleanup)

    def project(self, canvas):
        path = self.root / f"proj_{canvas}"
        path.mkdir()
        (path / "project_meta.json").write_text(
            json.dumps({"title": "t", "canvas_format": canvas}), encoding="utf-8")
        return path

    def template(self, canvas, *, flat=False, declare=True):
        path = self.root / f"tpl_{canvas}_{'flat' if flat else 'ws'}"
        spec_dir = path if flat else path / "templates"
        spec_dir.mkdir(parents=True)
        head = "---\nkind: deck\n"
        if declare:
            head += f"canvas_format: {canvas}\n"
        (spec_dir / "design_spec.md").write_text(head + "---\n\n# t\n",
                                                 encoding="utf-8")
        return path

    def test_mismatch_stops_with_exit_2(self):
        code = gate.main([str(self.project("a4")),
                          "--template-path", str(self.template("ppt169"))])
        self.assertEqual(code, 2)

    def test_match_proceeds(self):
        code = gate.main([str(self.project("ppt169")),
                          "--template-path", str(self.template("ppt169"))])
        self.assertEqual(code, 0)

    def test_legacy_flat_package_is_read_the_same_way(self):
        code = gate.main([str(self.project("a4")),
                          "--template-path",
                          str(self.template("ppt169", flat=True))])
        self.assertEqual(code, 2)

    def test_template_without_a_canvas_does_not_block(self):
        # A brand-only package carries identity, not geometry. There is
        # nothing for it to disagree with, and stopping would be a false stop.
        code = gate.main([str(self.project("a4")),
                          "--template-path",
                          str(self.template("ppt169", declare=False))])
        self.assertEqual(code, 0)

    def test_missing_project_meta_is_an_error_not_a_pass(self):
        bare = self.root / "bare"
        bare.mkdir()
        code = gate.main([str(bare), "--template-path",
                          str(self.template("ppt169"))])
        self.assertEqual(code, 1)

    def test_stop_names_both_canvases_and_both_options(self):
        import io
        import contextlib
        buf = io.StringIO()
        with contextlib.redirect_stdout(buf):
            gate.main([str(self.project("a4")), "--template-path",
                       str(self.template("ppt169"))])
        out = buf.getvalue()
        self.assertIn("a4", out)
        self.assertIn("ppt169", out)
        # The two options the confirm UI offers, worded the same way.
        self.assertIn("크기를 템플릿에 맞추기", out)
        self.assertIn("색·서체만 가져오기", out)
        # And the promise that nothing was written.
        self.assertIn("설치하지 않았습니다", out)


class ConversionLoss(unittest.TestCase):
    """A source's tables arriving as prose is invisible from the output alone."""

    def test_everything_lost_is_reported(self):
        found = compare_source_counts({"tables": 3}, {"tables": 0})
        self.assertEqual(len(found), 1)
        self.assertIn("3개 중 0개", found[0])

    def test_half_or_more_lost_is_reported(self):
        self.assertTrue(compare_source_counts({"tables": 4}, {"tables": 2}))

    def test_one_short_is_not_reported(self):
        # A table split across a page break is merged back into one on the
        # way out. Warning about that would stop healthy conversions.
        self.assertEqual(compare_source_counts({"tables": 3}, {"tables": 2}), [])

    def test_equal_counts_are_silent(self):
        self.assertEqual(
            compare_source_counts({"tables": 3, "images": 2},
                                  {"tables": 3, "images": 2}), [])

    def test_more_out_than_in_is_silent(self):
        # The output counter is the more generous of the two; an overcount is
        # not a loss and must not read as one.
        self.assertEqual(compare_source_counts({"tables": 1}, {"tables": 3}), [])

    def test_source_with_no_tables_never_warns(self):
        self.assertEqual(compare_source_counts({"tables": 0}, {"tables": 0}), [])

    def test_absent_source_counts_are_silent(self):
        # An older converter that reports nothing must not start failing.
        self.assertEqual(compare_source_counts(None, {"tables": 0}), [])

    def test_images_are_checked_too(self):
        found = compare_source_counts({"images": 5}, {"images": 0})
        self.assertEqual(len(found), 1)
        self.assertIn("이미지", found[0])

    def test_profile_records_both_sides_and_the_warning(self):
        with tempfile.TemporaryDirectory() as tmp:
            md = Path(tmp) / "out.md"
            md.write_text("# 제목\n\n본문만 남았습니다.\n", encoding="utf-8")
            profile = json.loads(
                write_conversion_profile(
                    input_path=str(Path(tmp) / "src.pdf"),
                    markdown_path=md,
                    converter="pdf_to_md.py",
                    conversion_type="pdf",
                    source_counts={"tables": 3, "images": 0},
                ).read_text(encoding="utf-8"))
        self.assertEqual(profile["source"]["counts"]["tables"], 3)
        self.assertEqual(profile["markdown"]["table_count"], 0)
        self.assertEqual(len(profile["warnings"]), 1)

    def test_healthy_profile_carries_the_counts_and_no_warning(self):
        # A profile with no warning has to be positive evidence, not just an
        # absence — so the counts are recorded either way.
        with tempfile.TemporaryDirectory() as tmp:
            md = Path(tmp) / "out.md"
            md.write_text("# 제목\n\n| a | b |\n|---|---|\n| 1 | 2 |\n",
                          encoding="utf-8")
            profile = json.loads(
                write_conversion_profile(
                    input_path=str(Path(tmp) / "src.pdf"),
                    markdown_path=md,
                    converter="pdf_to_md.py",
                    conversion_type="pdf",
                    source_counts={"tables": 1, "images": 0},
                ).read_text(encoding="utf-8"))
        self.assertEqual(profile["source"]["counts"], {"tables": 1, "images": 0})
        self.assertEqual(profile["warnings"], [])


class CheckerVerdict(unittest.TestCase):
    """A pass declared off a truncated read is how deck-level errors got missed."""

    def checker(self):
        import svg_quality_checker
        return svg_quality_checker.SVGQualityChecker()

    def test_clean_run_reads_pass(self):
        c = self.checker()
        c.summary.update({"total": 8, "passed": 8, "warnings": 0, "errors": 0})
        line = c.verdict_line()
        self.assertIn("PASS", line)
        self.assertIn("errors: 0", line)

    def test_deck_level_errors_are_counted_apart_from_page_errors(self):
        c = self.checker()
        c._illustration_issues.append(("error", "strategy", "x"))
        c._pptx_structure_issues.append(("error", "y"))
        c._animation_issues.append(("warning", "z"))
        self.assertEqual(c.deck_level_counts(), (2, 1))

    def test_verdict_splits_the_two_kinds(self):
        # The failure this guards: every page passes, the deck does not, and
        # the deck-level lines print after the pages a short read ever sees.
        c = self.checker()
        c.summary.update({"total": 8, "passed": 8, "warnings": 0, "errors": 0})
        c._pptx_structure_issues.append(("error", "duplicate layout key"))
        c.print_summary()  # folds deck issues into the summary counters
        line = c.verdict_line()
        self.assertIn("FAIL", line)
        self.assertIn("deck-level 1", line)
        self.assertIn("page-level 0", line)

    def test_verdict_prints_to_stderr_so_a_pipe_cannot_hide_it(self):
        import contextlib
        import io
        c = self.checker()
        c.summary.update({"total": 3, "passed": 2, "warnings": 0, "errors": 1})
        err = io.StringIO()
        with contextlib.redirect_stdout(io.StringIO()), \
                contextlib.redirect_stderr(err):
            c.print_summary()
        self.assertIn("[VERDICT]", err.getvalue())

    def test_verdict_appears_at_both_ends_of_the_summary(self):
        import contextlib
        import io
        c = self.checker()
        c.summary.update({"total": 3, "passed": 3, "warnings": 0, "errors": 0})
        out = io.StringIO()
        with contextlib.redirect_stdout(out), \
                contextlib.redirect_stderr(io.StringIO()):
            c.print_summary()
        body = out.getvalue()
        self.assertEqual(body.count("[VERDICT]"), 2)
        self.assertTrue(body.startswith("[VERDICT]"))
        self.assertTrue(body.rstrip().endswith(c.verdict_line()))


if __name__ == "__main__":
    unittest.main()
