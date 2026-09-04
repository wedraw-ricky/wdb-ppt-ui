#!/usr/bin/env python3
"""
What text extraction does to a Korean document, and what has to be undone.

Both repairs here were found by converting a real Korean report rather than by
reading the code: the writer typed `1,340명` and `Ⅰ. 배경`, and the extracted
Markdown carried `1,340 명` and `Ⅰ배경 .`. Neither is the author's text, and
both survive all the way onto the slides if nothing repairs them.

The risk runs the other way too — a repair that joins a digit to whatever word
follows turns "표 3 참조" into "표3 참조" — so every case below has its
matching case for text that must be left alone.

Usage:
    python3 -m unittest discover -s tests

Dependencies:
    PyMuPDF (skipped without it — pdf_to_md imports it at module level)
"""
import sys
import unittest
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parent.parent / ".claude/skills/ppt-master/scripts"
sys.path.insert(0, str(SCRIPTS))
sys.path.insert(0, str(SCRIPTS / "source_to_md"))

try:
    from pdf_to_md import normalize_extracted_text
except (ImportError, SystemExit):  # PyMuPDF missing
    normalize_extracted_text = None


@unittest.skipIf(normalize_extracted_text is None, "PyMuPDF not installed")
class NumberAndUnit(unittest.TestCase):
    """Word and LibreOffice draw a gap between a Latin digit and an East Asian
    character; extraction reads that drawn gap back as a real space."""

    def join(self, text):
        return normalize_extracted_text(text)

    def test_the_common_units_rejoin(self):
        for split, whole in [
            ("재직 1,340 명 기준", "재직 1,340명 기준"),
            ("예산 3,200 만원", "예산 3,200만원"),
            ("만족도 4.3 점", "만족도 4.3점"),
            ("신고 428 건", "신고 428건"),
            ("2026 년 상반기", "2026년 상반기"),
        ]:
            self.assertEqual(self.join(split), whole)

    def test_a_particle_after_the_unit_does_not_block_the_join(self):
        # "53 명은" is the same defect as "53 명"; the sentence just continues.
        self.assertEqual(self.join("53 명은 제외"), "53명은 제외")
        self.assertEqual(self.join("1,015 명이 참여"), "1,015명이 참여")

    def test_a_longer_unit_wins_over_its_own_prefix(self):
        # 개월 must not be read as 개 + 월, which would leave "3개 월".
        self.assertEqual(self.join("6 개월간"), "6개월간")
        self.assertEqual(self.join("3 개년 계획"), "3개년 계획")

    def test_a_word_that_is_not_a_unit_is_left_alone(self):
        # The failure this guards: joining a digit to whatever follows.
        self.assertEqual(self.join("표 3 참조"), "표 3 참조")
        self.assertEqual(self.join("항목 5 삭제"), "항목 5 삭제")

    def test_a_unit_that_starts_an_ordinary_word_is_left_alone(self):
        # 배 is a real unit ("3배") and also the first syllable of 배경; 장 of
        # 장기; 부 of 부서. Joining on the syllable alone turned the heading
        # "1. 배경" into "1.배경".
        for line in ("## 1. 배경", "표 5 장기 계획", "제 3 부서 명단"):
            self.assertEqual(self.join(line), line)

    def test_those_same_units_still_join_when_the_word_ends_there(self):
        self.assertEqual(self.join("매출 3 배 증가"), "매출 3배 증가")
        self.assertEqual(self.join("보고서 12 장"), "보고서 12장")

    def test_a_latin_measurement_is_left_alone(self):
        self.assertEqual(self.join("ISO 9001 인증"), "ISO 9001 인증")

    def test_text_with_no_split_is_unchanged(self):
        clean = "참여율 75.7%, 전년 대비 12.4%p 상승"
        self.assertEqual(self.join(clean), clean)


@unittest.skipIf(normalize_extracted_text is None, "PyMuPDF not installed")
class RomanHeading(unittest.TestCase):
    """`Ⅰ. 배경` comes back as `Ⅰ배경 .` — the period is drawn at the numeral's
    baseline and sorts to the end of the line, costing the document its
    section numbering."""

    def test_the_period_goes_back_where_it_belongs(self):
        self.assertEqual(normalize_extracted_text("## Ⅰ배경 ."), "## Ⅰ. 배경")
        self.assertEqual(normalize_extracted_text("## Ⅲ주요 성과 ."),
                         "## Ⅲ. 주요 성과")

    def test_every_heading_level_is_repaired(self):
        self.assertEqual(normalize_extracted_text("### Ⅱ추진 경과 ."),
                         "### Ⅱ. 추진 경과")

    def test_a_correct_heading_is_untouched(self):
        for line in ("## Ⅰ. 배경", "## 배경", "## 1. 배경"):
            self.assertEqual(normalize_extracted_text(line), line)

    def test_body_text_ending_in_a_period_is_untouched(self):
        # Only headings carry the defect; a sentence legitimately ends this way.
        line = "Ⅰ장에서 다룬 내용은 다음과 같다."
        self.assertEqual(normalize_extracted_text(line), line)


if __name__ == "__main__":
    unittest.main()
