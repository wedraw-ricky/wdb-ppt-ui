#!/usr/bin/env python3
"""
The gates: `plan_spec.py --check` and `outline.py --check`.

These decide whether a run may advance, and until now nothing exercised them.
Each case is one row of the design's own test matrix (docs/02-design/features/
ppt-service-rebuild.design.md §8.2 L1, §8.3 L2), named after the error code it
proves, plus the branches those rows imply.

A gate test has to prove both directions: that the fault is caught, and that a
correct document passes. A check that fires on everything blocks the pipeline
just as badly as one that fires on nothing.

Usage:
    python3 -m unittest discover -s tests

Dependencies:
    None (standard library only)
"""
import sys
import tempfile
import unittest
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parent.parent / ".claude/skills/ppt-master/scripts"
sys.path.insert(0, str(SCRIPTS))

import outline  # noqa: E402
import plan_spec  # noqa: E402


def section(name, body="", status="확정", source="", options=None):
    return plan_spec.Section(name=name, status=status, body=body, source=source,
                             options=list(options or []))


def by_name(*sections):
    return {s.name: s for s in sections}


PROBLEM = plan_spec.FRAMES["problem"]
REPORT = plan_spec.FRAMES["report"]
TEACH = plan_spec.FRAMES["teach"]
IR = plan_spec.FRAMES["ir"]


class L1_1_FactRequiredSections(unittest.TestCase):
    """근거 없는 현상 칸 → 채우지 않고 확인 필요로 둔다 (planner.md §4.1)."""

    def test_a_filled_fact_section_without_a_source_is_caught(self):
        errs = plan_spec.check_facts(PROBLEM, by_name(section("현상", body="재해가 늘었다")))
        self.assertEqual(len(errs), 1)
        self.assertIn("E-FACT", errs[0])
        self.assertIn("현상", errs[0])

    def test_an_empty_fact_section_is_the_documented_way_out(self):
        left_open = section("현상", body="", status="확인 필요")
        self.assertEqual(plan_spec.check_facts(PROBLEM, by_name(left_open)), [])

    def test_a_cited_fact_section_passes(self):
        cited = section("현상", body="재해 12건", source="sources/a.md:L1-L9")
        self.assertEqual(plan_spec.check_facts(PROBLEM, by_name(cited)), [])

    def test_a_section_the_frame_does_not_require_facts_for_is_untouched(self):
        # teach lists no fact-required sections, so the rule must not fire.
        self.assertEqual(
            plan_spec.check_facts(TEACH, by_name(section("개념", body="근거 없는 설명"))), []
        )


class L1_2_PairedSections(unittest.TestCase):
    """기대효과는 앞서 적은 영향의 뒤집힌 짝이어야 한다 (설계 P-3)."""

    def test_an_effect_with_no_impact_behind_it_is_caught(self):
        errs = plan_spec.check_pairs(
            PROBLEM, by_name(section("영향", body=""), section("기대효과", body="연 2억 절감")))
        self.assertEqual(len(errs), 1)
        self.assertIn("E-PAIR", errs[0])

    def test_a_matched_pair_passes(self):
        self.assertEqual(
            plan_spec.check_pairs(
                PROBLEM,
                by_name(section("영향", body="연 2억 손실"),
                        section("기대효과", body="연 2억 절감"))),
            [],
        )

    def test_an_impact_with_no_effect_yet_is_not_an_error(self):
        # The rule is directional: the second member must correspond to the
        # first, not the other way round. A plan still being written trips it
        # otherwise.
        self.assertEqual(
            plan_spec.check_pairs(
                PROBLEM,
                by_name(section("영향", body="연 2억 손실"), section("기대효과", body=""))),
            [],
        )


class L1_3_TargetShape(unittest.TestCase):
    """목표는 기간과 수준을 모두 갖는다 (설계 P-4)."""

    def test_a_target_missing_its_period_is_caught(self):
        errs = plan_spec.check_target(PROBLEM, by_name(section("목표", body="이수율 90% 달성")))
        self.assertEqual(len(errs), 1)
        self.assertIn("E-GOAL", errs[0])
        self.assertIn("기간", errs[0])

    def test_a_target_missing_its_level_is_caught(self):
        errs = plan_spec.check_target(PROBLEM, by_name(section("목표", body="6개월 안에 개선")))
        self.assertIn("수준", errs[0])

    def test_a_target_carrying_both_passes(self):
        self.assertEqual(
            plan_spec.check_target(
                PROBLEM, by_name(section("목표", body="6개월 안에 이수율 90% 이상"))),
            [],
        )

    def test_an_unwritten_target_is_not_yet_a_fault(self):
        self.assertEqual(plan_spec.check_target(PROBLEM, by_name(section("목표", body=""))), [])

    def test_a_frame_with_no_target_section_skips_the_rule(self):
        self.assertIsNone(plan_spec.FRAMES["intro"].target)
        self.assertEqual(plan_spec.check_target(plan_spec.FRAMES["intro"], {}), [])


class L1_4_Options(unittest.TestCase):
    """1안·2안은 흐름과 결론에만, 그리고 프레임이 허용할 때만 (설계 P-8)."""

    def test_a_frame_that_suppresses_options_rejects_them(self):
        errs = plan_spec.check_options(
            TEACH, by_name(section("정리", body="…", options=["1안", "2안"])))
        self.assertIn("E-ALT", errs[0])

    def test_a_tail_frame_allows_options_only_in_its_action_section(self):
        allowed = plan_spec.check_options(
            REPORT, by_name(section("다음", body="…", options=["1안", "2안"])))
        self.assertEqual(allowed, [])
        stray = plan_spec.check_options(
            REPORT, by_name(section("결과", body="…", options=["1안", "2안"])))
        self.assertIn("E-ALT", stray[0])

    def test_an_ir_financial_section_needs_all_three_scenarios(self):
        errs = plan_spec.check_options(IR, by_name(section("재무", body="기본 시나리오만 있음")))
        self.assertIn("E-IR", errs[0])
        self.assertEqual(
            plan_spec.check_options(IR, by_name(section("재무", body="보수 / 기본 / 공격"))), []
        )


class ChainOrder(unittest.TestCase):
    """절 구성과 순서는 프레임 사슬과 정확히 같아야 한다 (planner.md §6)."""

    def test_a_missing_section_is_named(self):
        errs = plan_spec.check_order(REPORT, [section(n) for n in REPORT.sections[:-1]])
        self.assertIn("E-ORDER", errs[0])
        self.assertIn("다음", errs[0])

    def test_an_extra_section_is_named(self):
        errs = plan_spec.check_order(
            REPORT, [section(n) for n in REPORT.sections] + [section("잡담")])
        self.assertIn("잡담", errs[0])

    def test_the_same_sections_out_of_order_are_caught(self):
        shuffled = [section(n) for n in reversed(REPORT.sections)]
        errs = plan_spec.check_order(REPORT, shuffled)
        self.assertIn("out of chain order", errs[0])

    def test_the_frame_chain_itself_passes(self):
        self.assertEqual(
            plan_spec.check_order(REPORT, [section(n) for n in REPORT.sections]), [])


class FrameSelection(unittest.TestCase):
    """frame 은 묻지 않고 intake 에서 파생된다 (planner.md §2)."""

    def test_assignment_decides_between_problem_and_hypothesis(self):
        base = {"purpose": "전략 제안"}
        self.assertEqual(plan_spec.resolve_frame({**base, "assignment": "지시수명"}), "problem")
        self.assertEqual(plan_spec.resolve_frame({**base, "assignment": "신규제안"}), "hypothesis")

    def test_a_purpose_that_needs_no_assignment_resolves_alone(self):
        self.assertEqual(plan_spec.resolve_frame({"purpose": "성과 보고"}), "report")
        self.assertEqual(plan_spec.resolve_frame({"purpose": "IR 투자 유치"}), "ir")

    def test_a_missing_assignment_says_which_two_answers_are_valid(self):
        with self.assertRaises(ValueError) as caught:
            plan_spec.resolve_frame({"purpose": "전략 제안"})
        self.assertIn("지시수명", str(caught.exception))
        self.assertIn("신규제안", str(caught.exception))

    def test_an_unknown_purpose_lists_the_ones_that_exist(self):
        with self.assertRaises(ValueError) as caught:
            plan_spec.resolve_frame({"purpose": "아무거나"})
        self.assertIn("성과 보고", str(caught.exception))


class L1_6_LayoutAssignment(unittest.TestCase):
    """내용 성격이 레이아웃을 고른다 (storyline.md §5)."""

    def test_three_or_more_figures_become_kpi_cards(self):
        self.assertEqual(
            outline.pick_shape("재해 12건, 이수율 61%, 비용 3200만원"), "kpi_cards")

    def test_two_figures_are_not_enough(self):
        self.assertNotEqual(outline.pick_shape("재해 12건과 이수율 61%"), "kpi_cards")

    def test_ordered_steps_become_numbered_steps(self):
        self.assertEqual(outline.pick_shape("먼저 기준을 통일하고 다음으로 점검한다"),
                         "numbered_steps")

    def test_a_before_and_after_becomes_two_columns(self):
        self.assertEqual(outline.pick_shape("도입 전 대비 도입 후"), "comparison_columns")

    def test_three_to_six_parallel_items_become_a_list(self):
        self.assertEqual(outline.pick_shape("- 하나\n- 둘\n- 셋"), "vertical_list")

    def test_plain_prose_falls_back_to_the_body_layout(self):
        self.assertEqual(outline.pick_shape("특별한 신호가 없는 설명 문장"), "body")

    def test_every_assigned_shape_exists_in_the_chart_library(self):
        known = outline.load_shapes()
        for body in ("재해 12건, 이수율 61%, 비용 3200만원",
                     "먼저 통일하고 다음으로 점검",
                     "도입 전 대비 도입 후",
                     "- 하나\n- 둘\n- 셋",
                     "설명"):
            self.assertIn(outline.pick_shape(body), known)


class OutlineGate(unittest.TestCase):
    """outline.py --check — 덱이 만들어지기 전 마지막 관문."""

    def project(self, slides, spec=None, design=None, frame="problem", flow="problem-first"):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        path = Path(tmp.name)
        (path / "outline.md").write_text(
            outline.dump(plan_spec.FRAMES[frame], flow, slides), encoding="utf-8")
        if spec is not None:
            (path / "plan_spec.md").write_text(spec, encoding="utf-8")
        if design is not None:
            (path / "design_spec.md").write_text(design, encoding="utf-8")
        return path

    def slide(self, n, layer="how", role="body", title="", shape="body", source=""):
        return outline.Slide(n=n, layer=layer, role=role, title=title,
                             shape=shape, source=source)

    def sound_deck(self):
        return [
            self.slide(1, "why", "cover", "표지", "cover"),
            self.slide(2, "why", "body", "현상", "body", "plan_spec.md#현상"),
            self.slide(3, "what", "proposal_primary", "1안", "body"),
            self.slide(4, "what", "proposal_alt", "2안", "body"),
        ]

    def test_a_sound_deck_passes(self):
        self.assertEqual(outline.run_check(self.project(self.sound_deck())), [])

    def test_L1_4_a_deck_without_an_alternative_is_blocked(self):
        rows = [s for s in self.sound_deck() if s.role != "proposal_alt"]
        errs = outline.run_check(self.project(rows))
        self.assertTrue(any("E-ALT" in e for e in errs), errs)

    def test_a_frame_that_forbids_an_alternative_rejects_one(self):
        rows = self.sound_deck()
        errs = outline.run_check(self.project(rows, frame="teach", flow="case-first"))
        self.assertTrue(any("E-ALT" in e for e in errs), errs)

    def test_E_OPEN_a_deck_must_open_on_why(self):
        rows = self.sound_deck()
        rows[1] = self.slide(2, "how", "body", "원인")
        errs = outline.run_check(self.project(rows))
        self.assertTrue(any("E-OPEN" in e for e in errs), errs)

    def test_E_SHAPE_a_layout_outside_the_library_is_caught(self):
        rows = self.sound_deck()
        rows[1] = self.slide(2, "why", "body", "현상", shape="made_up_layout")
        errs = outline.run_check(self.project(rows))
        self.assertTrue(any("E-SHAPE" in e for e in errs), errs)

    def test_every_shape_the_scaffold_assigns_is_accepted(self):
        known = outline.load_shapes()
        self.assertIn("cover", known)
        self.assertIn("body", known)
        self.assertIn("comparison_columns", known)

    def test_E_IR_needs_a_financial_scenario_slide(self):
        rows = [
            self.slide(1, "why", "cover", "표지", "cover"),
            self.slide(2, "why", "body", "문제"),
        ]
        errs = outline.run_check(self.project(rows, frame="ir", flow="problem-first"))
        self.assertTrue(any("E-IR" in e for e in errs), errs)

    def test_E_COVER_a_확정_section_must_reach_a_slide(self):
        spec = ("---\nframe: problem\n---\n\n# 제목\n\n"
                "## 1. 현상\nstatus: 확정\n본문 있음\n\n"
                "## 2. 원인\nstatus: 확정\n본문 있음\n")
        errs = outline.run_check(self.project(self.sound_deck(), spec=spec))
        self.assertTrue(any("E-COVER" in e and "원인" in e for e in errs), errs)


class L1_5_SectionIXParity(unittest.TestCase):
    """outline.md 가 정본이고 §IX 는 거기서 생성된다 (설계 §2.1)."""

    def slides(self, count):
        return [outline.Slide(n=i + 1, layer="why" if i < 2 else "what",
                              role="cover" if i == 0 else "body", title=f"장 {i + 1}")
                for i in range(count)]

    def test_every_slide_reaches_section_ix(self):
        text = outline.render_ix(self.slides(10))
        self.assertEqual(text.count("#### Slide "), 10)
        self.assertIn("#### Slide 10 - 장 10", text)

    def test_a_slide_without_a_title_is_marked_not_hidden(self):
        text = outline.render_ix([outline.Slide(n=1, layer="why", role="cover", title="")])
        self.assertIn("제목 미정", text)

    def test_E_SYNC_a_section_ix_that_disagrees_is_caught(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        path = Path(tmp.name)
        rows = [
            outline.Slide(n=1, layer="why", role="cover", title="표지", shape="cover"),
            outline.Slide(n=2, layer="why", role="body", title="현상"),
            outline.Slide(n=3, layer="what", role="proposal_primary", title="1안"),
            outline.Slide(n=4, layer="what", role="proposal_alt", title="2안"),
        ]
        (path / "outline.md").write_text(
            outline.dump(plan_spec.FRAMES["problem"], "problem-first", rows), encoding="utf-8")
        # §IX left behind after a slide was deleted — design §8.3 L2-4.
        (path / "design_spec.md").write_text(
            outline.render_ix(rows + [outline.Slide(n=5, layer="what", role="body", title="군더더기")]),
            encoding="utf-8")
        errs = outline.run_check(path)
        self.assertTrue(any("E-SYNC" in e for e in errs), errs)

    def test_section_ix_regenerated_from_the_outline_agrees(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        path = Path(tmp.name)
        rows = [
            outline.Slide(n=1, layer="why", role="cover", title="표지", shape="cover"),
            outline.Slide(n=2, layer="why", role="body", title="현상"),
            outline.Slide(n=3, layer="what", role="proposal_primary", title="1안"),
            outline.Slide(n=4, layer="what", role="proposal_alt", title="2안"),
        ]
        (path / "outline.md").write_text(
            outline.dump(plan_spec.FRAMES["problem"], "problem-first", rows), encoding="utf-8")
        (path / "design_spec.md").write_text(outline.render_ix(rows), encoding="utf-8")
        self.assertEqual(outline.run_check(path), [])


if __name__ == "__main__":
    unittest.main()
