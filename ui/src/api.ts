/* Contract layer. Mirrors the payload the vanilla page produced so result.json
   is byte-compatible: same keys, same stage names, same validation. Nothing
   here talks to HeroUI — keeping it separate is what let the port be verified
   by diffing result.json against the original UI. */

export type Dict = Record<string, any>;

export interface Recommendations {
  lang?: string;
  stage?: string;
  recommend?: Dict;
  [k: string]: any;
}

const PPT_IDS = new Set(["ppt169", "ppt43"]);

export function isPptCanvas(canvas: string, catalogs: Dict): boolean {
  const id = String(canvas || "").toLowerCase();
  if (PPT_IDS.has(id)) return true;
  const entry = (catalogs.canvas || []).find((c: Dict) => c.id === canvas);
  const raw = String(entry?.dim || canvas || "");
  return /1280\s*[×xX*]\s*720/.test(raw) || /1024\s*[×xX*]\s*768/.test(raw);
}

/** One fixed px per delivery purpose on PPT (strategist.md §g). */
export function defaultBodySize(canvas: string, purpose: string, catalogs: Dict): number {
  if (isPptCanvas(canvas, catalogs)) {
    if (purpose === "text") return 20;
    if (purpose === "presentation") return 32;
    return 24;
  }
  const entry = (catalogs.canvas || []).find((c: Dict) => c.id === canvas);
  const h = Number(String(entry?.dim || "").split(/[×xX*]/)[1]) || 720;
  return Math.round(h * 0.029);
}

export const roundSize = (n: number) => Math.round(n * 100) / 100;

export async function getJson(path: string): Promise<any> {
  const r = await fetch(path, { cache: "no-store" });
  if (!r.ok) throw new Error(`${path} → ${r.status}`);
  return r.json();
}

export function firstCandidate(block: any): any {
  if (!block) return null;
  if (Array.isArray(block.candidates) && block.candidates.length) {
    const i = Number(block.selected) || 0;
    return block.candidates[i] || block.candidates[0];
  }
  // 후보가 셋이 아니라 고정 한 벌인 경우. 계약(Step 4)이 허용하는 모양이다 —
  // 이 저장소는 덱 서체를 Pretendard 로 고정하므로 글꼴은 늘 이쪽이다.
  // 배열만 읽던 시절에는 이 모양이 조용히 null 이 되어, 필수 항목인 글꼴이
  // 빈 채로 확정까지 갔다. 알아보게 만든다.
  if (block.heading || block.body || block.palette) return block;
  return null;
}

/** 후보 블록이든 맨 값이든 받아 쓴다. `page_count: 6` 처럼 숫자로 쓴 것이
    `{value}` 만 읽는 쪽을 만나 빈 칸이 됐다 — 계약은 둘 다 쓴다. */
export function plainValue(block: any): string {
  if (block === null || block === undefined) return "";
  if (typeof block === "object") return String(block.value ?? "");
  return String(block);
}

/** Build the editable state from the AI's recommendations. */
export function initialState(rec: Recommendations, catalogs: Dict): Dict {
  const R = rec.recommend || {};
  const color = firstCandidate(rec.color);
  const typo = firstCandidate(rec.typography);
  const strategy = firstCandidate(rec.image_strategy);
  const canvas = R.canvas || catalogs.canvas?.[0]?.id || "ppt169";
  const purpose = R.delivery_purpose || "balanced";
  const bodySize = Number(typo?.body_size) || defaultBodySize(canvas, purpose, catalogs);

  const usage = Array.isArray(R.image_usage)
    ? R.image_usage.slice()
    : R.image_usage ? [R.image_usage] : ["none"];

  return {
    canvas,
    page_count: plainValue(rec.page_count),
    audience: plainValue(rec.audience),
    content_divergence: plainValue(rec.content_divergence),
    mode: R.mode || "briefing",
    visual_style: R.visual_style || "editorial",
    template: R.template || "free",
    template_adherence: R.template_adherence,
    delivery_purpose: purpose,
    color: color ? { name: color.name_ko || color.name || "", palette: { ...color.palette } } : null,
    icons: R.icons || "tabler-outline",
    typography: typo
      ? {
          name: typo.name_ko || typo.name || "",
          heading: { ...typo.heading },
          body: { ...typo.body },
          body_size: bodySize,
          body_size_unit: "px",
          sizes: { title: 42, subtitle: 32, annotation: 18, ...(typo.sizes || {}) },
        }
      : null,
    formula_policy: R.formula_policy || "text-only",
    image_usage: usage,
    image_notes: rec.image_notes?.value ?? "",
    image_ai_path: R.image_ai_path || "auto",
    image_strategy: strategy ? { ...strategy } : null,
    generation_mode: R.generation_mode || "continuous",
    refine_spec: Boolean(rec.refine_spec?.value),
  };
}

export const needsAi = (usage: string[]) => usage.includes("ai");

function normalizeTypography(payload: Dict, catalogs: Dict) {
  const t = payload.typography;
  if (!t || typeof t !== "object") return;
  let body = parseFloat(t.body_size);
  if (!isFinite(body)) body = defaultBodySize(payload.canvas, payload.delivery_purpose, catalogs);
  t.body_size = roundSize(body);
  t.body_size_unit = "px";
}

/** Which decision each stage's preview must react to.
 *
 * DESIGN.md says the preview shows what is being chosen *right now*, and E-12
 * happened because that lived only in prose: the stage-1 screen read stage-2
 * fields, so nothing moved while someone picked a template.
 *
 * Keeping it here as data buys the guard for E-10 as well. Every field a stage
 * payload carries has to be claimed by exactly one stage below, and the model
 * tests fail when it is not — so a field added to one stage cannot quietly skip
 * the others' previews.
 */
export const PREVIEW_FIELDS: Record<number, readonly string[]> = {
  1: ["template", "template_adherence", "canvas", "audience",
      "content_divergence", "mode", "visual_style", "delivery_purpose"],
  2: ["page_count", "color", "icons", "typography", "formula_policy"],
  3: ["image_source", "image_usage", "generation_mode", "refine_spec"],
};

/** The fields a given stage's preview is responsible for. */
export function previewFieldsFor(stage: number): readonly string[] {
  return PREVIEW_FIELDS[stage] ?? [];
}

/** Every field any stage claims — the union the payloads are checked against. */
export function allPreviewFields(): Set<string> {
  return new Set(Object.values(PREVIEW_FIELDS).flat());
}

/** What was already settled, grouped by the stage that asked (E-8).
 *
 * The server derives this from `result.json` with the same stage split as
 * `PREVIEW_FIELDS`; the two are compared in `tests/test_confirm_server.py`.
 * An empty object means nothing is confirmed yet, which is the ordinary state
 * at the start of a run — never an error.
 */
export async function fetchConfirmed(): Promise<Record<string, Dict>> {
  try {
    const r = await fetch("/api/confirmed", { cache: "no-store" });
    if (!r.ok) return {};
    const data = await r.json();
    return data && typeof data === "object" ? data : {};
  } catch {
    return {};
  }
}

/** Stage 1 = direction anchors only (confirm_ui.md round-trip contract). */
export function stage1Payload(s: Dict, catalogs: Dict): Dict {
  const p: Dict = {
    stage: "stage1",
    canvas: s.canvas,
    audience: s.audience,
    content_divergence: s.content_divergence,
    mode: s.mode,
    visual_style: s.visual_style,
  };
  if (s.template) p.template = s.template;
  if (s.template_adherence) p.template_adherence = s.template_adherence;
  if (isPptCanvas(s.canvas, catalogs)) p.delivery_purpose = s.delivery_purpose;
  return p;
}

/** Stage 2 = anchors + design system. */
export function stage2Payload(s: Dict, catalogs: Dict): Dict {
  const p: Dict = {
    ...stage1Payload(s, catalogs),
    stage: "stage2",
    page_count: s.page_count,
    color: s.color,
    icons: s.icons,
    typography: s.typography ? JSON.parse(JSON.stringify(s.typography)) : null,
    formula_policy: s.formula_policy,
  };
  normalizeTypography(p, catalogs);
  return p;
}

export class ValidationError extends Error {}

/** Final payload — every field, with the image-usage rules the skill enforces. */
export function finalPayload(s: Dict, catalogs: Dict): Dict {
  const p: Dict = JSON.parse(JSON.stringify(s));
  normalizeTypography(p, catalogs);
  p.stage = "final";

  const valid = new Set((catalogs.image_usage || []).map((i: Dict) => i.id));
  p.image_usage = (Array.isArray(p.image_usage) ? p.image_usage : [p.image_usage])
    .filter((id: string) => valid.has(id));

  if (!p.image_usage.length) throw new ValidationError("image_usage_required");
  if (p.image_usage.includes("none") && p.image_usage.length > 1)
    throw new ValidationError("image_usage_none_exclusive");

  if (!String(p.image_notes || "").trim()) delete p.image_notes;
  if (!needsAi(p.image_usage)) {
    delete p.image_ai_path;
    delete p.image_strategy;
  }
  if (!isPptCanvas(p.canvas, catalogs)) delete p.delivery_purpose;
  return p;
}

export async function postConfirm(payload: Dict): Promise<void> {
  const r = await fetch("/api/confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error("confirm failed");
}

export async function shutdown(): Promise<void> {
  try {
    await fetch("/api/shutdown", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "confirmed" }),
    });
  } catch {
    /* the server closing the socket mid-response is the expected path */
  }
}

export interface ProgressNote {
  note: string;
  age_seconds: number;
}

/** What the agent has done so far. Ages, not clock times — the page decides
    which of these belong to the wait it is currently showing. */
export async function progressNotes(): Promise<ProgressNote[]> {
  try {
    const r = await fetch("/api/progress", { cache: "no-store" });
    if (!r.ok) return [];
    const body = await r.json();
    return Array.isArray(body?.notes) ? body.notes : [];
  } catch {
    return [];
  }
}

/** Tell the server the page is still open. Resolves false when it is gone. */
export async function heartbeat(): Promise<boolean> {
  try {
    const r = await fetch("/api/heartbeat", { method: "POST", cache: "no-store" });
    return r.ok;
  } catch {
    return false;
  }
}

/* ---------- planning artifacts ----------------------------------------
   These ride their own routes, not the three-stage machine. The confirm
   server owns intake.json / plan_spec.md / outline.md as separate files. */

export interface IntakeData {
  purpose: string;
  assignment: string;
  emphasis: string;
  conclusion: string;
  audience: string;
  interests: string[];
  doc_kind: string;
}

export const EMPTY_INTAKE: IntakeData = {
  purpose: "", assignment: "", emphasis: "", conclusion: "",
  audience: "", interests: [], doc_kind: "발표자료",
};

/** Purposes that additionally need the assigned-vs-proposed question. */
export const NEEDS_ASSIGNMENT = new Set([
  "사내 예산 · 의사결정 승인",
  "전략 제안",
]);

export async function readPlanning(name: string): Promise<any | null> {
  const res = await fetch(`/api/planning/${name}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GET /api/planning/${name} → ${res.status}`);
  return res.json();
}

export async function savePlanning(name: string, payload: Dict): Promise<void> {
  const res = await fetch(`/api/planning/${name}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`POST /api/planning/${name} → ${res.status}`);
}

/** Reject an intake that the planner cannot resolve a frame from. */
export function validateIntake(v: IntakeData): string | null {
  if (!v.purpose) return "무엇을 위한 자료인지 골라 주세요.";
  if (NEEDS_ASSIGNMENT.has(v.purpose) && !v.assignment)
    return "과제를 받으신 건지, 직접 제안하시는 건지 골라 주세요.";
  if (!v.conclusion.trim()) return "결론적으로 무엇을 말하고 싶으신지 적어 주세요.";
  return null;
}
