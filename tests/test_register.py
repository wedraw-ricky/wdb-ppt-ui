#!/usr/bin/env python3
"""
보고형 문체 — the rules `report-format.md §2` states and nothing enforced.

The register was written down and then skipped, which is the failure this
whole cycle is about: a rule that lives only in a document gets read once and
never again. Run against a document written without it, these checks found 29
violations — a 32-character two-sentence title with no figure, no governing
message at all, six section headings phrased as questions, and every 개조식
line ending in 서술형.

Every check has its opposite case. A gate that fires on correct writing costs
more than one that fires on nothing, because the next person turns it off.

Usage:
    python3 -m unittest discover -s tests

Dependencies:
    None (standard library only)
"""
import sys
import unittest
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parent.parent / ".claude/skills/ppt-master/scripts"
sys.path.insert(0, str(SCRIPTS))

import plan_spec  # noqa: E402


def sec(name, body="", heading=""):
    return plan_spec.Section(name=name, status="확정", body=body,
                             heading=heading, source="", options=[])


class ProposalTitle(unittest.TestCase):
    """`[목적] 을 위한 [실행안]` — planner.md §2.5.

    The cases here are the lecture's own: the 제목 it calls a failure, the
    revision it says still fails, and the one it rewrites to. A proposal was
    being judged by the report rule, which demanded a result figure the
    proposal has not produced and never asked for a purpose at all.
    """

    def errs(self, title):
        return plan_spec.check_title({"title": title},
                                     plan_spec.FRAMES["problem"])

    def test_the_rewritten_title_passes(self):
        self.assertEqual(
            self.errs("실시간 업무 소통의 극대화를 위한 생산성 툴 노션 도입안"), [])

    def test_a_title_with_no_purpose_is_caught(self):
        # An action and nothing else: the reader cannot tell what improves.
        found = self.errs("생산성 툴 노션 도입안")
        self.assertTrue(any("목적이 없다" in e for e in found))

    def test_a_purpose_too_broad_is_caught(self):
        # 업무 효율 names a direction, not what is failing.
        for bad in ("업무 효율을 위한 노션 도입안",
                    "생산성을 위한 협업 도구 도입안",
                    "매출 증대를 위한 채널 확대안"):
            found = self.errs(bad)
            self.assertTrue(any("너무 넓다" in e for e in found), bad)

    def test_a_specific_purpose_passes(self):
        self.assertEqual(
            self.errs("신입사원 1년 이내 퇴사율 40% 해소를 위한 온보딩 재설계안"), [])

    def test_a_proposal_title_needs_no_figure(self):
        # The report rule demanded one; a proposal has no result yet.
        self.assertEqual(self.errs("현장 보고 경로 부재 해소를 위한 익명 채널 개설안"), [])

    def test_an_unwritten_title_names_the_proposal_shape(self):
        found = self.errs("")
        self.assertTrue(any("위한" in e for e in found))


class Title(unittest.TestCase):
    """보고서 제목 — `[핵심 수단] + [결과/수치]`, 12~18자."""

    def errs(self, title):
        return plan_spec.check_title({"title": title},
                                     plan_spec.FRAMES["report"])

    def test_a_title_to_shape_passes(self):
        self.assertEqual(self.errs("익명 신고채널 도입, 참여율 75.7%"), [])

    def test_a_sentence_lifted_from_the_conclusion_is_caught(self):
        # What the scaffold used to write: the author's conclusion, verbatim.
        found = self.errs("채널은 자리를 잡았다. 하반기에는 지역사업소 참여율과 처리 기간을 잡는다")
        self.assertTrue(any("32자" in e or "자 —" in e for e in found))
        self.assertTrue(any("두 문장" in e for e in found))
        self.assertTrue(any("수치가 없다" in e for e in found))

    def test_a_title_without_a_figure_is_caught(self):
        self.assertTrue(any("수치가 없다" in e for e in self.errs("신고채널 도입 성과")))

    def test_a_superlative_is_caught(self):
        self.assertTrue(any("혁신적" in e for e in self.errs("혁신적 신고채널, 참여율 75.7%")))

    def test_an_unwritten_title_is_caught(self):
        self.assertTrue(self.errs(""))
        self.assertTrue(self.errs("[핵심 수단] + [결과 수치] — 12~18자"))

    def test_the_report_rule_still_wants_a_figure(self):
        # Scoping the proposal rule must not loosen the report rule.
        self.assertTrue(any("수치가 없다" in e for e in self.errs("신고채널 도입 성과")))


class Governing(unittest.TestCase):
    """`[현황/문제] + [해결] + [정량 결과]`, 2~3문장."""

    GOOD = ("2025년 안전사고 3건 중 2건은 보고 경로가 없어 방치됐다. "
            "익명 신고 채널을 열고 전 직원 교육을 6개월간 집행했다. "
            "참여율 75.7%, 신고 428건 중 371건 조치 완료.")

    def test_a_governing_message_to_shape_passes(self):
        self.assertEqual(plan_spec.check_governing({"governing": self.GOOD}), [])

    def test_a_missing_one_is_caught(self):
        # The scaffold had no slot for it, so every document went without.
        found = plan_spec.check_governing({"governing": ""})
        self.assertEqual(len(found), 1)
        self.assertIn("E-GOV", found[0])

    def test_one_sentence_is_not_a_governing_message(self):
        found = plan_spec.check_governing({"governing": "참여율이 75.7%로 올랐다."})
        self.assertTrue(any("문장" in e for e in found))

    def test_it_has_to_land_on_a_figure(self):
        no_figure = ("보고 경로가 없어 사고가 방치됐다. "
                     "익명 채널을 열었다. 참여가 늘었다.")
        self.assertTrue(any("수치가 없다" in e
                            for e in plan_spec.check_governing({"governing": no_figure})))


class Heading(unittest.TestCase):
    """`[대상/범위] + [핵심 조치]`, 명사형 20자 내외."""

    def test_a_noun_phrase_heading_passes(self):
        self.assertEqual(
            plan_spec.check_headings([sec("결과", heading="참여율 75.7%, 전년 대비 12.4%p 상승")]),
            [])

    def test_a_question_heading_is_caught(self):
        # Six of these shipped: 무엇을 했나 / 무엇이 달라졌나 / …
        for bad in ("무엇을 했나", "무엇이 달라졌나", "이 숫자를 어떻게 읽나", "어디가 문제인가"):
            found = plan_spec.check_headings([sec("x", heading=bad)])
            self.assertTrue(any("의문형" in e for e in found), bad)

    def test_an_adjective_heading_is_caught(self):
        self.assertTrue(any("다양한" in e for e in
                            plan_spec.check_headings([sec("x", heading="다양한 개선 활동")])))

    def test_a_section_with_no_heading_is_not_this_check_s_business(self):
        # planner.md's own hard rule covers a missing heading; this one only
        # judges the wording of a heading that exists.
        self.assertEqual(plan_spec.check_headings([sec("x", heading="")]), [])


class BodyRegister(unittest.TestCase):
    """§2.1 — 수식어, and 개조식 종결·마침표."""

    def test_a_body_to_register_passes(self):
        body = ("▢ 익명·비보복 전제 상시 신고 채널 개설\n"
                "◦ 전 직원 필수 교육 이수 1,187명, 이수율 88.6%\n"
                "* 재직 1,340명 기준이며 장기파견 53명은 제외했다.")
        self.assertEqual(plan_spec.check_register([sec("한 것", body)]), [])

    def test_a_full_stop_on_a_bullet_is_caught(self):
        found = plan_spec.check_register([sec("x", "◦ 참석 342명.")])
        self.assertTrue(any("마침표" in e for e in found))

    def test_a_narrative_ending_on_a_bullet_is_caught(self):
        found = plan_spec.check_register([sec("x", "▢ 참여율이 12.4%p 올랐다")])
        self.assertTrue(any("서술형" in e for e in found))

    def test_a_footnote_keeps_its_full_stop(self):
        # `*` and `※` are 각주 — explanatory prose, not 개조식.
        self.assertEqual(
            plan_spec.check_register([sec("x", "* 중복 신고 34건은 1건으로 병합했다.")]),
            [])

    def test_a_superlative_in_the_body_is_caught(self):
        found = plan_spec.check_register([sec("x", "◦ 종합적 개선 추진")])
        self.assertTrue(any("종합적" in e for e in found))


if __name__ == "__main__":
    unittest.main()
