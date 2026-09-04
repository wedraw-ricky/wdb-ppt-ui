/* Left panel: the step rail and a preview that tracks what is being chosen.

   The preview used to read only colour and typography, which are stage-2
   fields — so while picking a template or a canvas in stage 1 nothing moved and
   the panel looked hardcoded. It now shows the decision in front of the user. */

import type { Dict } from "./api";
import { T } from "./i18n";
import { MODE_SHAPES } from "./selectors";

export interface Step {
  key: string;
  title: string;
  required: boolean;
  filled: boolean;
}

/** Which steps this stage carries, and whether each is answered yet. */
export function stageSteps(stageNum: number, state: Dict, cat: Dict, isPpt: boolean): Step[] {
  const anchors = stageNum === 0 || stageNum === 1;
  const design = stageNum === 0 || stageNum === 2;
  const images = stageNum === 0 || stageNum === 3;
  const out: Step[] = [];
  const has = (v: any) => Boolean(String(v ?? "").trim());

  if (anchors) {
    if ((cat.templates || []).length > 1)
      out.push({ key: "template", title: T.secTemplate, required: false, filled: has(state.template) });
    out.push({ key: "canvas", title: T.secCanvas, required: true, filled: has(state.canvas) });
    out.push({ key: "audience", title: T.secAudience, required: true, filled: has(state.audience) });
    out.push({ key: "style", title: T.secStyle, required: true,
               filled: has(state.mode) && has(state.visual_style) && (!isPpt || has(state.delivery_purpose)) });
  }
  if (design) {
    out.push({ key: "pages", title: T.secPages, required: true, filled: has(state.page_count) });
    out.push({ key: "color", title: T.secColor, required: true, filled: Boolean(state.color?.palette) });
    out.push({ key: "icons", title: T.secIcons, required: false, filled: has(state.icons) });
    out.push({ key: "type", title: T.secType, required: true, filled: Boolean(state.typography) });
    out.push({ key: "formula", title: T.secFormula, required: false, filled: has(state.formula_policy) });
  }
  if (images) {
    out.push({ key: "images", title: T.secImages, required: true,
               filled: Array.isArray(state.image_usage) && state.image_usage.length > 0 });
    out.push({ key: "genmode", title: T.secMode, required: false, filled: has(state.generation_mode) });
    out.push({ key: "refine", title: T.secRefine, required: false, filled: true });
  }
  return out;
}

/** The whole three-stage journey.

    The rail below only names the current stage's fields, which left no way to
    tell whether a decision you expected — colour, say — is coming later or is
    never asked at all. This says up front what each stage owns. */
const JOURNEY = [
  { n: 1, title: "무엇을, 누구에게", covers: "템플릿 · 크기 · 대상 · 설명 방식" },
  { n: 2, title: "어떻게 보이게", covers: "쪽수 · 색 · 아이콘 · 글꼴" },
  { n: 3, title: "이미지", covers: "사진과 그림을 어떻게 채울지" },
];

function Journey({ stageNum }: { stageNum: number }) {
  if (stageNum < 1) return null;   // single-pass form asks everything at once
  return (
    <div>
      <div className="mb-2.5 text-sm font-bold">전체 3단계</div>
      <ol className="flex flex-col gap-2">
        {JOURNEY.map((s) => {
          const done = s.n < stageNum, now = s.n === stageNum;
          return (
            <li key={s.n} className="flex items-start gap-2.5 text-[13px]"
                style={{ opacity: now ? 1 : done ? 0.7 : 0.45 }}>
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-bold"
                    style={{
                      background: done ? "var(--wdb-cyan)"
                        : now ? "#ffffff" : "rgba(255,255,255,0.16)",
                      color: done || now ? "var(--wdb-charcoal)" : "#ffffff",
                    }}>
                {done ? "✓" : s.n}
              </span>
              <span className="leading-snug">
                <b className={now ? "" : "font-normal"}>{s.title}</b>
                <span className="block text-[11px] opacity-75">{s.covers}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function Rail({ steps }: { steps: Step[] }) {
  const left = steps.filter((s) => s.required && !s.filled).length;
  return (
    <div>
      <div className="mb-3 flex items-baseline gap-2">
        <span className="text-sm font-bold">이 단계에서 정할 것</span>
        <span className="text-xs opacity-80">
          {left ? `아직 ${left}개 남았습니다` : "다 정하셨습니다"}
        </span>
      </div>
      <ol className="flex flex-col gap-1.5">
        {steps.map((s, i) => (
          <li key={s.key} className="flex items-center gap-2.5 text-sm">
            <span
              className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-bold"
              style={{
                background: s.filled ? "var(--wdb-cyan)" : "rgba(255,255,255,0.16)",
                color: s.filled ? "var(--wdb-charcoal)" : "#ffffff",
              }}
            >
              {s.filled ? "✓" : i + 1}
            </span>
            <span className={s.filled ? "opacity-70" : ""}>{s.title}</span>
            {s.required ? (
              <span className="text-[11px]" style={{ color: "var(--wdb-cyan)" }}>필수</span>
            ) : (
              <span className="text-[11px] opacity-55">선택</span>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Stage 1 — show the deck being picked, in the shape being picked.

    The frame takes the canvas ratio; the deck preview is letterboxed inside it
    with object-contain. Cropping to fill would hide part of the slide and imply
    the template reflows to the new shape, which it does not — a deck declares
    one canvas_format, so a mismatch is called out instead. */
function AnchorPreview({ state, cat, ack, onFixCanvas, onAck }: {
  state: Dict; cat: Dict; ack: boolean;
  onFixCanvas: (canvasId: string) => void; onAck: () => void;
}) {
  const canvas = (cat.canvas || []).find((c: Dict) => c.id === state.canvas);
  const dim = canvas?.dim || "1280×720";
  const m = String(dim).match(/(\d+)\s*[×xX*]\s*(\d+)/);
  const [w, h] = m ? [Number(m[1]), Number(m[2])] : [1280, 720];

  // fit inside a fixed area so a tall canvas cannot push the rail off-screen
  const MAX_W = 340, MAX_H = 300;
  const scale = Math.min(MAX_W / w, MAX_H / h);
  const boxW = Math.round(w * scale), boxH = Math.round(h * scale);

  const isDeck = state.template && state.template !== "free";
  const deck = (cat.templates || []).find((tpl: Dict) => tpl.id === state.template);
  const deckCanvas = deck?.canvas_format;
  const mismatch = Boolean(isDeck && deckCanvas && deckCanvas !== state.canvas);
  const deckDim = (cat.canvas || []).find((c: Dict) => c.id === deckCanvas)?.dim;

  return (
    <div className="flex flex-col gap-3">
      <div className="grid place-items-center rounded-lg"
           style={{ width: MAX_W, height: MAX_H, background: "rgba(255,255,255,0.08)" }}>
        <div className="overflow-hidden rounded-md bg-white/95"
             style={{ width: boxW, height: boxH }}>
          {isDeck ? (
            <img src={`/api/template_preview/${encodeURIComponent(state.template)}?lang=ko`}
                 alt="" className="h-full w-full object-contain" />
          ) : (
            <div className="grid h-full place-items-center px-3 text-center text-xs"
                 style={{ color: "var(--wdb-gray)" }}>
              템플릿 없이 새로 디자인합니다
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 text-xs opacity-85">
        <span>{dim}</span>
        <span className="opacity-60">·</span>
        <svg viewBox="0 0 88 64" className="h-7 w-10" aria-hidden="true">
          {MODE_SHAPES[state.mode] ?? null}
        </svg>
        <span>{(cat.modes || []).find((x: Dict) => x.id === state.mode)?.label_ko || ""}</span>
      </div>

      {mismatch ? (
        <div className="rounded-lg p-4"
             style={{ background: "#FFFFFF", borderLeft: "4px solid var(--wdb-warning, #E1A200)" }}>
          <div className="text-[13px] font-bold" style={{ color: "var(--wdb-charcoal)" }}>
            이 템플릿은 {deckDim || deckCanvas} 기준입니다
          </div>
          <div className="mt-1.5 text-[13px] leading-relaxed" style={{ color: "var(--wdb-gray)" }}>
            크기가 다르면 <b>템플릿의 페이지 구조를 쓸 수 없습니다.</b> 시안의 자리 배치와
            슬라이드 마스터는 원래 크기에 고정돼 있어서, 다른 크기에서는 색·서체·괘선만
            가져오고 지면은 처음부터 새로 짭니다. 결과물에 슬라이드 마스터가 없는
            평면 문서로 나옵니다.
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => onFixCanvas(String(deckCanvas))}
                    className="rounded-lg px-3 py-2 text-[13px] font-semibold"
                    style={{ background: "var(--wdb-primary)", color: "#FFFFFF" }}>
              크기를 템플릿에 맞추기 ({deckDim || deckCanvas})
            </button>
            <button type="button" onClick={onAck} aria-pressed={ack}
                    className="rounded-lg px-3 py-2 text-[13px] font-semibold"
                    style={{ border: "1.5px solid " + (ack ? "var(--wdb-primary)" : "var(--border)"),
                             background: ack ? "var(--wdb-primary)" : "#FFFFFF",
                             color: ack ? "#FFFFFF" : "var(--wdb-charcoal)" }}>
              {ack ? "✓ 색·서체만 가져옵니다" : "구조 없이 색·서체만 가져오기"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Stage 2 (and single pass) — the colour and type actually chosen. */
function SkinPreview({ state }: { state: Dict }) {
  const pal = state.color?.palette || {};
  const headCss = state.typography?.heading?.css || "Paperlogy, sans-serif";
  const bodyCss = state.typography?.body?.css || "Paperlogy, sans-serif";
  const bodySize = Number(state.typography?.body_size) || 24;
  return (
    <div className="rounded-xl p-6 shadow-lg"
         style={{ background: pal.background || "#fff", color: pal.body_text || "#1a1a1a" }}>
      <div style={{ fontFamily: headCss, fontSize: 30, fontWeight: 800, color: pal.primary }}>
        큰 제목 <span style={{ color: pal.accent }}>섹션 제목</span>
      </div>
      <div style={{ fontFamily: bodyCss, fontSize: bodySize, marginTop: 12, lineHeight: 1.5 }}>
        본문 글씨가 이 정도 크기로 보입니다.
      </div>
      <div className="mt-4 h-1.5 w-24 rounded" style={{ background: pal.accent }} />
      <div className="mt-4 rounded-lg px-3 py-2 text-sm"
           style={{ background: pal.secondary_bg, color: pal.body_text }}>
        보조 배경 위의 문장
      </div>
    </div>
  );
}

/** Stage 3 — the image direction being chosen. */
function ImagePreview({ state }: { state: Dict }) {
  const s = state.image_strategy;
  if (!s) return <SkinPreview state={state} />;
  return (
    <div className="flex flex-col gap-3">
      {s.rendering ? (
        <img src={`/ai-image-comparison/rendering/${encodeURIComponent(s.rendering)}.jpg`}
             alt="" className="w-[360px] rounded-lg object-cover"
             onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
      ) : null}
      <div className="text-sm">
        <div className="font-semibold">{s.name}</div>
        <div className="mt-1 text-xs opacity-80">{s.mood}</div>
      </div>
    </div>
  );
}

export function Hero({
  state, cat, stageNum, steps, ack, onFixCanvas, onAck,
}: {
  state: Dict; cat: Dict; stageNum: number; steps: Step[];
  ack: boolean; onFixCanvas: (canvasId: string) => void; onAck: () => void;
}) {
  return (
    <aside className="wdb-hero hidden w-[38%] max-w-[560px] min-w-[380px] flex-col gap-6 overflow-y-auto p-7 lg:flex">
      <div className="flex items-center gap-3 border-b border-white/20 pb-4">
        <div className="grid h-9 w-9 place-items-center rounded-lg border border-white/30 bg-white/15 text-sm font-bold">
          PM
        </div>
        <div>
          <div className="text-[11px] tracking-widest opacity-80">PPT MASTER</div>
          <div className="text-sm font-bold">{T.title}</div>
        </div>
      </div>

      <Journey stageNum={stageNum} />

      <Rail steps={steps} />

      <div className="flex flex-col gap-2">
        <div className="text-xs opacity-80">
          {stageNum === 1 ? "고르신 템플릿과 크기" : stageNum === 3 ? "고르신 이미지 방향" : "전체 인상 미리보기"}
        </div>
        {stageNum === 1 ? <AnchorPreview state={state} cat={cat} ack={ack}
                                 onFixCanvas={onFixCanvas} onAck={onAck} />
          : stageNum === 3 ? <ImagePreview state={state} />
          : <SkinPreview state={state} />}
      </div>
    </aside>
  );
}
