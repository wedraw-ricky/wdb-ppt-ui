#!/usr/bin/env python3
"""
Contract tests for the WeDraw planning stage.

Covers `plan_spec.py`, `outline.py`, `report_form.py` and `render_plan_doc.py` —
the code CLAUDE.md's *What is whose* lists as ours. The vendored pipeline is out
of scope and stays untested (docs/rules/code-style.md §11).

Every case here is a contract someone can read off a reference document, and the
two marked `# regression` are defects that reached a rendered document.

Usage:
    python3 -m unittest discover -s tests

Dependencies:
    None (standard library only; python-docx is never imported)
"""
import sys
import unittest
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parent.parent / ".claude/skills/ppt-master/scripts"
sys.path.insert(0, str(SCRIPTS))

import outline  # noqa: E402
import plan_spec  # noqa: E402
import render_plan_doc  # noqa: E402
import report_form  # noqa: E402


SPEC = """---
frame: report
purpose: 성과 보고
---

# 캠페인 결과

## 1. 하기로 한 것
status: 확인 필요
heading: 캠페인 추진 배경 및 목표 수준

## 2. 한 것
status: 확정
heading: 시범 현장 조사
▢ 작업자 1,015명 대상 조사
◦ 종합 평점 3.32점 → 3.86점
* 사전 n=468명

source: sources/survey.md:L12-L88

## 별첨 1. 원자료
| 문항 | 전 | 후 |
|---|---|---|
| 보호구 | 3.82 | 4.28 |
"""


class PlanSpecParsing(unittest.TestCase):
    def setUp(self):
        self.meta, self.sections = plan_spec.parse(SPEC)

    def test_status_keeps_its_space(self):
        # regression: `\S+` stopped at the space, so "확인 필요" parsed as "확인"
        # and every downstream comparison against the full string went dead.
        self.assertEqual(self.sections[0].status, "확인 필요")

    def test_heading_is_read_and_kept_out_of_the_body(self):
        self.assertEqual(self.sections[0].heading, "캠페인 추진 배경 및 목표 수준")
        self.assertNotIn("heading:", self.sections[1].body)
        self.assertNotIn("status:", self.sections[1].body)
        self.assertNotIn("source:", self.sections[1].body)

    def test_appendix_is_not_a_frame_section(self):
        self.assertEqual([s.name for s in self.sections], ["하기로 한 것", "한 것"])

    def test_appendix_is_returned_separately(self):
        _, blocks = plan_spec.split_appendix(SPEC)
        self.assertEqual([t for t, _ in blocks], ["별첨 1. 원자료"])
        self.assertIn("| 보호구 | 3.82 | 4.28 |", blocks[0][1])

    def test_a_spec_without_an_appendix_is_unchanged(self):
        text = "## 1. 현상\nstatus: 확정\n본문\n"
        self.assertEqual(plan_spec.split_appendix(text), (text, []))


class BodyMarkup(unittest.TestCase):
    def levels(self, body):
        return [level for level, _ in report_form.parse_body(body)]

    def test_option_line_is_a_핵심_not_a_각주(self):
        # regression: the 각주 rule matched the first `*` of `**1안**`, so both
        # option lines rendered as footnotes carrying a stray asterisk.
        blocks = report_form.parse_body("**1안** 전사 확대\n**2안** 권역 확대")
        self.assertEqual([lvl for lvl, _ in blocks], ["core", "core"])
        self.assertTrue(blocks[0][1].startswith("**1안**"))

    def test_marker_levels(self):
        self.assertEqual(
            self.levels("▢ 핵심\n◦ 세부\n* 각주\n※ 참고"),
            ["core", "detail", "note", "note"],
        )

    def test_both_marker_vocabularies_are_accepted(self):
        self.assertEqual(self.levels("□ 핵심\n─ 세부"), ["core", "detail"])

    def test_table_rows_become_one_block_without_the_separator(self):
        blocks = report_form.parse_body("| a | b |\n|---|---|\n| 1 | 2 |")
        self.assertEqual(len(blocks), 1)
        self.assertEqual(blocks[0][0], "table")
        self.assertEqual(blocks[0][1], [["a", "b"], ["1", "2"]])

    def test_an_unmarked_body_still_opens_on_a_핵심(self):
        self.assertEqual(self.levels("첫 문단\n\n둘째 문단"), ["core", "detail"])

    def test_soft_wrapped_lines_join_into_one_paragraph(self):
        blocks = report_form.parse_body("앞 줄\n뒤 줄")
        self.assertEqual(blocks, [("core", "앞 줄 뒤 줄")])


class InlineMarkup(unittest.TestCase):
    def roles(self, text, **kw):
        return report_form._runs(text, **kw)

    def bold(self, text, **kw):
        return [c for c, role in self.roles(text, **kw) if role == "bold"]

    def test_a_figure_carries_its_unit(self):
        self.assertEqual(self.bold("18.50건 기록"), ["18.50건"])

    def test_a_bare_numeral_in_prose_is_left_alone(self):
        self.assertEqual(self.bold("1공구 - 3공구"), [])

    def test_a_bare_numeral_in_a_table_cell_is_the_value(self):
        self.assertEqual(self.bold("3.82", bare=True), ["3.82"])

    def test_an_arrow_joins_the_figure(self):
        self.assertEqual(self.bold("▲0.79점 상승"), ["▲0.79점"])

    def test_direction_is_read_from_the_author_not_the_number(self):
        self.assertIn(("▼5건", "improve"), self.roles("{+▼5건} 감소"))
        self.assertIn(("▲6.14%p", "worsen"), self.roles("{-▲6.14%p} 증가"))

    def test_a_missing_value_becomes_a_badge(self):
        self.assertIn(("확인 필요: 예산", "badge"), self.roles("[확인 필요: 예산]"))

    def test_a_각주_path_is_written_untouched(self):
        text = "근거: sources/survey.md:L12-L88"
        self.assertEqual(self.roles(text, figures=False), [(text, "")])

    def test_the_markdown_draft_drops_the_word_only_markup(self):
        self.assertEqual(
            report_form.strip_markup("종합 {+▲0.54점} · [확인 필요: 예산]"),
            "종합 ▲0.54점 · [확인 필요: 예산]",
        )


class Forms(unittest.TestCase):
    def test_both_shipped_forms_load(self):
        for name in ("bok", "khnp"):
            self.assertEqual(report_form.load_form(name)["id"], name)

    def test_auto_resolves_through_the_index(self):
        self.assertIn(report_form.load_form("auto")["id"], {"bok", "khnp"})

    def test_an_unknown_form_names_the_ones_that_exist(self):
        with self.assertRaises(ValueError) as caught:
            report_form.load_form("nope")
        self.assertIn("bok", str(caught.exception))
        self.assertIn("khnp", str(caught.exception))

    def test_every_form_carries_the_keys_the_writer_reads(self):
        for name in ("bok", "khnp"):
            form = report_form.load_form(name)
            for key in ("page", "fonts", "sizes", "line_spacing", "markers",
                        "colors", "rules", "chrome"):
                self.assertIn(key, form, f"{name} is missing {key}")
            self.assertEqual(form["page"]["width_mm"], 210)

    def test_the_type_scale_is_the_house_scale(self):
        for name in ("bok", "khnp"):
            sizes = report_form.load_form(name)["sizes"]
            self.assertEqual(
                [sizes[k] for k in ("title", "section", "core", "table", "note", "chrome")],
                [22, 16, 15, 14, 12, 10],
            )


class SlideTitles(unittest.TestCase):
    def slides(self):
        _, sections = plan_spec.parse(SPEC)
        frame = plan_spec.FRAMES["report"]
        return outline.build_slides(frame, sections, "goal-first")

    def test_a_slide_takes_the_소제목_never_the_frame_name(self):
        titles = [s.title for s in self.slides()]
        self.assertIn("시범 현장 조사", titles)
        self.assertNotIn("한 것", titles)

    def test_source_keeps_the_chain_name_so_coverage_still_matches(self):
        body = [s for s in self.slides() if s.role == "body"]
        self.assertEqual(body[0].source, "plan_spec.md#한 것")

    def test_a_section_without_a_소제목_falls_back(self):
        sections = [plan_spec.Section(name="현상", status="확정", body="본문")]
        slides = outline.build_slides(plan_spec.FRAMES["problem"], sections, "problem-first")
        self.assertEqual([s.title for s in slides if s.role == "body"], ["현상"])


class PlanningChain(unittest.TestCase):
    """교안 63·65·66 — 클라이언트 블록만으로는 기획이 끝나지 않는다."""

    def frame(self):
        return plan_spec.FRAMES["problem"]

    def test_컨셉과_플래너_블록까지_이어진다(self):
        names = self.frame().sections
        for name in ("컨셉", "해결책", "실행 계획", "리스크 대책"):
            self.assertIn(name, names)

    def test_클라이언트_블록_여덟_절이_앞에_그대로_있다(self):
        self.assertEqual(
            self.frame().sections[:8],
            ("현상", "영향", "원인", "배경", "목표", "목적 검증", "기대효과", "과제"))

    def test_제안이_시작되는_자리는_그대로_과제다(self):
        # 뒤에 절이 붙어도 분석과 제안의 경계는 움직이지 않는다 (planner.md §4.4).
        self.assertEqual(self.frame().action, "과제")


class DocumentShape(unittest.TestCase):
    """교안 121 — 사람이 받는 문서는 골격이 아니라 여섯 항목이다."""

    def plan(self, sections, frame="problem"):
        return render_plan_doc.Plan(
            title="제목", governing="", meta={}, sections=sections,
            frame=plan_spec.FRAMES[frame], intake={}, appendix=[])

    def filled(self, status="확정"):
        return [plan_spec.Section(name=n, status=status, body=f"{n} 본문")
                for n in plan_spec.FRAMES["problem"].sections]

    def test_열두_절이_다섯_항목으로_묶인다(self):
        items = render_plan_doc.doc_items(self.plan(self.filled()))
        self.assertEqual([i.name for i in items],
                         ["목적", "개요", "내용 및 계획", "리스크 대책", "기대효과"])

    def test_어떤_절도_문서에서_사라지지_않는다(self):
        sections = self.filled()
        items = render_plan_doc.doc_items(self.plan(sections))
        placed = [s.name for i in items for s in i.sections]
        self.assertCountEqual(placed, [s.name for s in sections])

    def test_표에_없는_절도_버려지지_않고_뒤에_붙는다(self):
        sections = self.filled() + [
            plan_spec.Section(name="새 절", status="확정", body="본문")]
        items = render_plan_doc.doc_items(self.plan(sections))
        self.assertIn("새 절", [s.name for i in items for s in i.sections])

    def test_항목은_가장_덜_닫힌_절만큼만_닫힌다(self):
        sections = self.filled()
        for sec in sections:
            if sec.name == "영향":
                sec.status = "확인 필요"
        items = render_plan_doc.doc_items(self.plan(sections))
        목적 = next(i for i in items if i.name == "목적")
        self.assertEqual(목적.status, "확인 필요")

    def test_짧은_길_골격은_예전대로_절마다_한_항목(self):
        # 교육·강의형은 기획서를 쓰는 일이 아니라 묶을 항목도 없다.
        sections = [plan_spec.Section(name=n, status="확정", body="본문")
                    for n in plan_spec.FRAMES["teach"].sections]
        items = render_plan_doc.doc_items(self.plan(sections, frame="teach"))
        self.assertEqual(len(items), len(sections))

    def test_성과_보고서도_읽는_항목으로_묶인다(self):
        sections = [plan_spec.Section(name=n, status="확정", body="본문")
                    for n in plan_spec.FRAMES["report"].sections]
        items = render_plan_doc.doc_items(self.plan(sections, frame="report"))
        self.assertEqual([i.name for i in items],
                         ["개요", "추진 내용", "결과", "한계", "향후 계획"])


class Route(unittest.TestCase):
    """어느 골격이 기획부터 하는 일이고 어느 골격이 아닌지 (대표 2026-09-04)."""

    def test_기획부터_하는_일은_풀코스다(self):
        for key in ("problem", "hypothesis", "report"):
            self.assertEqual(plan_spec.FRAMES[key].route, "full", key)

    def test_내용이_이미_정해진_일은_짧은_길이다(self):
        for key in ("intro", "teach", "ir"):
            self.assertEqual(plan_spec.FRAMES[key].route, "short", key)

    def test_풀코스만_실행_계획을_진다(self):
        # 리스크를 부르는 이름은 골격마다 다르다(problem·report 는 `리스크 대책`,
        # hypothesis 는 `리스크`). 길을 가르는 것은 실행 계획이 있느냐다.
        for frame in plan_spec.FRAMES.values():
            self.assertEqual("실행 계획" in frame.sections,
                             frame.route == "full", frame.key)

    def test_풀코스는_어떤_이름으로든_리스크를_진다(self):
        for frame in plan_spec.FRAMES.values():
            if frame.route != "full":
                continue
            self.assertTrue(any(s.startswith("리스크") for s in frame.sections),
                            frame.key)

    def test_풀코스만_문서_항목으로_묶인다(self):
        for frame in plan_spec.FRAMES.values():
            grouped = frame.key in render_plan_doc.DOC_SHAPE
            self.assertEqual(grouped, frame.route == "full", frame.key)


class OutputFormat(unittest.TestCase):
    def test_a_report_asks_for_word(self):
        self.assertEqual(render_plan_doc.resolve_format("auto", {"doc_kind": "보고서"}), "both")
        self.assertEqual(render_plan_doc.resolve_format("auto", {"doc_kind": "둘 다"}), "both")

    def test_a_deck_run_stays_on_markdown(self):
        self.assertEqual(render_plan_doc.resolve_format("auto", {"doc_kind": "발표자료"}), "md")
        self.assertEqual(render_plan_doc.resolve_format("auto", {}), "md")

    def test_an_explicit_choice_is_never_overridden(self):
        self.assertEqual(render_plan_doc.resolve_format("docx", {"doc_kind": "발표자료"}), "docx")


if __name__ == "__main__":
    unittest.main()
