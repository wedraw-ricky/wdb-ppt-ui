/* Stage 2 and 3 pickers.

   Same rule as stage 1 (DESIGN.md): show the thing being chosen. A palette is
   shown as a slide painted in it, a type plan as the actual size ladder, an
   image source as the kind of picture it produces — never as a name plus a
   row of chips the reader has to imagine assembled. */

import { cardStyle, Star } from "./selectors";
import aiArt from "./art/src-ai.png";
import noneArt from "./art/src-none.png";
import placeholderArt from "./art/src-placeholder.png";
import providedArt from "./art/src-provided.png";
import webArt from "./art/src-web.png";
import { label, desc } from "./i18n";

type Dict = Record<string, any>;
type Palette = Record<string, string>;

/** A slide painted in a palette — the actual outcome of the choice. */
function MiniSlide({ p, w = 190 }: { p: Palette; w?: number }) {
  const h = Math.round((w * 9) / 16);
  const g = (k: string, f: string) => p?.[k] || f;
  return (
    <svg viewBox="0 0 320 180" width={w} height={h} role="img" aria-hidden="true"
         style={{ display: "block", borderRadius: 6, overflow: "hidden" }}>
      <rect width="320" height="180" fill={g("background", "#FFFFFF")} />
      <rect x="0" y="0" width="320" height="52" fill={g("primary", "#1B3F8F")} />
      <rect x="18" y="18" width="128" height="10" rx="2" fill="#FFFFFF" opacity="0.95" />
      <rect x="18" y="34" width="76" height="6" rx="2" fill={g("accent", "#00A651")} />
      <rect x="18" y="70" width="150" height="8" rx="2" fill={g("body_text", "#1A1D1C")} opacity="0.85" />
      <rect x="18" y="86" width="118" height="6" rx="2" fill={g("body_text", "#1A1D1C")} opacity="0.45" />
      <rect x="18" y="98" width="134" height="6" rx="2" fill={g("body_text", "#1A1D1C")} opacity="0.45" />
      <rect x="186" y="66" width="116" height="96" rx="8" fill={g("secondary_bg", "#EEF2F7")} />
      <circle cx="212" cy="92" r="13" fill={g("accent", "#00A651")} />
      <rect x="198" y="116" width="80" height="6" rx="2" fill={g("body_text", "#1A1D1C")} opacity="0.55" />
      <rect x="198" y="130" width="58" height="6" rx="2" fill={g("body_text", "#1A1D1C")} opacity="0.3" />
      <rect x="18" y="128" width="46" height="18" rx="9" fill={g("secondary_accent", "#6D6E71")} opacity="0.9" />
      <rect x="18" y="158" width="284" height="2" fill={g("accent", "#00A651")} opacity="0.35" />
    </svg>
  );
}

export function PaletteChoice({
  candidates, selectedIndex, recommendedIndex, onSelect, nameOf, noteOf,
}: {
  candidates: Dict[]; selectedIndex: number; recommendedIndex: number;
  onSelect: (i: number) => void; nameOf: (c: Dict) => string; noteOf: (c: Dict) => string;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {candidates.map((c, i) => {
        const on = i === selectedIndex;
        return (
          <button key={i} type="button" onClick={() => onSelect(i)} aria-pressed={on}
                  className="overflow-hidden rounded-xl border p-0 text-left transition"
                  style={cardStyle(on)}>
            <div className="border-b p-3" style={{ borderColor: "var(--border)", background: "var(--wdb-card-bg)" }}>
              <MiniSlide p={c.palette || {}} w={252} />
            </div>
            <div className="p-4">
              <div className="flex items-center text-[15px] font-semibold">
                <span className="truncate">{nameOf(c)}</span>
                {i === recommendedIndex ? <Star /> : null}
              </div>
              {noteOf(c) ? (
                <div className="mt-1.5 text-[13px] leading-relaxed" style={{ color: "var(--muted)" }}>
                  {noteOf(c)}
                </div>
              ) : null}
              <div className="mt-3 flex gap-1.5">
                {Object.entries(c.palette || {}).map(([k, v]) => (
                  <span key={k} title={k} className="h-5 w-5 rounded border"
                        style={{ background: v as string, borderColor: "var(--border)" }} />
                ))}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

/** Per-role HEX with a live chip, at the same type size as every other field. */
export function HexGrid({
  palette, roles, onChange,
}: { palette: Palette; roles: Record<string, string>; onChange: (role: string, v: string) => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Object.keys(palette || {}).map((role) => (
        <label key={role} className="flex items-center gap-3 rounded-lg border px-3 py-2.5"
               style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <span className="h-8 w-8 shrink-0 rounded border"
                style={{ background: palette[role], borderColor: "var(--border)" }} />
          <span className="min-w-0 flex-1">
            <span className="block text-[13px]" style={{ color: "var(--muted)" }}>{roles[role] || role}</span>
            <input value={palette[role] ?? ""} onChange={(e) => onChange(role, e.target.value)}
                   spellCheck={false}
                   className="w-full bg-transparent text-[15px] font-medium outline-none"
                   style={{ color: "var(--foreground)" }} />
          </span>
        </label>
      ))}
    </div>
  );
}

/** The size ladder, drawn at its real proportions and editable in place. */
const RAMP: { key: string; ko: string; sample: string }[] = [
  { key: "title", ko: "제목", sample: "슬라이드 제목이 이 크기입니다" },
  { key: "subtitle", ko: "부제목", sample: "부제목은 이 정도" },
  { key: "body", ko: "본문", sample: "본문 글씨가 이 크기로 보입니다" },
  { key: "annotation", ko: "작은 설명", sample: "출처와 각주는 이 크기" },
];

export function TypeSpecimen({
  typography, onBody, onRole,
}: {
  typography: Dict;
  onBody: (v: string) => void;
  onRole: (role: string, v: string) => void;
}) {
  const headCss = typography?.heading?.css;
  const bodyCss = typography?.body?.css;
  const px = (k: string) =>
    k === "body" ? Number(typography?.body_size) || 16 : Number(typography?.sizes?.[k]) || 0;
  // the canvas is 1280 wide; the specimen column is ~640, so halve to keep the
  // ladder honest rather than showing every role at its raw px
  const SCALE = 0.5;

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border p-5" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
        {RAMP.map((r) => (
          <div key={r.key} className="flex items-baseline gap-3 border-b py-2.5 last:border-0"
               style={{ borderColor: "var(--border)" }}>
            <span className="w-16 shrink-0 text-[13px]" style={{ color: "var(--muted)" }}>{r.ko}</span>
            <span className="min-w-0 flex-1 truncate"
                  style={{
                    fontFamily: r.key === "title" || r.key === "subtitle" ? headCss : bodyCss,
                    fontSize: Math.max(11, px(r.key) * SCALE),
                    fontWeight: r.key === "title" ? 700 : r.key === "subtitle" ? 600 : 400,
                    color: "var(--foreground)",
                  }}>
              {r.sample}
            </span>
            <input
              value={String(r.key === "body" ? (typography?.body_size ?? "") : (typography?.sizes?.[r.key] ?? ""))}
              onChange={(e) => (r.key === "body" ? onBody(e.target.value) : onRole(r.key, e.target.value))}
              inputMode="decimal"
              className="w-16 shrink-0 rounded border bg-transparent px-2 py-1 text-right text-[15px] outline-none"
              style={{ borderColor: "var(--border)", color: "var(--foreground)" }} />
            <span className="w-6 shrink-0 text-[13px]" style={{ color: "var(--muted)" }}>px</span>
          </div>
        ))}
      </div>
      <div className="text-[13px] leading-relaxed" style={{ color: "var(--muted)" }}>
        본문 크기를 바꾸면 제목·부제목·작은 설명이 지금 비율 그대로 따라 움직입니다.
        화면 px는 파워포인트 pt의 약 0.75배입니다 — 본문 {px("body")}px ≈ {Math.round(px("body") * 0.75 * 10) / 10}pt.
      </div>
    </div>
  );
}

/** Page count: pick a length, then adjust the number. Never a blank box. */
const LENGTHS = [
  { id: "short", ko: "짧게", range: "8-10", hint: "핵심만 빠르게" },
  { id: "normal", ko: "보통", range: "11-14", hint: "설명과 근거를 함께" },
  { id: "long", ko: "길게", range: "15-20", hint: "자료를 두루 담아" },
];

export function PageCount({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const n = parseInt(String(value).match(/\d+/)?.[0] || "0", 10);
  const ticks = Math.min(Math.max(n, 0), 24);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2.5">
        {LENGTHS.map((l) => {
          const on = String(value) === l.range;
          return (
            <button key={l.id} type="button" onClick={() => onChange(l.range)} aria-pressed={on}
                    className="rounded-full border px-4 py-2 text-[15px] transition"
                    style={cardStyle(on)}>
              {l.ko} <span style={{ color: "var(--muted)" }}>{l.range}쪽 · {l.hint}</span>
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-3">
        <input value={value ?? ""} onChange={(e) => onChange(e.target.value)}
               placeholder="예: 11 또는 10-12"
               className="w-40 rounded-lg border px-3 py-2.5 text-[15px] outline-none"
               style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--foreground)" }} />
        {ticks ? (
          <span className="flex flex-wrap items-center gap-1" aria-hidden="true">
            {Array.from({ length: ticks }, (_, i) => (
              <span key={i} className="inline-block rounded-[2px]"
                    style={{ width: 9, height: 13, background: i === 0 ? "var(--wdb-primary)" : "var(--border)" }} />
            ))}
          </span>
        ) : null}
      </div>
    </div>
  );
}

/** Image sources, drawn. Each card shows the kind of picture it produces. */
/* 이미지를 어디서 가져올지 고르는 다섯 카드의 그림. 예전에는 여기도 도형을
   얹어 만든 아이콘이었는데, 얇은 선 아이콘 다섯 개는 어느 서비스에나 붙어
   있는 얼굴이라 "그냥 갖다 붙인 화면" 으로 읽혔다. 한 세트로 그려 넣는다 —
   같은 장 한 장, 같은 선 굵기, 같은 정면 시점. 옆에 이름과 설명이 이미 있으니
   그림은 거드는 쪽이고, 그래서 alt 는 비운다. */
const SOURCE_ART: Record<string, string> = {
  ai: aiArt, web: webArt, provided: providedArt,
  placeholder: placeholderArt, none: noneArt,
};

export function ImageSourceChoice({
  items, value, onChange, recommended,
}: {
  items: Dict[]; value: string[]; onChange: (v: string[]) => void; recommended: string[];
}) {
  const on = (id: string) => (value || []).includes(id);
  const toggle = (id: string) => {
    const cur = value || [];
    if (id === "none") return onChange(on("none") ? [] : ["none"]);
    const next = cur.filter((v) => v !== "none");
    onChange(on(id) ? next.filter((v) => v !== id) : [...next, id]);
  };
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {items.map((it) => (
        <button key={it.id} type="button" onClick={() => toggle(it.id)} aria-pressed={on(it.id)}
                className="overflow-hidden rounded-xl border p-0 text-left transition"
                style={cardStyle(on(it.id))}>
          <div className="border-b" style={{ borderColor: "var(--border)", background: "var(--wdb-card-bg)" }}>
            <img src={SOURCE_ART[it.id] ?? SOURCE_ART.none} alt="" draggable={false}
                 className="mx-auto h-[84px] w-full object-contain py-2" />
          </div>
          <div className="p-4">
            <div className="flex items-center text-[15px] font-semibold">
              <span className="truncate">{label(it)}</span>
              {recommended.includes(it.id) ? <Star /> : null}
            </div>
            {desc(it) ? (
              <div className="mt-1.5 line-clamp-3 text-[13px] leading-relaxed" style={{ color: "var(--muted)" }}>
                {desc(it)}
              </div>
            ) : null}
          </div>
        </button>
      ))}
    </div>
  );
}

/** Generated-image style: show the reference frames, not a field list. */
export function StrategyChoice({
  candidates, selectedIndex, recommendedIndex, onSelect, nameOf, noteOf,
}: {
  candidates: Dict[]; selectedIndex: number; recommendedIndex: number;
  onSelect: (i: number) => void; nameOf: (c: Dict) => string; noteOf: (c: Dict) => string;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {candidates.map((c, i) => {
        const on = i === selectedIndex;
        return (
          <button key={i} type="button" onClick={() => onSelect(i)} aria-pressed={on}
                  className="overflow-hidden rounded-xl border p-0 text-left transition"
                  style={cardStyle(on)}>
            <div className="grid grid-cols-2 border-b" style={{ borderColor: "var(--border)" }}>
              {[["rendering", c.rendering], ["palette", c.palette]].map(([kind, id]) => (
                <img key={kind as string} loading="lazy" alt=""
                     src={`/ai-image-comparison/${kind}/${encodeURIComponent(String(id))}.jpg`}
                     className="aspect-square w-full object-cover"
                     onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = "hidden"; }} />
              ))}
            </div>
            <div className="p-4">
              <div className="flex items-center text-[15px] font-semibold">
                <span className="truncate">{nameOf(c)}</span>
                {i === recommendedIndex ? <Star /> : null}
              </div>
              {c.mood ? (
                <div className="mt-1 text-[13px] font-medium" style={{ color: "var(--wdb-secondary)" }}>{c.mood}</div>
              ) : null}
              {noteOf(c) || c.visual ? (
                <div className="mt-1.5 line-clamp-3 text-[13px] leading-relaxed" style={{ color: "var(--muted)" }}>
                  {c.visual || noteOf(c)}
                </div>
              ) : null}
            </div>
          </button>
        );
      })}
    </div>
  );
}
