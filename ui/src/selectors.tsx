/* Visual pickers.

   The point of this screen is choosing what the slides will look like, so every
   picker shows the real thing wherever the server already renders one:
   deck previews, the 18 style thumbnails, real icon glyphs, reference imagery.
   Only where no asset exists (canvas proportions, narrative shape) do we draw. */

import { useEffect, useState } from "react";
import { Description, Label, Radio, RadioGroup, TextArea, TextField } from "@heroui/react";
import type { Dict } from "./api";
import { T, label, desc } from "./i18n";

export function Star() {
  return (
    <span
      className="ml-2 shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold"
      style={{ background: "var(--wdb-cyan)", color: "var(--wdb-charcoal)" }}
    >
      ★ {T.recommended}
    </span>
  );
}

const cardStyle = (on: boolean) => ({
  borderColor: on ? "var(--wdb-primary)" : "var(--border)",
  boxShadow: on ? "0 0 0 2px rgba(54,103,255,.18)" : "none",
  background: "var(--surface)",
});

/* ---- 1. thumbnail grid (template / visual style) ---------------------- */

export function ThumbChoice({
  items, value, onChange, recommended, srcFor, tags, cols = 3,
}: {
  items: Dict[]; value: string; onChange: (v: string) => void;
  recommended?: string; srcFor: (it: Dict) => string | null;
  tags?: Record<string, string>; cols?: number;
}) {
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}>
      {items.map((it) => {
        const src = srcFor(it);
        const on = value === it.id;
        return (
          <button key={it.id} type="button" onClick={() => onChange(it.id)}
                  aria-pressed={on}
                  className="overflow-hidden rounded-xl border p-0 text-left transition"
                  style={cardStyle(on)}>
            <div className="aspect-video w-full overflow-hidden border-b"
                 style={{ borderColor: "var(--border)", background: "var(--wdb-card-bg)" }}>
              {src ? (
                <img src={src} alt="" loading="lazy"
                     className="h-full w-full object-cover object-top" />
              ) : (
                <div className="grid h-full place-items-center text-xs" style={{ color: "var(--muted)" }}>
                  빈 화면에서 시작
                </div>
              )}
            </div>
            <div className="p-3">
              <div className="flex items-center text-sm font-semibold">
                <span className="truncate">{label(it)}</span>
                {recommended === it.id ? <Star /> : null}
              </div>
              {tags?.[it.id] ? (
                <div className="mt-0.5 text-xs font-medium" style={{ color: "var(--wdb-secondary)" }}>
                  {tags[it.id]}
                </div>
              ) : null}
              {desc(it) ? (
                <div className="mt-1 line-clamp-2 text-xs" style={{ color: "var(--muted)" }}>
                  {desc(it)}
                </div>
              ) : null}
            </div>
          </button>
        );
      })}
    </div>
  );
}

/* ---- 2. canvas proportions ------------------------------------------- */

const parseDim = (dim?: string): [number, number] => {
  const m = String(dim || "").match(/(\d+)\s*[×xX*]\s*(\d+)/);
  return m ? [Number(m[1]), Number(m[2])] : [16, 9];
};

/** Draw each canvas at its true aspect ratio — the shape IS the information. */
export function RatioChoice({
  items, value, onChange, recommended,
}: { items: Dict[]; value: string; onChange: (v: string) => void; recommended?: string }) {
  const BOX = 76;
  return (
    <div className="flex flex-wrap gap-3">
      {items.map((it) => {
        const [w, h] = parseDim(it.dim);
        const scale = BOX / Math.max(w, h);
        const on = value === it.id;
        return (
          <button key={it.id} type="button" onClick={() => onChange(it.id)} aria-pressed={on}
                  className="flex w-[136px] flex-col items-center gap-2 rounded-xl border p-3 transition"
                  style={cardStyle(on)}>
            <div className="grid h-[80px] w-full place-items-center">
              <div className="rounded-[3px] border-2"
                   style={{
                     width: Math.max(10, w * scale), height: Math.max(10, h * scale),
                     borderColor: on ? "var(--wdb-primary)" : "var(--border)",
                     background: on ? "rgba(54,103,255,.10)" : "var(--wdb-card-bg)",
                   }} />
            </div>
            <div className="w-full text-center">
              <div className="flex items-center justify-center text-xs font-semibold">
                <span className="truncate">{label(it)}</span>
              </div>
              <div className="mt-0.5 text-[11px]" style={{ color: "var(--muted)" }}>{it.dim}</div>
              {recommended === it.id ? <div className="mt-1"><Star /></div> : null}
            </div>
          </button>
        );
      })}
    </div>
  );
}

/* ---- 3. audience presets --------------------------------------------- */

export const AUDIENCE_PRESETS: { id: string; label: string; text: string }[] = [
  { id: "exec", label: "경영진 보고", text: "경영진 — 결론과 근거를 짧은 시간에 판단해야 하는 자리" },
  { id: "team", label: "팀 내부 공유", text: "같은 팀 실무자 — 배경은 알고 있고 세부와 다음 할 일이 필요함" },
  { id: "newbie", label: "신입·교육생", text: "처음 접하는 사람 — 용어부터 풀어서 설명해야 함" },
  { id: "client", label: "고객·투자자", text: "외부 고객과 투자자 — 신뢰와 근거가 먼저 필요함" },
  { id: "public", label: "외부 발표 청중", text: "행사·세미나 청중 — 띄워놓고 말로 설명하는 자리" },
  { id: "audit", label: "규제·심사기관", text: "심사·감사 담당자 — 빠짐없고 검증 가능해야 함" },
];

export const DIVERGENCE_PRESETS: { id: string; label: string; text: string }[] = [
  { id: "close", label: "원본 그대로", text: "문서의 순서와 표현을 최대한 그대로 따라가 주세요." },
  { id: "balanced", label: "균형 있게", text: "" },
  { id: "free", label: "자유롭게 재구성", text: "내용은 유지하되 순서와 표현은 자유롭게 다시 짜 주세요." },
];

function Chips({
  presets, active, onPick,
}: {
  presets: { id: string; label: string; text: string }[];
  active: string | null; onPick: (p: { id: string; text: string }) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {presets.map((p) => {
        const on = active === p.id;
        return (
          <button key={p.id} type="button" onClick={() => onPick(p)} aria-pressed={on}
                  className="rounded-full border px-3 py-1.5 text-sm font-medium transition"
                  style={{
                    borderColor: on ? "var(--wdb-primary)" : "var(--border)",
                    background: on ? "rgba(54,103,255,.10)" : "var(--surface)",
                    color: on ? "var(--wdb-primary)" : "var(--foreground)",
                  }}>
            {p.label}
          </button>
        );
      })}
    </div>
  );
}

/** Pick a starting point, then edit it — never a blank box. */
export function PresetField({
  legend, hint, presets, value, onChange, rows = 2, placeholder,
}: {
  legend: string; hint?: string; presets: { id: string; label: string; text: string }[];
  value: string; onChange: (v: string) => void; rows?: number; placeholder?: string;
}) {
  const active = presets.find((p) => p.text === value)?.id ?? null;
  return (
    <div className="flex flex-col gap-2">
      <div>
        <div className="text-sm font-semibold">{legend}</div>
        {hint ? <div className="text-xs" style={{ color: "var(--muted)" }}>{hint}</div> : null}
      </div>
      <Chips presets={presets} active={active} onPick={(p) => onChange(p.text)} />
      <TextField value={value} onChange={onChange}>
        <TextArea rows={rows} placeholder={placeholder} />
      </TextField>
    </div>
  );
}

/* ---- 4. narrative shape ---------------------------------------------- */

const A = "var(--wdb-primary)";
const N = "var(--border)";

/** Tiny abstract diagrams of how each mode arranges an argument. */
const MODE_SHAPES: Record<string, JSX.Element> = {
  text: (
    <>
      <rect x="22" y="6" width="44" height="52" rx="4" fill="var(--surface)" stroke={N} strokeWidth="2" />
      {[0,1,2,3,4,5].map((i) => (
        <rect key={i} x="29" y={14 + i * 7} width={i === 5 ? 20 : 30} height="3" rx="1.5" fill={i === 0 ? A : N} />
      ))}
    </>
  ),
  balanced: (
    <>
      <rect x="4" y="14" width="36" height="36" rx="3" fill="var(--surface)" stroke={N} strokeWidth="2" />
      {[0,1,2].map((i) => <rect key={i} x="10" y={22 + i * 8} width="24" height="3" rx="1.5" fill={N} />)}
      <rect x="48" y="12" width="36" height="26" rx="3" fill={A} />
      <rect x="60" y="41" width="12" height="3" rx="1.5" fill={N} />
    </>
  ),
  presentation: (
    <>
      <rect x="8" y="8" width="72" height="38" rx="4" fill={A} />
      <rect x="20" y="20" width="34" height="6" rx="3" fill="var(--surface)" opacity="0.9" />
      <rect x="20" y="31" width="22" height="4" rx="2" fill="var(--surface)" opacity="0.6" />
      <rect x="40" y="49" width="8" height="8" rx="1" fill={N} />
    </>
  ),
  pyramid: (
    <>
      <rect x="8" y="8" width="72" height="18" rx="3" fill={A} />
      <rect x="8" y="32" width="20" height="24" rx="3" fill={N} />
      <rect x="34" y="32" width="20" height="24" rx="3" fill={N} />
      <rect x="60" y="32" width="20" height="24" rx="3" fill={N} />
    </>
  ),
  narrative: (
    <>
      <path d="M8 48 C 26 48, 30 16, 44 16 S 62 50, 80 20" fill="none" stroke={A} strokeWidth="4"
            strokeLinecap="round" />
      <circle cx="80" cy="20" r="5" fill={A} />
    </>
  ),
  instructional: (
    <>
      <rect x="8" y="42" width="20" height="14" rx="3" fill={N} />
      <rect x="34" y="30" width="20" height="26" rx="3" fill={N} />
      <rect x="60" y="16" width="20" height="40" rx="3" fill={A} />
    </>
  ),
  showcase: (
    <>
      <rect x="8" y="8" width="72" height="36" rx="4" fill={A} />
      <rect x="8" y="49" width="34" height="7" rx="3" fill={N} />
    </>
  ),
  briefing: (
    <>
      {[0, 1, 2].map((c) =>
        [0, 1].map((r) => (
          <rect key={`${c}${r}`} x={8 + c * 26} y={12 + r * 24} width="20" height="18" rx="3"
                fill={c === 0 && r === 0 ? A : N} />
        )))}
    </>
  ),
};

export function DiagramChoice({
  items, value, onChange, recommended,
}: { items: Dict[]; value: string; onChange: (v: string) => void; recommended?: string }) {
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(190px,1fr))" }}>
      {items.map((it) => {
        const on = value === it.id;
        return (
          <button key={it.id} type="button" onClick={() => onChange(it.id)} aria-pressed={on}
                  className="rounded-xl border p-3 text-left transition" style={cardStyle(on)}>
            <svg viewBox="0 0 88 64" className="mb-2 h-14 w-full" aria-hidden="true">
              {MODE_SHAPES[it.id] ?? <rect x="8" y="8" width="72" height="48" rx="4" fill={N} />}
            </svg>
            <div className="flex items-center text-sm font-semibold">
              <span className="truncate">{label(it)}</span>
              {recommended === it.id ? <Star /> : null}
            </div>
            {desc(it) ? (
              <div className="mt-1 line-clamp-2 text-xs" style={{ color: "var(--muted)" }}>{desc(it)}</div>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/* ---- 5. icon libraries with real glyphs ------------------------------- */

export function IconChoice({
  items, value, onChange, recommended,
}: { items: Dict[]; value: string; onChange: (v: string) => void; recommended?: string }) {
  const [previews, setPreviews] = useState<Record<string, { name: string; svg: string }[]>>({});
  useEffect(() => {
    fetch("/api/icon-previews", { cache: "no-store" })
      .then((r) => r.json()).then(setPreviews).catch(() => {});
  }, []);
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(230px,1fr))" }}>
      {items.map((it) => {
        const on = value === it.id;
        const glyphs = (previews[it.id] || []).slice(0, 5);
        return (
          <button key={it.id} type="button" onClick={() => onChange(it.id)} aria-pressed={on}
                  className="rounded-xl border p-3 text-left transition" style={cardStyle(on)}>
            <div className="mb-2 flex h-8 items-center gap-3"
                 style={{ color: on ? "var(--wdb-primary)" : "var(--foreground)" }}>
              {glyphs.length
                ? glyphs.map((g, i) => (
                    <span key={i} className="h-6 w-6 shrink-0"
                          dangerouslySetInnerHTML={{ __html: g.svg }} />
                  ))
                : <span className="text-xs" style={{ color: "var(--muted)" }}>—</span>}
            </div>
            <div className="flex items-center text-sm font-semibold">
              <span className="truncate">{label(it)}</span>
              {recommended === it.id ? <Star /> : null}
            </div>
            {desc(it) ? (
              <div className="mt-1 line-clamp-2 text-xs" style={{ color: "var(--muted)" }}>{desc(it)}</div>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/* ---- 6. plain radio list (kept for short, text-only sets) ------------- */

export function Choice({
  legend, items, value, onChange, recommended,
}: {
  legend?: string; items: Dict[]; value: string;
  onChange: (v: string) => void; recommended?: string;
}) {
  return (
    <RadioGroup value={value} onChange={onChange}>
      {legend ? <Label>{legend}</Label> : null}
      {items.map((it) => (
        <Radio key={it.id} value={it.id}>
          <Radio.Content>
            <Radio.Control><Radio.Indicator /></Radio.Control>
            <span>{label(it)}{recommended === it.id ? <Star /> : null}</span>
          </Radio.Content>
          {desc(it) ? <Description>{desc(it)}</Description> : null}
        </Radio>
      ))}
    </RadioGroup>
  );
}
