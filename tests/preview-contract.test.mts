/* Contract tests for the per-stage preview field map.
 *
 * Two defects sit behind this file. E-12: the stage-1 screen read stage-2
 * fields, so nothing moved while someone picked a template — the preview
 * looked hardcoded. E-10: stage 1 was redesigned and stages 2 and 3 followed a
 * day later, because "a rule applied to one stage applies to all of them" was
 * prose that nothing enforced.
 *
 * Both were fixed by hand and neither had a guard. The map in `api.ts` is that
 * guard: every field a stage payload sends must be claimed by exactly one
 * stage's preview, so a field added on one screen cannot skip the others.
 *
 * Usage:
 *     node --test --experimental-strip-types tests/
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  PREVIEW_FIELDS, allPreviewFields, previewFieldsFor,
  stage1Payload, stage2Payload, firstCandidate, plainValue,
} from "../ui/src/api.ts";

/** Catalogs stub: enough for `isPptCanvas` to treat 16:9 as a deck canvas. */
const CATALOGS = {
  canvas: [{ id: "16:9", kind: "ppt" }, { id: "a4", kind: "doc" }],
  image_usage: [],
};

/** A filled-in state — every anchor a stage payload knows how to send. */
const STATE = {
  canvas: "16:9",
  audience: "행정실장",
  content_divergence: "balanced",
  mode: "standard",
  visual_style: "swiss-minimal",
  template: "withby-green",
  template_adherence: "skin",
  delivery_purpose: "balanced",
  page_count: 12,
  color: { palette: ["#224C9D"] },
  icons: "line",
  typography: { body: 24 },
  formula_policy: "none",
};

/** Payload keys are the contract; `stage` is the envelope, not a decision. */
function payloadFields(payload: Record<string, unknown>): string[] {
  return Object.keys(payload).filter((k) => k !== "stage");
}

describe("preview field map", () => {
  it("covers every stage", () => {
    for (const stage of [1, 2, 3]) {
      assert.ok(previewFieldsFor(stage).length > 0,
        `stage ${stage} claims no field — its preview has nothing to track`);
    }
  });

  it("gives each decision to exactly one stage", () => {
    // A field claimed twice means two previews react to one decision, and the
    // person cannot tell which screen owns it.
    const seen = new Map<string, number>();
    for (const [stage, fields] of Object.entries(PREVIEW_FIELDS)) {
      for (const field of fields) {
        assert.equal(seen.get(field), undefined,
          `'${field}' is claimed by stage ${seen.get(field)} and ${stage}`);
        seen.set(field, Number(stage));
      }
    }
  });
});

describe("payloads and previews agree", () => {
  it("stage 1 sends nothing its preview ignores", () => {
    for (const field of payloadFields(stage1Payload(STATE, CATALOGS))) {
      assert.ok(allPreviewFields().has(field),
        `stage 1 sends '${field}' but no stage's preview claims it`);
    }
  });

  it("stage 2 sends nothing its preview ignores", () => {
    for (const field of payloadFields(stage2Payload(STATE, CATALOGS))) {
      assert.ok(allPreviewFields().has(field),
        `stage 2 sends '${field}' but no stage's preview claims it`);
    }
  });

  it("stage 2 carries stage 1 forward without stealing its preview", () => {
    // Stage 2's payload includes stage 1's anchors, but they stay stage 1's to
    // show. This is the E-12 shape: reading a later stage's fields early.
    const own = new Set(previewFieldsFor(2));
    for (const field of previewFieldsFor(1)) {
      assert.ok(!own.has(field), `stage 2 claims stage 1's '${field}'`);
    }
  });
});

describe("후보 블록의 두 가지 모양", () => {
  it("고정 한 벌도 읽는다 — 배열만 읽으면 글꼴이 조용히 빈다", () => {
    // 계약(Step 4)은 하드락 필드를 "후보 셋 대신 고정 한 벌" 로 쓰게 한다.
    // 배열만 읽던 시절, 필수 항목인 글꼴이 null 로 확정까지 갔다.
    const locked = { locked: true, heading: { name: "Pretendard SemiBold" },
                     body: { name: "Pretendard" }, body_size: 32 };
    assert.equal(firstCandidate(locked), locked);
  });

  it("후보 배열이 있으면 고른 것을 준다", () => {
    const block = { selected: 1, candidates: [{ name: "가" }, { name: "나" }] };
    assert.equal(firstCandidate(block).name, "나");
  });

  it("빈 블록은 여전히 null", () => {
    assert.equal(firstCandidate(null), null);
    assert.equal(firstCandidate({ candidates: [] }), null);
    assert.equal(firstCandidate({ note: "설명만 있는 것" }), null);
  });

  it("맨 값과 {value} 를 둘 다 받는다", () => {
    // page_count: 6 으로 쓴 것이 {value} 만 읽는 쪽을 만나 빈 칸이 됐다.
    assert.equal(plainValue(6), "6");
    assert.equal(plainValue({ value: "8-10" }), "8-10");
    assert.equal(plainValue(null), "");
  });
});
