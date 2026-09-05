/* Contract tests for the outline editor's file model.
 *
 * `ui/src/outline/model.ts` is a mirror of `outline.py`'s load()/dump(): the
 * screen owns the parse and the re-serialise, so a drift here reaches the deck
 * as a corrupted outline.md. Runs on Node's own runner and type stripping —
 * no dependency, no build step.
 *
 * Usage:
 *     node --test --experimental-strip-types tests/
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";

import {
  addRow, checkOutline, deleteRow, deleteWarning, IMAGE_USES, mergeRows, mergeWarning,
  SHAPES, SHAPE_GROUPS,
  metaGet, metaSet, moveRow, parseOutline, patchRow, serializeOutline,
  type Doc,
} from "../ui/src/outline/model.ts";

const FILE = `---
frame: problem
flow: problem-first
slide_count: 4
generated_at: 2026-09-04T10:00:00
---

- n: 1
  layer: why
  role: cover
  title: "안전보건 개선"
  screen: "재해 12건"
  script: ""
  shape: cover
  source: ""
  image: full
  edited: false

- n: 2
  layer: why
  role: body
  title: "현상"
  screen: "[규제 강화]\\n[내부 기준 흔들림]"
  script: "두 축으로 보시면"
  shape: comparison_columns
  source: "plan_spec.md#현상"
  image: none
  edited: false

- n: 3
  layer: how
  role: body
  title: "원인"
  screen: ""
  script: ""
  shape: vertical_list
  source: "plan_spec.md#원인"
  image: side
  edited: true

- n: 4
  layer: what
  role: proposal_primary
  title: "1안 — 권고"
  screen: ""
  script: ""
  shape: comparison_columns
  source: "plan_spec.md#과제"
  image: none
  edited: false
`;

const doc = () => parseOutline(FILE);

describe("reading outline.md", () => {
  it("keeps every field", () => {
    const d = doc();
    assert.equal(d.rows.length, 4);
    assert.equal(d.rows[1].title, "현상");
    assert.equal(d.rows[1].shape, "comparison_columns");
    assert.equal(d.rows[1].source, "plan_spec.md#현상");
    assert.equal(d.rows[2].edited, true);
    assert.equal(metaGet(d, "frame"), "problem");
  });

  it("decodes the escape the contract writes for a line break", () => {
    assert.equal(doc().rows[1].screen, "[규제 강화]\n[내부 기준 흔들림]");
  });

  it("recovers text that outline.py's own loader would drop", () => {
    // dump() writes a real newline when a field holds one; its load() then
    // reads the first line and discards the rest. The screen must not inherit
    // that loss — and what it writes back is the escaped one-line form.
    const lossy = FILE.replace('"[규제 강화]\\n[내부 기준 흔들림]"',
                               '"[규제 강화]\n[내부 기준 흔들림]"');
    const parsed = parseOutline(lossy);
    assert.equal(parsed.rows[1].screen, "[규제 강화]\n[내부 기준 흔들림]");
    assert.match(serializeOutline(parsed), /screen: "\[규제 강화\]\\n\[내부 기준 흔들림\]"/);
  });
});

describe("writing outline.md", () => {
  it("round-trips unchanged apart from the count it owns", () => {
    assert.equal(serializeOutline(doc()), FILE);
  });

  it("tracks slide_count against the rows actually written", () => {
    const d = doc();
    const out = serializeOutline({ ...d, rows: deleteRow(d.rows, 3) });
    assert.match(out, /slide_count: 3/);
  });

  it("carries unknown frontmatter through untouched", () => {
    const d = metaSet(doc(), "confirmed_at", "2026-09-04T11:00:00");
    assert.match(serializeOutline(d), /generated_at: 2026-09-04T10:00:00/);
    assert.match(serializeOutline(d), /confirmed_at: 2026-09-04T11:00:00/);
  });
});

describe("the edits storyline.md §8 defines", () => {
  it("renumbers on reorder and recomputes the layer from the new position", () => {
    const rows = moveRow(doc().rows, 2, 1);
    assert.deepEqual(rows.map((r) => r.n), [1, 2, 3, 4]);
    assert.equal(rows[1].title, "원인");
    assert.equal(rows[1].layer, "why");
  });

  it("marks a moved row edited so a regeneration cannot overwrite it", () => {
    assert.equal(moveRow(doc().rows, 2, 1)[1].edited, true);
  });

  it("leaves rows nobody touched unedited", () => {
    const rows = moveRow(doc().rows, 2, 1);
    assert.deepEqual(rows.filter((r) => r.edited).map((r) => r.title), ["원인"]);
  });

  it("merges into the earlier row and keeps its source", () => {
    const rows = mergeRows(doc().rows, [1, 2]);
    assert.equal(rows.length, 3);
    assert.equal(rows[1].title, "현상 · 원인");
    assert.equal(rows[1].source, "plan_spec.md#현상");
    assert.equal(rows[1].edited, true);
  });

  it("says which section a merge costs its own slide", () => {
    assert.match(mergeWarning(doc().rows, [1, 2]), /원인/);
  });

  it("warns before deleting the only slide carrying a section", () => {
    assert.match(deleteWarning(doc().rows, 1), /현상/);
  });

  it("marks an edited field and renumbers an added row", () => {
    const rows = addRow(doc().rows, 1);
    assert.equal(rows.length, 5);
    assert.deepEqual(rows.map((r) => r.n), [1, 2, 3, 4, 5]);
    assert.equal(patchRow(rows, 0, { title: "새 제목" })[0].edited, true);
  });
});

describe("the checks the screen shows before saving", () => {
  it("passes an outline that satisfies its frame", () => {
    const d = doc();
    const rows = addRow(d.rows, 3);
    const withAlt = patchRow(rows, 4, { role: "proposal_alt", layer: "what", title: "2안" });
    assert.deepEqual(checkOutline({ ...d, rows: withAlt }).filter((i) => i.tone === "block"), []);
  });

  it("blocks a problem deck with no alternative", () => {
    const codes = checkOutline(doc()).filter((i) => i.tone === "block").map((i) => i.code);
    assert.ok(codes.includes("E-ALT"));
  });

  it("blocks a deck that does not open on Why", () => {
    const d = doc();
    const rows = patchRow(d.rows, 1, { layer: "how" });
    const codes = checkOutline({ ...d, rows }).map((i) => i.code);
    assert.ok(codes.includes("E-OPEN"));
  });

  it("does not demand an alternative where the frame forbids one", () => {
    const d: Doc = { ...doc(), meta: [["frame", "teach"]] };
    assert.deepEqual(checkOutline(d).filter((i) => i.code === "E-ALT").length, 0);
  });
});

describe("그림 배치", () => {
  it("옛 파일에 그 줄이 없어도 읽힌다", () => {
    // 이 필드가 생기기 전에 만들어진 outline.md 가 이미 있다. 읽다가 죽거나
    // 값이 undefined 가 되면 그 파일을 열자마자 화면이 망가진다.
    const old = FILE.split("\n").filter((l) => !l.startsWith("  image:")).join("\n");
    const doc = parseOutline(old);
    assert.equal(doc.rows.length, 4);
    for (const r of doc.rows) assert.equal(r.image, "none");
  });

  it("다시 쓰면 그 줄이 생긴다", () => {
    const old = FILE.split("\n").filter((l) => !l.startsWith("  image:")).join("\n");
    assert.match(serializeOutline(parseOutline(old)), /^ {2}image: none$/m);
  });

  it("네 가지뿐이고 안 씀이 기본", () => {
    assert.deepEqual(IMAGE_USES.map((u) => u.id), ["none", "full", "side", "overlap"]);
  });
});

describe("장 모양", () => {
  const art = readFileSync(
    new URL("../ui/src/outline/art.tsx", import.meta.url), "utf8");
  const drawn = new Set([...art.matchAll(/case "([a-z_0-9]+)":/g)].map((m) => m[1]));

  it("고를 수 있는 모양은 모두 그려진다", () => {
    // 목록만 늘리고 그림을 안 그리면 화면이 거짓말을 한다 — 다른 모양을 골라도
    // 같은 그림이 나오니, 고르는 사람은 아무것도 못 고른 셈이 된다.
    for (const s of SHAPES) {
      assert.ok(drawn.has(s.id), `«${s.label}»(${s.id}) 를 art.tsx 가 안 그린다`);
    }
  });

  it("모든 모양이 아는 무리에 든다", () => {
    const groups = new Set(SHAPE_GROUPS.map((g) => g.id));
    for (const s of SHAPES) assert.ok(groups.has(s.group), `${s.id} 무리 ${s.group}`);
  });

  it("빈 무리는 두지 않는다", () => {
    for (const g of SHAPE_GROUPS) {
      assert.ok(SHAPES.some((s) => s.group === g.id), `«${g.label}» 무리가 비었다`);
    }
  });

  it("고를 수 있는 모양이 스무 가지는 넘는다", () => {
    // 카탈로그에 76개가 있는데 열 개만 꺼내 쓰던 시절로 돌아가지 않게.
    assert.ok(SHAPES.length >= 20, `지금 ${SHAPES.length}가지`);
  });
});
