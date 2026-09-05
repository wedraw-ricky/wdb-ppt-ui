#!/usr/bin/env python3
"""Lint a template's page SVGs before it enters the index.

PRD §14 item 10 (E-5): a template defect — a background painted over the text
it was meant to sit behind, a label parked off the canvas — is invisible until
a whole deck has been built on top of it, and then it repeats in every deck
that template touches. Catching it at registration fixes all of them at once.

Two defects are checked. Both are read straight off the file with no rendering:

    T-COVER  an opaque, near-full-canvas shape is painted AFTER text.
             SVG paints in document order, so that shape buries the text.
    T-OUT    a text element sits outside the viewBox and can never be seen.

Deliberately narrow. A template that trips nothing here is not certified
beautiful; it merely has neither of the two faults that kept coming back.

Usage::

    python3 scripts/template_lint.py <svg-or-directory> [...]
"""

from __future__ import annotations

import argparse
import sys
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Optional

SVG_NS = "http://www.w3.org/2000/svg"

# 배경이 캔버스를 거의 다 덮을 때만 가림으로 본다. 조금 겹치는 것은 디자인이다.
COVER_RATIO = 0.9
# 글자가 캔버스 밖에 있다고 말하기 전에 주는 여유. 살짝 걸친 것은 재단이다.
OUT_MARGIN = 4.0
# 이 값보다 옅으면 뒤가 비쳐 보이므로 가림이 아니다.
OPAQUE_FLOOR = 0.95


def _tag(el: ET.Element) -> str:
    return el.tag.split("}", 1)[-1]


def _number(value: Optional[str]) -> Optional[float]:
    if value is None:
        return None
    text = value.strip().rstrip("px").strip()
    try:
        return float(text)
    except ValueError:
        return None


def canvas_size(root: ET.Element) -> Optional[tuple[float, float]]:
    box = root.get("viewBox")
    if box:
        parts = box.replace(",", " ").split()
        if len(parts) == 4:
            nums = [_number(p) for p in parts]
            if all(n is not None for n in nums) and nums[2] and nums[3]:
                return nums[2], nums[3]
    width, height = _number(root.get("width")), _number(root.get("height"))
    if width and height:
        return width, height
    return None


def _opaque(el: ET.Element) -> bool:
    fill = (el.get("fill") or "").strip().lower()
    if fill in {"none", "transparent"}:
        return False
    for attr in ("opacity", "fill-opacity"):
        value = _number(el.get(attr))
        if value is not None and value < OPAQUE_FLOOR:
            return False
    style = (el.get("style") or "").lower()
    if "fill:none" in style.replace(" ", ""):
        return False
    return True


def _walk(root: ET.Element) -> list[tuple[ET.Element, bool]]:
    """Elements in paint order, each flagged as defs-only (never painted).

    Anything under <defs>, <clipPath>, <mask>, <pattern>, <marker> or <symbol>
    is a definition, not a drawing, so it can neither bury nor be buried.
    """
    hidden = {"defs", "clipPath", "mask", "pattern", "marker", "symbol"}
    out: list[tuple[ET.Element, bool]] = []

    def walk(el: ET.Element, in_defs: bool) -> None:
        for child in el:
            child_defs = in_defs or _tag(child) in hidden
            out.append((child, child_defs))
            walk(child, child_defs)

    walk(root, False)
    return out


def _transformed(el: ET.Element) -> bool:
    return bool((el.get("transform") or "").strip())


def check_svg(path: Path) -> list[str]:
    try:
        root = ET.parse(path).getroot()
    except ET.ParseError as exc:
        return [f"T-PARSE {path.name} is not readable XML — {exc}"]

    size = canvas_size(root)
    if size is None:
        return [f"T-PARSE {path.name} declares no viewBox or width/height"]
    width, height = size

    order = _walk(root)
    faults: list[str] = []

    # --- T-COVER: 글자 뒤에 있어야 할 배경이 글자 위에 있다 -------------------
    last_text = -1
    for i, (el, in_defs) in enumerate(order):
        if not in_defs and _tag(el) == "text":
            last_text = i
    if last_text >= 0:
        for el, in_defs in order[last_text + 1:]:
            if in_defs or _tag(el) != "rect" or not _opaque(el):
                continue
            w, h = _number(el.get("width")), _number(el.get("height"))
            if w is None or h is None:
                continue
            if w >= width * COVER_RATIO and h >= height * COVER_RATIO:
                faults.append(
                    f"T-COVER {path.name} paints a {int(w)}×{int(h)} opaque rect "
                    f"after the last text — on a {int(width)}×{int(height)} "
                    f"canvas that buries the text under it"
                )
                break

    # --- T-OUT: 캔버스 밖에 놓인 글자 ------------------------------------------
    # transform 이 걸린 것은 건드리지 않는다. 좌표만 보고 판단하면 옮겨진 글자를
    # 밖에 있다고 잘못 말하게 된다.
    parents = {child: parent for parent in root.iter() for child in parent}

    def moved(el: ET.Element) -> bool:
        node: Optional[ET.Element] = el
        while node is not None:
            if _transformed(node):
                return True
            node = parents.get(node)
        return False

    for el, in_defs in order:
        if in_defs or _tag(el) != "text" or moved(el):
            continue
        x, y = _number(el.get("x")), _number(el.get("y"))
        if x is None or y is None:
            continue
        if (x < -OUT_MARGIN or x > width + OUT_MARGIN
                or y < -OUT_MARGIN or y > height + OUT_MARGIN):
            label = "".join(el.itertext()).strip()[:20]
            faults.append(
                f"T-OUT {path.name} places text at ({int(x)}, {int(y)}) outside "
                f"the {int(width)}×{int(height)} canvas — it can never be seen"
                + (f": '{label}…'" if label else "")
            )
    return faults


def check_pages(directory: Path) -> list[str]:
    faults: list[str] = []
    for svg in sorted(directory.glob("*.svg")):
        faults += check_svg(svg)
    return faults


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Lint template page SVGs for buried or off-canvas content.")
    parser.add_argument("paths", nargs="+", help="SVG files or directories")
    return parser


def main(argv: Optional[list[str]] = None) -> int:
    args = build_parser().parse_args(argv)
    faults: list[str] = []
    for raw in args.paths:
        path = Path(raw)
        if path.is_dir():
            faults += check_pages(path)
        elif path.is_file():
            faults += check_svg(path)
        else:
            print(f"[template_lint] not found: {path}", file=sys.stderr)
            return 1
    if faults:
        print(f"[template_lint] FAIL ({len(faults)} defect(s)):", file=sys.stderr)
        for f in faults:
            print(f"  x {f}", file=sys.stderr)
        return 1
    print("[template_lint] PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
