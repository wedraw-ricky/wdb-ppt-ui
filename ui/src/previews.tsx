/* 고른 것이 어떻게 보이는지 — 크기 · 색과 글꼴 · 이미지 방향.

   예전에는 이 셋이 왼쪽 파란 패널 안에 있었다. 패널을 없애면서 셋을 각자
   자기 질문 바로 아래로 옮겼다. 고른 것이 어떻게 되는지는 화면 옆이 아니라
   고르는 자리에서 보여주는 편이 낫다 — 눈을 옮기지 않아도 되니까.

   `stageSteps` 는 어떤 질문을 몇 개 물을지 정하는 곳이라 여기 남는다. */

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
export function stageSteps(stageNum: number, state: Dict, cat: Dict, isPpt: boolean,
                           outlineSlides?: number): Step[] {
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
    // 뼈대를 확정했으면 장 수는 이미 정해졌다. 방금 7장짜리 스토리보드를
    // 확정한 사람에게 "몇 장으로 만들까요" 를 다시 묻는 건 앞 화면을 안 본
    // 것이고, 답이 다르게 들어오면 확정한 뼈대와 어긋난다.
    if (!outlineSlides)
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


/** The rail is now also the way back.

    With one question per screen the rail stops being a list of what is left and
    becomes the map of where you are: it marks the question in hand and every row
    is a jump, so revisiting the second answer costs one click instead of paging
    back through the ones between. */

/** Stage 1 — show the deck being picked, in the shape being picked.

    The frame takes the canvas ratio; the deck preview is letterboxed inside it
    with object-contain. Cropping to fill would hide part of the slide and imply
    the template reflows to the new shape, which it does not — a deck declares
    one canvas_format, so a mismatch is called out instead. */
export function AnchorPreview({ state, cat, ack, onFixCanvas, onAck }: {
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

      <div className="flex items-center gap-3 text-xs">
        <span>{dim}</span>
        <span aria-hidden="true">·</span>
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
export function SkinPreview({ state }: { state: Dict }) {
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
export function ImagePreview({ state }: { state: Dict }) {
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
        <div className="mt-1 text-xs font-normal">{s.mood}</div>
      </div>
    </div>
  );
}

