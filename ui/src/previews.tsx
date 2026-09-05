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
                           outlineSlides?: number, askedAudience?: boolean): Step[] {
  const anchors = stageNum === 0 || stageNum === 1;
  const design = stageNum === 0 || stageNum === 2;
  const images = stageNum === 0 || stageNum === 3;
  const out: Step[] = [];
  const has = (v: any) => Boolean(String(v ?? "").trim());

  // 열한 개로 쪼개 놓았던 것을 넷으로 묶는다. 디자이너는 문항에 답하지 않는다 —
  // 틀을 잡고, 룩을 고르고, 이미지를 정하고, 마무리한다. 색과 글꼴과 아이콘을
  // 따로 묻는 것은 "어떻게 보이게 할까" 하나를 셋으로 쪼갠 것이고, 셋을 따로
  // 고르면 합쳐 놓았을 때 어떤지는 아무도 안 본다.
  if (anchors) {
    out.push({ key: "frame", title: "어떤 틀로 만들까요?", required: true,
               filled: has(state.canvas) });
  }
  if (design) {
    out.push({ key: "look", title: "어떤 느낌으로 만들까요?", required: true,
               filled: has(state.mode) && has(state.visual_style)
                       && Boolean(state.color?.palette) && Boolean(state.typography) });
  }
  if (images) {
    out.push({ key: "images", title: T.secImages, required: true,
               filled: Array.isArray(state.image_usage) && state.image_usage.length > 0 });
    out.push({ key: "finish", title: "마무리", required: false, filled: true });
  }
  // 쪽수는 뼈대가, 대상은 인터뷰가 이미 정했다. 방금 답한 것을 다시 묻지 않는다.
  void outlineSlides; void askedAudience; void cat; void isPpt;
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

  /* 예전에는 이 미리보기가 왼쪽 파란 패널 위에 얹혀 있었다. 배경이
     rgba(255,255,255,0.08) 이고 카드가 bg-white/95 였는데, 흰 화면으로 옮겨
     오면서 그 둘이 배경과 같은 색이 되어 **틀이 통째로 사라졌다** — 글자가
     허공에 뜨고 크기 표기가 왼쪽 아래에 굴러다녔다. 흰 바탕에 맞춰 다시 짠다. */
  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-hidden rounded-2xl border"
           style={{ borderColor: "var(--border)", background: "var(--surface)",
                    boxShadow: "var(--shadow-card)" }}>
        <div className="grid place-items-center py-7"
             style={{ background: "var(--sunken)" }}>
          <div className="overflow-hidden rounded-md"
               style={{ width: boxW, height: boxH, background: "var(--surface)",
                        border: "1px solid var(--border-strong)",
                        boxShadow: "var(--shadow-card)" }}>
            {isDeck ? (
              <img src={`/api/template_preview/${encodeURIComponent(state.template)}?lang=ko`}
                   alt="" className="h-full w-full object-contain" />
            ) : (
              <div className="grid h-full place-items-center px-4 text-center t-sub">
                템플릿 없이 새로 디자인합니다
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-5 py-4">
          <span className="t-card tabular-nums">{dim}</span>
          <span className="t-sub" aria-hidden="true">·</span>
          {/* 88×64 로 그려진 도형이라 h-7 로 줄이면 파란 덩어리로 뭉갠다.
              제 비율(약 11:8)을 지켜야 무슨 배치인지 읽힌다. */}
          <svg viewBox="0 0 88 64" className="h-10 w-[55px] rounded"
               style={{ background: "var(--sunken)" }} aria-hidden="true">
            {MODE_SHAPES[state.mode] ?? null}
          </svg>
          <span className="t-sub">
            {(cat.modes || []).find((x: Dict) => x.id === state.mode)?.label_ko || ""}
          </span>
        </div>
      </div>

      {mismatch ? (
        <div className="rounded-2xl p-5"
             style={{ background: "var(--warn-soft, #fdf5e9)",
                      borderLeft: "4px solid var(--warning)" }}>
          <div className="t-card" style={{ color: "var(--warning)" }}>
            이 템플릿은 {deckDim || deckCanvas} 기준입니다
          </div>
          <div className="t-sub mt-2" style={{ color: "var(--foreground)" }}>
            크기가 다르면 <b>템플릿의 페이지 구조를 쓸 수 없습니다.</b> 시안의 자리 배치와
            슬라이드 마스터는 원래 크기에 고정돼 있어서, 다른 크기에서는 색·서체·괘선만
            가져오고 지면은 처음부터 새로 짭니다. 결과물에 슬라이드 마스터가 없는
            평면 문서로 나옵니다.
          </div>
          <div className="mt-4 flex flex-wrap gap-2.5">
            <button type="button" onClick={() => onFixCanvas(String(deckCanvas))}
                    className="h-[44px] rounded-[14px] px-4 t-card text-white"
                    style={{ background: "var(--accent)" }}>
              크기를 템플릿에 맞추기 ({deckDim || deckCanvas})
            </button>
            <button type="button" onClick={onAck} aria-pressed={ack}
                    className="h-[44px] rounded-[14px] px-4 t-card"
                    style={{ border: "1.5px solid " + (ack ? "var(--accent)" : "var(--border)"),
                             background: ack ? "var(--accent)" : "var(--surface)",
                             color: ack ? "#FFFFFF" : "var(--foreground)" }}>
              {ack ? "✓ 색·서체만 가져옵니다" : "구조 없이 색·서체만 가져오기"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

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

