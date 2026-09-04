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
  /** 그림을 어떻게 쓰는 장인가. `shape`(차트 모양)와는 다른 축이다 — 모양은
      자료를 어떤 그림으로 보여줄지이고, 이쪽은 사진이 지면을 어떻게 차지하는지.
      `outline.py` 의 `IMAGE_USES` 와 같은 값이어야 하고, 두 파일이 어긋나면
      `tests/test_gates.py` 가 잡는다. */
  image: string;
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
      image: get("image", "none"),
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
    `  image: ${s.image || "none"}`,
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
    title: "", screen: "", script: "", shape: "body", source: "",
    image: "none", edited: true,
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

/** 고를 수 있는 장 모양. 모든 id 가 `templates/charts/charts_index.json` 에
    있으므로 E-SHAPE 에 걸리지 않는다.

    카탈로그에는 76개가 있는데 오랫동안 10개만 꺼내 썼다. 그래서 만들어진 덱이
    다 비슷해 보였다 — 자동 배정이 쓰는 것은 그중 일곱뿐이었다. 무리로 묶어
    늘린다: 같은 2열이라도 글만 나란히 놓는 것과 장단점을 가르는 것은 다른
    장이고, 표 안에 막대가 박힌 것은 표도 그래프도 아닌 제3의 것이다. */
export const SHAPE_GROUPS: { id: string; label: string }[] = [
  { id: "text", label: "글 · 목록" },
  { id: "columns", label: "나란히" },
  { id: "quadrant", label: "사분면" },
  { id: "metric", label: "수치" },
  { id: "chart", label: "그래프" },
  { id: "table", label: "표" },
  { id: "flow", label: "흐름" },
  { id: "structure", label: "구조" },
];

export const SHAPES: { id: string; label: string; note: string; group: string }[] = [
  { id: "body", label: "글 위주", note: "설명 문장으로 가는 기본 장", group: "text" },
  { id: "vertical_list", label: "항목 나열", note: "서너 개 항목과 설명", group: "text" },
  { id: "agenda_list", label: "차례", note: "목차 · 오늘 다룰 것", group: "text" },
  { id: "labeled_card", label: "이름표 카드", note: "한 주제의 서너 측면", group: "text" },

  { id: "comparison_columns", label: "두 갈래 비교", note: "전후 · A와 B", group: "columns" },
  { id: "pros_cons_chart", label: "장단점", note: "좋은 점과 걸리는 점", group: "columns" },
  { id: "vertical_pillars", label: "세 기둥", note: "3~5개를 세로 기둥으로", group: "columns" },
  { id: "icon_grid", label: "아이콘 격자", note: "4~9개 기능·서비스", group: "columns" },

  { id: "matrix_2x2", label: "2×2 자리잡기", note: "두 축에 항목을 놓는다", group: "quadrant" },
  { id: "quadrant_text_bullets", label: "사분면 + 글", note: "SWOT 같은 네 칸", group: "quadrant" },

  { id: "kpi_cards", label: "수치 카드", note: "숫자 서너 개를 나란히", group: "metric" },
  { id: "progress_bar_chart", label: "달성률 막대", note: "항목마다 몇 % 왔는지", group: "metric" },
  { id: "gauge_chart", label: "게이지", note: "하나의 지표가 목표 대비 얼마", group: "metric" },

  { id: "grouped_bar_chart", label: "막대 그래프", note: "기간별 값 비교", group: "chart" },
  { id: "line_chart", label: "선 그래프", note: "시간에 따른 방향", group: "chart" },
  { id: "donut_chart", label: "도넛", note: "전체 안의 몫 + 가운데 숫자", group: "chart" },
  { id: "waterfall_chart", label: "증감 폭포", note: "무엇이 더하고 무엇이 뺐나", group: "chart" },
  { id: "dumbbell_chart", label: "변화 막대", note: "두 시점 사이의 이동", group: "chart" },

  { id: "basic_table", label: "표", note: "칸으로 나뉜 자료", group: "table" },
  { id: "consulting_table", label: "표 + 막대", note: "표 칸 안에 작은 막대까지", group: "table" },
  { id: "comparison_table", label: "비교 표", note: "여러 안을 여러 기준으로", group: "table" },

  { id: "numbered_steps", label: "번호 단계", note: "순서가 있는 이야기", group: "flow" },
  { id: "chevron_process", label: "화살표 단계", note: "단계마다 산출물이 있을 때", group: "flow" },
  { id: "timeline", label: "타임라인", note: "시간 순 흐름", group: "flow" },
  { id: "journey_map", label: "여정 지도", note: "단계별로 하는 일과 감정", group: "flow" },

  { id: "hub_spoke", label: "중심 · 가지", note: "핵심 하나와 둘러싼 것들", group: "structure" },
  { id: "layered_architecture", label: "층 구조", note: "위아래로 쌓인 계층", group: "structure" },
  { id: "pyramid_chart", label: "피라미드", note: "아래가 넓은 층", group: "structure" },
  { id: "venn_diagram", label: "벤 다이어그램", note: "겹치는 데가 하고 싶은 말", group: "structure" },
];

/** 그림을 어떻게 쓰는 장인가. `outline.py` 의 `IMAGE_USES` 를 그대로 옮긴 것이고,
    이름은 `design_spec_reference.md` 의 Layout Pattern Library 에서 왔다.
    두 파일이 어긋나면 `tests/test_gates.py` 가 값 이름을 대며 실패한다. */
export const IMAGE_USES: { id: string; label: string; note: string }[] = [
  { id: "none", label: "안 씀", note: "글과 도형으로만 가는 장" },
  { id: "full", label: "전면", note: "사진이 지면을 꽉 채우고 그 위에 글 — 강조·전환 장" },
  { id: "side", label: "옆에", note: "사진과 설명을 나란히" },
  { id: "overlap", label: "겹침", note: "제목이나 큰 숫자가 사진 가장자리에 걸침" },
];

/** Local wall-clock stamp in the same shape `outline.py` writes `generated_at`. */
export function localStamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` +
         `T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
