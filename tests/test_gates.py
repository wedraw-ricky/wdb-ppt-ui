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
import stage_cache  # noqa: E402
import template_lint  # noqa: E402
import validate_spec  # noqa: E402


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


class LectureCorrections(unittest.TestCase):
    """2강 첨삭과 교안 28·48·73·122 가 잡아낸 것들."""

    def errs(self, *sections):
        names = by_name(*sections)
        return (plan_spec.check_broad_purpose(names)
                + plan_spec.check_overlap(names)
                + plan_spec.check_task_shape(PROBLEM, names))

    def notes(self, *sections):
        return plan_spec.advisories(PROBLEM, by_name(*sections))

    # --- 오류 ---------------------------------------------------------------

    def test_대목적은_목적이_아니다(self):
        errs = self.errs(section("목적 검증", body="▢ 매출 증대"))
        self.assertTrue(any("E-BROAD" in e for e in errs))

    def test_손댈_자리가_있는_목적은_통과한다(self):
        self.assertEqual(
            self.errs(section("목적 검증", body="▢ 정산 지연 최소화")), [])

    def test_같은_줄이_두_절에_있으면_멈춘다(self):
        errs = self.errs(section("현상", body="▢ 회계 정정이 절반 가까이 발생한다"),
                         section("영향", body="▢ 회계 정정이 절반 가까이 발생한다"))
        self.assertTrue(any("E-DUP" in e for e in errs))

    def test_과제에_기한이_없으면_멈춘다(self):
        errs = self.errs(section("과제", body="▢ 자동계산 시스템 개발"))
        self.assertTrue(any("E-ACT" in e for e in errs))

    def test_기한이_있으면_통과한다(self):
        self.assertEqual(
            self.errs(section("과제", body="▢ 1년 내 자동계산 시스템 개발")), [])

    # --- 경고 ---------------------------------------------------------------

    def test_기대효과가_영향보다_길면_알린다(self):
        notes = self.notes(
            section("영향", body="▢ 일정 지연"),
            section("기대효과", body="▢ 일정 회복\n◦ 사기 진작\n◦ 이직률 감소"))
        self.assertTrue(any("W-GAIN" in n for n in notes))

    def test_목적이_여러_개면_알린다(self):
        notes = self.notes(
            section("목적 검증", body="▢ 매출\n◦ 신뢰도\n◦ 사기"))
        self.assertTrue(any("W-AIM" in n for n in notes))

    def test_비교_기준_없는_수치는_알린다(self):
        notes = self.notes(section("현상", body="▢ 정정 50건 발생"))
        self.assertTrue(any("W-BASE" in n for n in notes))

    def test_비교_기준이_있으면_조용하다(self):
        notes = self.notes(section("현상", body="▢ 전년 대비 정정 50건 발생"))
        self.assertFalse(any("W-BASE" in n for n in notes))

    def test_개발_요건은_기획과제가_아니라고_알린다(self):
        notes = self.notes(section("과제", body="▢ 1년 내 일괄 결재 기능 추가"))
        self.assertTrue(any("W-SPEC" in n for n in notes))

    # regression — 낱말 겹침으로 판단하던 때 멀쩡한 기획서를 잡던 것.
    # '정산 지연 최소화' 와 '회계 일정 딜레이' 는 같은 말인데 글자가 다르다.
    def test_같은_뜻을_다른_낱말로_써도_잡지_않는다(self):
        notes = self.notes(
            section("영향", body="▢ 회계 일정 딜레이 발생\n◦ 신뢰도 하락"),
            section("목적 검증", body="▢ 정산 지연 최소화"),
            section("기대효과", body="▢ 정산 지연 최소화"))
        self.assertEqual(notes, [])

    def test_짧은_길_골격에는_첨삭이_붙지_않는다(self):
        self.assertEqual(
            plan_spec.advisories(TEACH, by_name(section("개념", body="▢ 매출 증대"))),
            [])


class ShapeChoice(unittest.TestCase):
    """전후 비교는 항목 수가 모양을 가른다 (설계 §5.3)."""

    FEW = "▢ 요금제\n◦ 기본에서 프로로 올림\n◦ 두 가지"
    MANY = ("▢ 부서별 정정 건수 전후\n"
            "◦ 회계팀 50건에서 12건으로 줄임\n◦ 총무팀 40건에서 9건으로\n"
            "◦ 인사팀 33건에서 7건으로\n◦ 교무팀 28건에서 5건으로\n"
            "◦ 행정팀 21건에서 4건으로")

    def test_항목이_많은_전후는_dumbbell(self):
        self.assertEqual(outline.pick_shape(self.MANY), "dumbbell_chart")

    def test_항목이_적으면_예전대로(self):
        self.assertEqual(outline.pick_shape(self.FEW), "comparison_columns")

    def test_고른_모양은_카탈로그에_있어야_한다(self):
        # E-SHAPE 가 잡기 전에 여기서 걸린다.
        self.assertIn("dumbbell_chart", outline.load_shapes())


class SilentHoles(unittest.TestCase):
    """검사가 있는데 조용히 지나가던 자리들 (gap-detector 2026-09-05)."""

    def test_확정이라면서_빈_절은_잡는다(self):
        # IR 의 재무를 통째로 비우면 E-IR 도 같은 이유로 조용해, 재무 없는
        # IR 기획서가 검사를 통과했다.
        errs = plan_spec.check_facts(
            plan_spec.FRAMES["ir"], by_name(section("재무", body="", status="확정")))
        self.assertTrue(any("E-FACT" in e for e in errs))

    def test_아직_안_채운_절은_잡지_않는다(self):
        # 비어 있는 것 자체는 잘못이 아니다 — 아직 안 쓴 상태다.
        errs = plan_spec.check_facts(
            plan_spec.FRAMES["ir"],
            by_name(section("재무", body="", status="확인 필요")))
        self.assertEqual(errs, [])

    def test_IX_가_통째로_비면_잡는다(self):
        slides = [outline.Slide(n=1, layer="why", role="cover", title="")]
        path = self.project_with(slides, "## IX. Content Outline\n\n")
        self.assertTrue(any("E-SYNC" in e for e in outline.run_check(path)))

    def test_IX_가_아직_없으면_잡지_않는다(self):
        slides = [outline.Slide(n=1, layer="why", role="cover", title="")]
        path = self.project_with(slides, "# design_spec\n\n## I. Overview\n")
        self.assertFalse(any("E-SYNC" in e for e in outline.run_check(path)))

    def project_with(self, slides, design_text):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        path = Path(tmp.name)
        (path / "outline.md").write_text(
            outline.dump(plan_spec.FRAMES["problem"], "problem-first", slides),
            encoding="utf-8")
        (path / "design_spec.md").write_text(design_text, encoding="utf-8")
        return path


class FigureRules(unittest.TestCase):
    """수치를 묻는 질문이 둘이라 규칙도 둘이다 (regression).

    '숫자가 있느냐'(제목·거버닝)와 '단위까지 붙은 수치냐'(W-BASE)는 다른
    질문이다. 한때 같은 이름으로 정의해 뒤엣것이 앞을 덮었고, 제목 검사가
    '2026년' 을 수치 없음으로 보게 됐다. 테스트 217건이 전부 통과하는 동안
    아무도 이 경로를 밟지 않았다."""

    def test_제목_검사는_단위_없는_숫자도_수치로_본다(self):
        self.assertTrue(plan_spec._FIGURE_RE.search("2026년 3대 과제"))

    def test_W_BASE_는_단위까지_붙어야_수치로_본다(self):
        self.assertIsNone(plan_spec._MEASURED_RE.search("2026년"))
        self.assertTrue(plan_spec._MEASURED_RE.search("정정 50건"))

    def test_두_규칙은_서로_다른_것이어야_한다(self):
        self.assertIsNot(plan_spec._FIGURE_RE, plan_spec._MEASURED_RE)

    def test_거버닝_메시지에_연도만_있어도_수치로_친다(self):
        gov = ("2026년 들어 회계 정정이 늘고 있다. 자동계산 시스템을 도입한다. "
               "정정 건수를 줄인다.")
        self.assertEqual(
            [e for e in plan_spec.check_governing({"governing": gov})
             if "수치" in e], [])


class Restage(unittest.TestCase):
    """한 값을 고치면 무엇을 다시 뽑아야 하나 (E-8 v2).

    지배 관계는 strategist.md §d 에 이미 적혀 있는 것을 옮긴 것이라, 여기서
    검사하는 것은 '계약대로 번지는가' 와 '사람이 고른 것을 지우지 않는가' 다.
    필요 이상으로 번지면 사람이 고른 값이 지워진다."""

    def test_색은_이미지에만_번진다(self):
        # h.5 팔레트는 §e 색을 따른다. 그 외에는 아무것도 색에 매달리지 않는다.
        self.assertEqual(stage_cache.stale(["color"]), ["image_source"])

    def test_시각_스타일은_색_아이콘_서체를_지배한다(self):
        self.assertEqual(
            stage_cache.stale(["visual_style"]),
            ["color", "icons", "image_source", "typography"])

    def test_전달_목적은_서체와_쪽수를_정한다(self):
        self.assertEqual(stage_cache.stale(["delivery_purpose"]),
                         ["page_count", "typography"])

    def test_아무것도_지배하지_않는_값도_있다(self):
        for field in ("page_count", "icons", "typography", "audience"):
            self.assertEqual(stage_cache.stale([field]), [], field)

    def test_사람이_고른_값은_다시_뽑지_않는다(self):
        got = stage_cache.stale(["visual_style"], user_edited=["typography"])
        self.assertNotIn("typography", got)

    def test_사람이_고른_값_아래로는_번지지_않는다(self):
        # 캔버스 → 템플릿 → (나머지 전부) 사슬에서 템플릿을 직접 고르셨으면,
        # 캔버스를 바꿔도 그 아래로는 아무것도 번지지 않는다.
        self.assertEqual(
            stage_cache.stale(["canvas"], user_edited=["template"]), [])

    def test_이미지는_색과_시각_스타일_양쪽에_매달린다(self):
        # 계약 §d 55행이 이미지를 둘로 나눈다 — 그림체는 시각 방향을 따르고
        # 팔레트만 §e 색을 따른다. 그래서 색을 직접 고르셨어도 시각 스타일이
        # 바뀌면 그림체는 다시 뽑아야 한다.
        got = stage_cache.stale(["visual_style"], user_edited=["color"])
        self.assertNotIn("color", got)
        self.assertIn("image_source", got)

    def test_바뀐_값_자신은_다시_뽑을_목록에_없다(self):
        # 이미 새 값을 들고 있다. 목록에 넣으면 방금 고른 것을 덮어쓴다.
        self.assertNotIn("template", stage_cache.stale(["template"]))

    def test_서로_지배하는_값이_있어도_멈춘다(self):
        # canvas 와 template 은 서로를 가리킨다. 순환에서 안 돌아야 한다.
        got = stage_cache.stale(["canvas"])
        self.assertIn("template", got)
        self.assertNotIn("canvas", got)


class WorkAhead(unittest.TestCase):
    """단계 전환 시간 (PRD §14 7번) — 미리 뽑아둔 것이 아직 유효한지 판단한다.

    틀리는 방향이 한쪽으로만 안전하다: 낡은 것을 멀쩡하다고 하면 잘못된 덱이
    나가고, 멀쩡한 것을 낡았다고 하면 다시 뽑을 뿐이다."""

    def project(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        return Path(tmp.name)

    def test_가정이_그대로면_다시_뽑지_않는다(self):
        p = self.project()
        stage_cache.stash(p, "outline", {"frame": "problem"})
        self.assertEqual(stage_cache.drifted(p, "outline", {"frame": "problem"}), [])

    def test_바뀐_값의_이름을_대준다(self):
        # '달라졌다' 만 알면 전부 다시 뽑아야 한다. 이름을 알아야 그것만 뽑는다.
        p = self.project()
        stage_cache.stash(p, "outline", {"frame": "problem", "doc_kind": "둘 다"})
        self.assertEqual(
            stage_cache.drifted(p, "outline",
                                {"frame": "problem", "doc_kind": "발표자료"}),
            ["doc_kind"])

    def test_새로_생긴_값도_바뀐_것으로_센다(self):
        p = self.project()
        stage_cache.stash(p, "outline", {"frame": "problem"})
        self.assertEqual(
            stage_cache.drifted(p, "outline", {"frame": "problem", "canvas": "16:9"}),
            ["canvas"])

    def test_미리_뽑은_것이_없으면_없다고_한다(self):
        self.assertIsNone(stage_cache.drifted(self.project(), "outline", {"a": 1}))

    def test_깨진_기록은_없는_것으로_본다(self):
        # 읽을 수 없는 기록을 '유효' 로 처리하면 낡은 후보가 그대로 나간다.
        p = self.project()
        stage_cache.cache_dir(p).mkdir(parents=True)
        (stage_cache.cache_dir(p) / "outline.json").write_text("{ 깨짐",
                                                              encoding="utf-8")
        self.assertIsNone(stage_cache.drifted(p, "outline", {"a": 1}))

    def test_전환에_걸린_시간을_잰다(self):
        p = self.project()
        stage_cache.mark(p, "strategist", "begin", now=100.0)
        stage_cache.mark(p, "strategist", "end", now=142.0)
        self.assertEqual(stage_cache.timings(p), [("strategist", 42.0)])

    def test_끝나지_않은_전환은_시간을_지어내지_않는다(self):
        p = self.project()
        stage_cache.mark(p, "strategist", "begin", now=100.0)
        self.assertEqual(stage_cache.timings(p), [("strategist", None)])


class TemplateLint(unittest.TestCase):
    """템플릿 결함을 등록할 때 잡는다 (PRD §14 10번). 한 번 놓치면 그 템플릿을
    쓰는 모든 덱에서 되풀이된다."""

    HEAD = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720">'
    BG = '<rect x="0" y="0" width="1280" height="720" fill="#ffffff"/>'
    TITLE = '<text x="80" y="200">제목</text>'

    def lint(self, *body):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        path = Path(tmp.name) / "page.svg"
        path.write_text(self.HEAD + "".join(body) + "</svg>", encoding="utf-8")
        return template_lint.check_svg(path)

    def test_글자_뒤에_와야_할_배경이_위에_있으면_잡는다(self):
        faults = self.lint(self.BG, self.TITLE,
                           '<rect x="0" y="0" width="1280" height="720" fill="#224C9D"/>')
        self.assertTrue(any("T-COVER" in f for f in faults))

    def test_배경이_글자_뒤에_있으면_통과한다(self):
        self.assertEqual(self.lint(self.BG, self.TITLE), [])

    def test_일부만_덮는_도형은_잡지_않는다(self):
        # 캔버스 일부를 덮는 것은 디자인이지 결함이 아니다.
        faults = self.lint(self.BG, self.TITLE,
                           '<rect x="80" y="300" width="400" height="120" fill="#224C9D"/>')
        self.assertEqual(faults, [])

    def test_비치는_도형은_가림이_아니다(self):
        faults = self.lint(self.BG, self.TITLE,
                           '<rect x="0" y="0" width="1280" height="720" '
                           'fill="#000" opacity="0.3"/>')
        self.assertEqual(faults, [])

    def test_캔버스_밖_글자를_잡는다(self):
        faults = self.lint(self.BG, self.TITLE, '<text x="1900" y="200">각주</text>')
        self.assertTrue(any("T-OUT" in f for f in faults))

    def test_옮겨온_글자는_밖에_있다고_하지_않는다(self):
        # transform 이 걸린 글자를 좌표만 보고 판단하면 화면 안에 있는 글자를
        # 밖에 있다고 잘못 말한다.
        faults = self.lint(self.BG, self.TITLE,
                           '<g transform="translate(2000,0)">'
                           '<text x="-1500" y="600">옮겨온 글자</text></g>')
        self.assertEqual(faults, [])

    def test_defs_안의_도형은_그려지지_않으므로_무시한다(self):
        faults = self.lint(self.BG, self.TITLE,
                           '<defs><rect x="0" y="0" width="1280" height="720" '
                           'fill="#224C9D"/></defs>')
        self.assertEqual(faults, [])

    def test_viewBox_가_없으면_읽을_수_없다고_말한다(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        path = Path(tmp.name) / "page.svg"
        path.write_text('<svg xmlns="http://www.w3.org/2000/svg"></svg>',
                        encoding="utf-8")
        self.assertTrue(any("T-PARSE" in f for f in template_lint.check_svg(path)))


class FontTruth(unittest.TestCase):
    """서체 진실이 둘이던 것 (PRD §14 11번) — 이기는 서체가 설치돼 있어야 한다."""

    def test_실제로_나가는_것은_스택의_머리다(self):
        # 꼬리는 미리보기 대비책일 뿐이라, 꼬리를 보고 통과시키면 진짜 서체가
        # 없는 덱이 그냥 나간다.
        self.assertEqual(
            validate_spec.locked_family('Pretendard, "Malgun Gothic", sans-serif'),
            "Pretendard")

    def test_없는_서체는_알린다(self):
        notes = validate_spec.check_font_available('"Nonexistent Face", sans-serif')
        self.assertTrue(any("not installed" in n for n in notes))

    def test_제네릭_이름은_확인하지_않는다(self):
        self.assertEqual(validate_spec.check_font_available("sans-serif"), [])


class ChainOrder(unittest.TestCase):
    """절 구성과 순서는 프레임 사슬과 정확히 같아야 한다 (planner.md §6)."""

    def test_a_missing_section_is_named(self):
        # 빠뜨린 절의 이름을 사슬에서 읽는다. 이름을 박아두면 사슬이 길어질 때마다
        # 계약이 아니라 이 파일이 깨진다.
        dropped = REPORT.sections[-1]
        errs = plan_spec.check_order(REPORT, [section(n) for n in REPORT.sections[:-1]])
        self.assertIn("E-ORDER", errs[0])
        self.assertIn(dropped, errs[0])

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

    # --- E-END — 문서와 덱은 같은 결론에 닿아야 한다 ------------------------
    # 발표 순서는 상황마다 달라도 되지만 결론이 갈리면 안 된다.

    END_SPEC = (
        "---\nframe: problem\n---\n\n# 정정 감축\n\n"
        "## 8. 과제\nstatus: 확정\n"
        "▢ 출결 자동계산 시스템으로 정정 건수 30% 미만 감축\n"
    )

    def end_errors(self, slides):
        errs = outline.run_check(self.project(slides, spec=self.END_SPEC))
        return [e for e in errs if "E-END" in e]

    def test_결론_절에_닿지_않는_덱은_멈춘다(self):
        slides = [self.slide(1, layer="why", role="cover"),
                  self.slide(2, layer="why", source="plan_spec.md#현상")]
        self.assertTrue(self.end_errors(slides))

    def test_문서에_없는_수치로_끝나면_멈춘다(self):
        slides = [self.slide(1, layer="why", role="cover"),
                  self.slide(2, layer="why", source="plan_spec.md#현상"),
                  self.slide(3, layer="what", role="proposal_primary",
                             title="정정 건수 5건 이하로 감축",
                             source="plan_spec.md#과제")]
        self.assertTrue(any("5건" in e for e in self.end_errors(slides)))

    def test_문서와_같은_수치로_끝나면_조용하다(self):
        slides = [self.slide(1, layer="why", role="cover"),
                  self.slide(2, layer="why", source="plan_spec.md#현상"),
                  self.slide(3, layer="what", role="proposal_primary",
                             title="정정 건수 30% 미만으로 감축",
                             source="plan_spec.md#과제")]
        self.assertEqual(self.end_errors(slides), [])

    def test_2안은_제_숫자를_써도_된다(self):
        # 2안은 같은 목표를 다른 방법으로 가는 안이라 비용·기간이 다르다.
        slides = [self.slide(1, layer="why", role="cover"),
                  self.slide(2, layer="why", source="plan_spec.md#현상"),
                  self.slide(3, layer="what", role="proposal_primary",
                             title="정정 건수 30% 미만으로 감축",
                             source="plan_spec.md#과제"),
                  self.slide(4, layer="what", role="proposal_alt",
                             title="수기 이중확인으로 12개월 내 감축",
                             source="plan_spec.md#과제")]
        self.assertEqual(self.end_errors(slides), [])

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


class LayoutAssignmentRules(unittest.TestCase):
    """storyline.md §5. Both halves of the kpi_cards rule were found missing by
    running a real report through: five of its seven slides came out identical."""

    def test_a_specific_signal_beats_the_figure_count(self):
        # A sequence that happens to be measured is still a sequence. Reading
        # the count first sent it to the KPI grid.
        body = "먼저 1단계 3건을 처리하고, 다음 2단계에서 428건을 12명이 맡는다"
        self.assertEqual(outline.pick_shape(body), "numbered_steps")

    def test_mixed_units_are_required_for_kpi_cards(self):
        self.assertEqual(
            outline.pick_shape("접수 428건, 완료 371건, 진행 57건"), "body")
        self.assertEqual(
            outline.pick_shape("참여 1,015명, 참여율 75.7%, 만족도 4.3점"),
            "kpi_cards")

    def test_percent_and_percentage_point_are_one_measure(self):
        # 75.7% / 63.3% / 12.4%p is one kind of number stated three times.
        self.assertNotEqual(
            outline.pick_shape("75.7%에 그쳤다. 63.3%였고 12.4%p 차이다"),
            "kpi_cards")

    def test_money_compounds_are_one_measure(self):
        self.assertNotEqual(
            outline.pick_shape("640만원, 1,800만원, 120만원 편성"), "kpi_cards")

    def test_a_before_and_after_reads_as_a_comparison(self):
        self.assertEqual(
            outline.pick_shape("만족도가 3.8점에서 4.3점으로 올랐다"),
            "comparison_columns")
        self.assertEqual(
            outline.pick_shape("본사 평균 79.0%보다 22.7%p 낮다"),
            "comparison_columns")


class SameLayoutRun(unittest.TestCase):
    """A warning, never a correction: the layout follows the content, and a
    report whose middle really is three comparisons is telling the truth."""

    def slides(self, *shapes):
        rows = [outline.Slide(n=1, layer="why", role="cover", title="", shape="cover")]
        rows += [outline.Slide(n=i + 2, layer="how", role="body", title=f"{i}",
                               shape=sh) for i, sh in enumerate(shapes)]
        return rows

    def test_three_in_a_row_is_flagged(self):
        w = outline.shape_runs(self.slides("kpi_cards", "kpi_cards", "kpi_cards"))
        self.assertEqual(len(w), 1)
        self.assertIn("slides 2–4", w[0])

    def test_two_in_a_row_is_not(self):
        self.assertEqual(
            outline.shape_runs(self.slides("kpi_cards", "kpi_cards", "body")), [])

    def test_the_cover_never_joins_a_run(self):
        # Every deck opens on a cover; counting it would flag every deck.
        self.assertEqual(
            outline.shape_runs(self.slides("body", "body")), [])

    def test_two_separate_runs_are_both_named(self):
        w = outline.shape_runs(self.slides(
            "kpi_cards", "kpi_cards", "kpi_cards", "body", "body", "body"))
        self.assertEqual(len(w), 2)


if __name__ == "__main__":
    unittest.main()
