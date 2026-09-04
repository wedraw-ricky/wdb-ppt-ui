/* outline.md ⇄ rows.

   The confirm server hands this artifact over as raw text — `/api/planning/
   outline` returns `.text`, not parsed JSON — so the screen owns both the read
   and the write. Both mirror `scripts/outline.py` `load()` / `dump()` exactly:
   one physical line per field, real newlines carried as a literal \n escape,
   quotes on the four free-text fields only. A round trip that drifts from that
   shape is read back wrong by `outline.py --check`, so this file is a contract
   mirror, not a convenience parser — see references/storyline.md §7. */

export type Layer = "why" | "how" | "what";

export interface Row {
  n: number;
  layer: Layer;
  role: string;
  title: string;
  screen: string;
  script: string;
  shape: string;
  source: string;
  /** Set on every row a person touches. storyline.md §8: a regeneration must
      never overwrite an edited row, so the mark has to survive the file. */
  edited: boolean;
}

export interface Doc {
  /** Frontmatter as ordered pairs — unknown keys are carried through untouched. */
  meta: [string, string][];
  rows: Row[];
}

/* ---- text ⇄ model ----------------------------------------------------- */

/** outline.py reads a field with `.strip().strip('"')`; match it exactly. */
const unquote = (v: string) => v.trim().replace(/^"+|"+$/g, "");
const decode = (v: string) => v.replace(/\\n/g, "\n");
/** Fields are one physical line, so a real newline has to leave as an escape. */
const encode = (v: string) => v.replace(/^"+|"+$/g, "").replace(/\r\n?|\n/g, "\\n");

const QUOTED = new Set(["title", "screen", "script", "source"]);
const closed = (raw: string) =>
  raw.startsWith('"') && raw.length > 1 && raw.trimEnd().endsWith('"');

/** Read one row block into fields.

    Tolerant where the reference implementation is lossy: `outline.py` `dump()`
    writes a real newline when a field holds one, and its own `load()` then
    reads only the first line and drops the rest. A screen whose job is editing
    that text must not inherit the loss, so an unclosed quote keeps consuming
    lines. What we write back is always the one-line escaped form §7 specifies,
    which `load()` reads correctly — so saving repairs such a file. */
function readBlock(block: string): Record<string, string> {
  const out: Record<string, string> = {};
  const lines = block.split("\n");
  let open: string | null = null;

  for (const line of lines.slice(1)) {
    if (open !== null) {
      out[open] += "\n" + line;
      if (line.trimEnd().endsWith('"')) open = null;
      continue;
    }
    const m = line.match(/^\s*([a-z_]+):\s*(.*)$/);
    if (!m) continue;
    const [, key, raw] = m;
    out[key] = raw;
    if (QUOTED.has(key) && raw.startsWith('"') && !closed(raw)) open = key;
  }
  return out;
}

export function parseOutline(text: string): Doc {
  let front = "";
  let body = text;
  if (text.startsWith("---")) {
    const rest = text.slice(3);
    const end = rest.indexOf("---");
    if (end >= 0) { front = rest.slice(0, end); body = rest.slice(end + 3); }
  }

  const meta: [string, string][] = [];
  for (const line of front.split("\n")) {
    const i = line.indexOf(":");
    if (i > 0) meta.push([line.slice(0, i).trim(), line.slice(i + 1).trim()]);
  }

  const rows: Row[] = [];
  for (const block of body.split(/^- n:\s*/m).slice(1)) {
    const f = readBlock(block);
    const get = (k: string, d = "") => (f[k] === undefined ? d : unquote(f[k]));
    rows.push({
      n: parseInt(block.split("\n", 1)[0].trim(), 10) || rows.length + 1,
      layer: (get("layer", "how") as Layer),
      role: get("role", "body"),
      title: decode(get("title")),
      screen: decode(get("screen")),
      script: decode(get("script")),
      shape: get("shape", "body"),
      source: decode(get("source")),
      edited: get("edited", "false") === "true",
    });
  }
  return { meta, rows };
}

export function serializeOutline(doc: Doc): string {
  const meta: [string, string][] = doc.meta.map(([k, v]) =>
    [k, k === "slide_count" ? String(doc.rows.length) : v]);
  if (!meta.some(([k]) => k === "slide_count"))
    meta.push(["slide_count", String(doc.rows.length)]);

  const head = `---\n${meta.map(([k, v]) => `${k}: ${v}`).join("\n")}\n---\n\n`;
  const rows = doc.rows.map((s) => [
    `- n: ${s.n}`,
    `  layer: ${s.layer}`,
    `  role: ${s.role}`,
    `  title: "${encode(s.title)}"`,
    `  screen: "${encode(s.screen)}"`,
    `  script: "${encode(s.script)}"`,
    `  shape: ${s.shape}`,
    `  source: "${encode(s.source)}"`,
    `  edited: ${s.edited ? "true" : "false"}`,
  ].join("\n"));
  return head + rows.join("\n\n") + "\n";
}

export const metaGet = (doc: Doc, key: string) =>
  doc.meta.find(([k]) => k === key)?.[1] ?? "";

export function metaSet(doc: Doc, key: string, value: string): Doc {
  const meta = doc.meta.slice();
  const at = meta.findIndex(([k]) => k === key);
  if (at >= 0) meta[at] = [key, value]; else meta.push([key, value]);
  return { ...doc, meta };
}

/* ---- edits (storyline.md §8) ------------------------------------------ */

const renumber = (rows: Row[]) => rows.map((r, i) => ({ ...r, n: i + 1 }));

/** Reorder. `n` is reassigned and `layer` is recomputed from the new position:
    a moved row adopts the layer of the row above it, or of the row below when
    it lands first. The golden-circle spine is what position means here. */
export function moveRow(rows: Row[], from: number, to: number): Row[] {
  if (from === to || from < 0 || to < 0 || from >= rows.length) return rows;
  const next = rows.slice();
  const [row] = next.splice(from, 1);
  next.splice(Math.min(to, next.length), 0, row);
  const at = next.indexOf(row);
  const neighbour = at > 0 ? next[at - 1] : next[at + 1];
  next[at] = { ...row, layer: neighbour ? neighbour.layer : row.layer, edited: true };
  return renumber(next);
}

/** Merge two or more rows into the earliest of them.

    storyline.md §8 keeps the earlier `source` and concatenates the bodies. It
    cannot keep both provenances in the field: `outline.py --check` reads one
    section per row (`source.split("#")[-1]`), so a second reference written
    there would be misread. The screen therefore says out loud that the later
    section loses its own slide — see `mergeWarning`. */
export function mergeRows(rows: Row[], picked: number[]): Row[] {
  const idx = picked.slice().sort((a, b) => a - b);
  if (idx.length < 2) return rows;
  const parts = idx.map((i) => rows[i]);
  const joined = (pick: (r: Row) => string, sep: string) =>
    parts.map(pick).map((s) => s.trim()).filter(Boolean).join(sep);

  const merged: Row = {
    ...parts[0],
    title: joined((r) => r.title, " · "),
    screen: joined((r) => r.screen, "\n"),
    script: joined((r) => r.script, "\n"),
    source: parts.find((r) => r.source.trim())?.source ?? "",
    edited: true,
  };
  const drop = new Set(idx.slice(1));
  return renumber(rows
    .map((r, i) => (i === idx[0] ? merged : r))
    .filter((_, i) => !drop.has(i)));
}

/** The sections a merge leaves without a slide of their own. */
export function mergeWarning(rows: Row[], picked: number[]): string {
  const idx = picked.slice().sort((a, b) => a - b);
  const lost = idx.slice(1)
    .map((i) => sectionOf(rows[i].source))
    .filter(Boolean);
  return lost.length
    ? `${lost.join(" · ")} 근거는 앞 장에 합쳐집니다 — 그 절이 확정이면 검사에서 걸립니다`
    : "";
}

export function deleteRow(rows: Row[], at: number): Row[] {
  return renumber(rows.filter((_, i) => i !== at));
}

/** Warn when the row being deleted is the only one carrying its section. */
export function deleteWarning(rows: Row[], at: number): string {
  const section = sectionOf(rows[at]?.source || "");
  if (!section) return "";
  const others = rows.some((r, i) => i !== at && sectionOf(r.source) === section);
  return others ? "" : `${section} 절은 이 장이 유일합니다 — 지우면 검사에서 걸릴 수 있습니다`;
}

export function addRow(rows: Row[], after: number): Row[] {
  const neighbour = rows[after] || rows[rows.length - 1];
  const blank: Row = {
    n: 0, layer: neighbour?.layer || "how", role: "body",
    title: "", screen: "", script: "", shape: "body", source: "", edited: true,
  };
  const next = rows.slice();
  next.splice(after + 1, 0, blank);
  return renumber(next);
}

export function patchRow(rows: Row[], at: number, patch: Partial<Row>): Row[] {
  return rows.map((r, i) => (i === at ? { ...r, ...patch, edited: true } : r));
}

const sectionOf = (source: string) =>
  source.includes("#") ? source.split("#").pop()!.trim() : "";

/* ---- the checks the user would otherwise meet only after saving -------- */

/** Frame → whether the deck carries an alternative. Mirrors plan_spec.py FRAMES. */
const FRAME_OPTIONS: Record<string, "on" | "off" | "tail" | "scenario"> = {
  problem: "on", hypothesis: "on", report: "tail",
  intro: "off", teach: "off", ir: "scenario",
};

export interface Issue {
  code: string;
  text: string;
  /** `block` — `outline.py --check` refuses. `warn` — the contract says so,
      but nothing stops the run. */
  tone: "block" | "warn";
}

/** Mirror of the `outline.py --check` rules that read outline.md alone.

    Coverage (E-COVER) and §IX parity (E-SYNC) need plan_spec.md and
    design_spec.md, which this screen does not hold — those stay with the
    script. Nothing here is a rule of the screen's own invention. */
export function checkOutline(doc: Doc): Issue[] {
  const out: Issue[] = [];
  const rows = doc.rows;
  const options = FRAME_OPTIONS[metaGet(doc, "frame")];

  if (rows.length >= 2 && rows[1].layer !== "why")
    out.push({ code: "E-OPEN", tone: "block",
               text: "2번째 장이 Why에 있지 않습니다 — 발표는 Why로 엽니다" });

  const roles = new Set(rows.map((r) => r.role));
  if (options === "on" && !roles.has("proposal_alt"))
    out.push({ code: "E-ALT", tone: "block",
               text: "2안(대안) 장이 없습니다 — 이대로는 만들기가 막힙니다" });
  if ((options === "off" || options === "scenario") && roles.has("proposal_alt"))
    out.push({ code: "E-ALT", tone: "block",
               text: "이 자료 유형은 2안을 쓰지 않습니다 — 2안 장을 지워 주세요" });
  if (options === "scenario" && !rows.some((r) => r.title.includes("시나리오")))
    out.push({ code: "E-IR", tone: "block",
               text: "재무 시나리오(보수·기본·공격) 장이 없습니다" });

  if (rows.length && rows[0].role !== "cover")
    out.push({ code: "COVER", tone: "warn", text: "1번째 장은 표지 자리입니다" });

  const blank = rows.filter((r) => !r.title.trim()).length;
  if (blank)
    out.push({ code: "TITLE", tone: "warn",
               text: `제목이 비어 있는 장이 ${blank}개 있습니다` });

  return out;
}

/* ---- display vocabulary ------------------------------------------------ */

export const LAYERS: { id: Layer; label: string; note: string }[] = [
  { id: "why", label: "Why", note: "왜 지금 이 이야기인가" },
  { id: "how", label: "How", note: "어떻게 풀어가는가" },
  { id: "what", label: "What", note: "무엇을 하자는 것인가" },
];

export const ROLE_LABELS: Record<string, string> = {
  cover: "표지",
  body: "본문",
  chapter: "간지",
  proposal_primary: "1안 · 권고",
  proposal_alt: "2안 · 대안",
  closing: "마무리",
};

/** The flows storyline.md §2.1 names, for reading back the one already chosen. */
export const FLOW_LABELS: Record<string, string> = {
  "background-first": "배경 → 현황 → 분석 → 제안 → 기대효과",
  "problem-first": "문제 → 원인 → 해결방안 → 기대효과",
  "goal-first": "현황 → 목표 → 전략 → 실행계획 → 성과지표",
  "case-first": "도입 → 사례 → 분석 → 시사점 → 결론",
  "why-what-how": "Why → What → How → 결과",
};

/** The layouts storyline.md §5 assigns. Every id is present in
    templates/charts/charts_index.json, so picking one can never raise E-SHAPE. */
export const SHAPES: { id: string; label: string; note: string }[] = [
  { id: "body", label: "글 위주", note: "설명 문장으로 가는 기본 장" },
  { id: "kpi_cards", label: "수치 카드", note: "숫자 서너 개를 나란히" },
  { id: "numbered_steps", label: "번호 단계", note: "순서가 있는 이야기" },
  { id: "comparison_columns", label: "두 갈래 비교", note: "전후 · A와 B" },
  { id: "vertical_list", label: "항목 나열", note: "서너 개 항목과 설명" },
  { id: "grouped_bar_chart", label: "막대 그래프", note: "기간별 값 비교" },
  { id: "dumbbell_chart", label: "변화 막대", note: "두 시점 사이의 이동" },
  { id: "pie_chart", label: "비중 원", note: "전체 안의 몫" },
  { id: "basic_table", label: "표", note: "칸으로 나뉜 자료" },
  { id: "timeline", label: "타임라인", note: "시간 순 흐름" },
];

/** Local wall-clock stamp in the same shape `outline.py` writes `generated_at`. */
export function localStamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` +
         `T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
