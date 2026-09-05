/* Visual pickers.

   The point of this screen is choosing what the slides will look like, so every
   picker shows the real thing wherever the server already renders one:
   deck previews, the 18 style thumbnails, real icon glyphs, reference imagery.
   Only where no asset exists (canvas proportions, narrative shape) do we draw. */

import { useEffect, useState } from "react";
import { pickStyle } from "./shell";
import { Pick } from "../system/pick";
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

/* 고르는 카드는 화면마다 같아야 한다. 예전에는 이것과 shell 의 pickStyle 두
   가지가 굴러다녀서, 같은 앱 안에서 어떤 카드는 그림자가 있고 어떤 카드는
   없었다. 이름은 남기되 한 곳을 보게 한다 — 부르는 자리를 다 고치는 것보다
   안전하고, 다음에 또 갈라지지 않는다. */
export const cardStyle = pickStyle;

/* ---- 1. thumbnail grid (template / visual style) ---------------------- */

export function ThumbChoice({
  items, value, onChange, recommended, srcFor, tags, cols = 3,
}: {
  items: Dict[]; value: string; onChange: (v: string) => void;
  recommended?: string; srcFor: (it: Dict) => string | null;
  tags?: Record<string, string>; cols?: number;
}) {
  return (
    <Pick cols={(cols as 2 | 3 | 4)} artHeight={148} value={value} onChange={onChange}
          ariaLabel="시안 고르기"
          items={items.map((it) => {
            const src = srcFor(it);
            return {
              id: String(it.id),
              label: label(it),
              star: recommended === it.id,
              note: [tags?.[String(it.id)], desc(it)].filter(Boolean).join(" — ") || undefined,
              art: src
                ? <img src={src} alt="" loading="lazy"
                       className="h-full w-full object-cover object-top" />
                : <span className="t-sub">빈 화면에서 시작</span>,
            };
          })} />
  );
}

/* ---- 2. canvas proportions ------------------------------------------- */

const parseDim = (dim?: string): [number, number] => {
  const m = String(dim || "").match(/(\d+)\s*[×xX*]\s*(\d+)/);
  return m ? [Number(m[1]), Number(m[2])] : [16, 9];
};

/* 크기 고르기. 비율 자체가 정보라 그 비율대로 그린다.

   예전에는 150px 짜리 좁은 칸에 회색 네모 조각을 얹어 놓아서, 뼈대 화면의
   스토리보드 카드와 말이 달랐다. 같은 앱에서 "장 하나" 를 보여주는 방식은
   하나여야 한다 — 카드가 넓게 서고, 그 안에 실제 비율이 크게 들어간다. */
export function RatioChoice({
  items, value, onChange, recommended,
}: { items: Dict[]; value: string; onChange: (v: string) => void; recommended?: string }) {
  const BOX = 104;
  return (
    <Pick cols={3} artHeight={136} value={value} onChange={onChange}
          ariaLabel="크기 고르기"
          items={items.map((it) => {
            const [w, h] = parseDim(it.dim);
            const scale = BOX / Math.max(w, h);
            const on = value === it.id;
            return {
              id: String(it.id),
              label: label(it),
              star: recommended === it.id,
              note: String(it.dim),
              // 비율 자체가 정보다 — 그 비율대로 그린다
              art: (
                <div className="rounded-[4px]"
                     style={{
                       width: Math.max(14, w * scale), height: Math.max(14, h * scale),
                       background: "var(--surface)",
                       border: `var(--w-on) solid ${on ? "var(--accent)" : "var(--line-strong)"}`,
                     }} />
              ),
            };
          })} />
  );
}

/* ---- 3. audience presets --------------------------------------------- */

export const IMAGE_PRESETS: { id: string; label: string; text: string }[] = [
  { id: "provided-only", label: "가진 사진만",
    text: "가지고 있는 실사진만 씁니다. 사진이 없는 페이지는 도형과 차트로 채웁니다." },
  { id: "cover-ai", label: "표지·간지만 생성",
    text: "표지와 간지에만 생성 이미지를 쓰고, 내용 페이지는 실사진과 도형으로 채웁니다." },
  { id: "mixed", label: "실사진 우선 + 빈 곳만 생성",
    text: "가진 실사진을 먼저 배치하고, 남는 자리만 생성 이미지로 채웁니다." },
  { id: "no-image", label: "사진 없이",
    text: "사진을 쓰지 않고 도형·차트·타이포만으로 구성합니다." },
];

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
                  className="rounded-[var(--r-pill)] border px-4 py-2 t-body transition"
                  style={{
                    // 누르는 것이므로 경계가 보여야 한다 (WCAG 1.4.11 — 3:1).
                    // --border 는 1.15:1 이라 칸막이용이고 조작 요소에는 못 쓴다.
                    minHeight: "var(--hit-min)",
                    borderWidth: on ? "var(--w-on)" : "var(--w-hair)",
                    borderColor: on ? "var(--accent)" : "var(--line-strong)",
                    background: on ? "var(--accent-wash)" : "var(--surface)",
                    color: on ? "var(--accent-ink)" : "var(--foreground)",
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
  legend, hint, presets, value, onChange, rows = 2, placeholder, ariaLabel,
}: {
  legend: string; hint?: string; presets: { id: string; label: string; text: string }[];
  value: string; onChange: (v: string) => void; rows?: number; placeholder?: string;
  /** 눈에 보이는 제목이 이 묶음 밖에 있을 때, 글 상자에 붙일 이름.
      없으면 화면 낭독기가 "편집" 이라고만 읽고 무슨 칸인지 말해주지 못한다. */
  ariaLabel?: string;
}) {
  const active = presets.find((p) => p.text === value)?.id ?? null;
  return (
    <div className="flex flex-col gap-2">
      <div>
        <div className="text-base font-semibold">{legend}</div>
        {hint ? <div className="mt-0.5 text-[13px]" style={{ color: "var(--muted)" }}>{hint}</div> : null}
      </div>
      <Chips presets={presets} active={active} onPick={(p) => onChange(p.text)} />
      {/* 한 줄이 길어지면 눈이 다음 줄 첫 글자를 놓친다. 한글은 45자쯤이 끝이라
          입력칸도 본문 폭을 그대로 쓰지 않고 읽기 좋은 폭에서 멈춘다. */}
      <TextField className="max-w-[58ch]" value={value} onChange={onChange}>
        <TextArea rows={rows} placeholder={placeholder} aria-label={ariaLabel || legend || undefined} />
      </TextField>
    </div>
  );
}

/* ---- 4. narrative shape ---------------------------------------------- */

const A = "var(--wdb-primary)";
const N = "var(--border)";

/** Tiny abstract diagrams of how each mode arranges an argument. */
export const MODE_SHAPES: Record<string, JSX.Element> = {
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
    <Pick cols={3} artHeight={104} value={value} onChange={onChange}
          ariaLabel="이야기 방식 고르기"
          items={items.map((it) => ({
            id: String(it.id),
            label: label(it),
            star: recommended === it.id,
            note: desc(it) || undefined,
            art: (
              <svg viewBox="0 0 88 64" className="h-16 w-auto" aria-hidden="true">
                {MODE_SHAPES[String(it.id)]
                  ?? <rect x="8" y="8" width="72" height="48" rx="4" fill={N} />}
              </svg>
            ),
          }))} />
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
    <Pick cols={3} artHeight={72} value={value} onChange={onChange}
          ariaLabel="아이콘 고르기"
          items={items.map((it) => {
            const glyphs = previews[String(it.id)] || [];
            return {
              id: String(it.id),
              label: label(it),
              star: recommended === it.id,
              note: desc(it) || undefined,
              art: (
                <div className="flex items-center gap-3">
                  {glyphs.length
                    ? glyphs.map((g, k) => (
                        <span key={k} className="h-6 w-6 shrink-0"
                              dangerouslySetInnerHTML={{ __html: g.svg }} />
                      ))
                    : <span className="t-sub">—</span>}
                </div>
              ),
            };
          })} />
  );
}

/* ---- 6b. 그림 붙은 한 개 고르기 ---------------------------------------
   글만 있는 라디오 목록으로 물으면 "고르는 것은 그려서 보여준다" 는 이 화면의
   약속을 어긴다. 실제로 두 질문(한 번에/나눠서 · 계획서 먼저)이 글만 있어서
   화면 점수가 88 에서 멈춰 있었고, 무엇보다 고르는 사람이 두 갈래가 어떻게
   다른지 읽어서 알아내야 했다. */

export function ArtChoice({
  items, value, onChange, art, recommended,
}: {
  items: { id: string; label: string; note?: string }[];
  value: string; onChange: (v: string) => void;
  art: Record<string, string>; recommended?: string;
}) {
  return (
    // 갈래가 둘뿐인 질문이라 한 칸이 넓다. 그림을 작게 넣으면 카드가 대부분
    // 빈 채로 남아 화면이 휑해진다.
    <Pick cols={2} artHeight={184} value={value} onChange={onChange}
          ariaLabel="고르기"
          items={items.map((it) => ({
            id: it.id, label: it.label, note: it.note, star: recommended === it.id,
            art: <img src={art[it.id]} alt="" draggable={false}
                      className="h-[140px] w-auto object-contain" />,
          }))} />
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
    <>
      {legend ? <div className="t-card mb-3">{legend}</div> : null}
      {/* 라디오 목록이었다. 같은 앱에서 고르는 방식이 두 가지면 어떤 것이
          눌리는지 매번 다시 배워야 한다 — 시각 영역 없는 카드로 통일한다. */}
      <Pick cols={2} artHeight={0} value={value} onChange={onChange}
            ariaLabel={legend}
            items={items.map((it) => ({
              id: String(it.id),
              label: label(it),
              star: recommended === it.id,
              note: desc(it) || undefined,
            }))} />
    </>
  );
}
