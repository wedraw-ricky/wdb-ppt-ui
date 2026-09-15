/* 6 디자인. DESIGN.md «묻는 화면» + 컨셉 ②: 고르면 위의 스토리보드가 그 색으로
   다시 칠해진다. 고르기는 제작 순서대로 네 대주제 — 톤앤매너, 비주얼 소재,
   규격, 제작 방식. 접지 않는다. 후보는 한 줄에 넷, 나머지는 «더 보기».

   파이프라인이 세 단계(stage1·2·3)로 후보를 나눠 줄 때는 그 단계의 대주제만
   보이고 머리띠가 «3단계 중 n» 이라고 말한다. 한 번에 다 줄 때(stage 없음)는
   네 대주제가 다 보인다. 값의 계약은 api.ts 가 갖고 있고 여기서는 건드리지
   않는다. */

import { useState } from "react";
import { Shell } from "./shell";
import { Panel, Q, Field, Empty } from "../system/patterns";
import { Pick, type PickItem } from "../system/pick";
import { Storyboard, type Palette } from "./slides";
import type { Row } from "./outline/model";
import * as api from "./api";

type Dict = Record<string, any>;

/* ---- 색 카드의 축소판: 60·30·10 띠와 그 비율로 칠한 예시 장 ------------------- */
function PaletteThumb({ p }: { p: Palette }) {
  const bg = p.background || "var(--white)", main = p.primary || "var(--main)", acc = p.accent || "var(--accent)";
  const soft = p.secondary_bg || "var(--line)";
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", gap: 6, padding: 8 }}>
      <div style={{ display: "flex", height: 14, borderRadius: 3, overflow: "hidden", border: "1px solid var(--line-strong)" }}>
        <i style={{ flex: 6, background: bg }} /><i style={{ flex: 3, background: main }} /><i style={{ flex: 1, background: acc }} />
      </div>
      <div style={{ flex: 1, background: bg, border: "1px solid var(--line)", borderRadius: 3, position: "relative", overflow: "hidden" }}>
        <i style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "30%", background: main }} />
        <i style={{ position: "absolute", left: "8%", top: "12%", width: "14%", height: "6%", background: acc }} />
        <i style={{ position: "absolute", left: "38%", top: "16%", width: "40%", height: "8%", background: main, opacity: 0.9 }} />
        <i style={{ position: "absolute", left: "38%", top: "34%", width: "52%", height: "4%", background: soft }} />
        <i style={{ position: "absolute", left: "38%", top: "44%", width: "44%", height: "4%", background: soft }} />
        <i style={{ position: "absolute", left: "38%", bottom: "14%", width: "18%", height: "10%", background: acc }} />
      </div>
    </div>
  );
}

/** WCAG 대비. 검사 판에 «색 대비 n:1» 로 적기 위해서다. */
function contrast(a?: string, b?: string): number | null {
  const lum = (hex?: string) => {
    const m = String(hex || "").match(/^#?([0-9a-f]{6})$/i);
    if (!m) return null;
    const v = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16) / 255)
      .map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
    return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
  };
  const la = lum(a), lb = lum(b);
  if (la === null || lb === null) return null;
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return Math.round(((hi + 0.05) / (lo + 0.05)) * 10) / 10;
}

const candName = (c: Dict) => String(c?.name_ko || c?.name || "");
const named = (list: Dict[] | undefined, id: any) => {
  const it = (list || []).find((x) => String(x.id) === String(id));
  return it ? String(it.label_ko || it.name_ko || it.label || it.id) : "";
};
const SIZE_LABELS: Record<string, string> = { text: "작게 · 본문 20pt", balanced: "기본 · 본문 24pt", presentation: "크게 · 본문 28pt" };
const DECK_CANVAS = (cat: Dict) => (cat.canvas || []).filter((c: Dict) => api.isPptCanvas(c.id, cat));

export function Design({ rec, cat, state, set, rows, stageNum, onPrimary, error, docToo, lead, busy = false }: {
  rec: api.Recommendations; cat: Dict; state: Dict;
  set: (k: string, v: any) => void;
  rows: Row[]; stageNum: number;
  onPrimary: (refineFirst: boolean) => void; error?: string; docToo: boolean;
  /** 앞 단계가 이미 끝나 있을 때 첫 줄에 하는 말. */
  lead?: string;
  /** 넘기는 중. 버튼이 바로 «저장하는 중»으로 바뀌어야 눌렸는지 안다. */
  busy?: boolean;
}) {
  const R = rec.recommend || {};
  const [moreColors, setMoreColors] = useState(false);
  const [moreStyles, setMoreStyles] = useState(false);
  const showAnchors = stageNum === 0 || stageNum === 1;
  const showDesign = stageNum === 0 || stageNum === 2;
  const showImages = stageNum === 0 || stageNum === 3;
  const isPpt = api.isPptCanvas(state.canvas, cat);
  const aiOn = api.needsAi(state.image_usage || []);

  /* 색 후보 */
  const colorCands: Dict[] = rec.color?.candidates || [];
  const colorSel = colorCands.findIndex((c) => candName(c) === state.color?.name);
  const colorItems: PickItem[] = colorCands.map((c, i) => ({ id: String(i), label: candName(c), thumb: <PaletteThumb p={c.palette || {}} /> }));
  const colorShown = moreColors ? colorItems : colorItems.slice(0, 4);
  const colorNote = colorCands[colorSel >= 0 ? colorSel : Number(rec.color?.selected) || 0];

  /* 분위기 후보. 스펙트럼(안전·추천·과감) + 지금 것 + 추천을 앞에, 나머지는 더 보기 */
  const styleItems: Dict[] = (cat.visual_styles || []).flatMap((g: Dict) => g.items || []);
  const spectrum: Dict = R.visual_style_spectrum || rec.visual_style_spectrum || {};
  const front = [spectrum.safe, spectrum.shifted, spectrum.bold, R.visual_style, state.visual_style].filter(Boolean);
  const ordered = [...styleItems.filter((s) => front.includes(s.id)), ...styleItems.filter((s) => !front.includes(s.id))];
  const styleToItem = (s: Dict): PickItem => ({
    id: String(s.id), label: String(s.label_ko || s.name_ko || s.id),
    thumb: <img src={`/static/style_previews/${encodeURIComponent(s.id)}.svg`} alt="" />,
  });
  const styleShown = (moreStyles ? ordered : ordered.slice(0, 4)).map(styleToItem);

  /* 사진 느낌 후보 */
  const strat: Dict[] = rec.image_strategy?.candidates || [];
  const stratItems: PickItem[] = strat.map((c, i) => ({
    id: String(i), label: candName(c), note: String(c.mood || ""),
    thumb: c.rendering ? <img src={`/ai-image-comparison/rendering/${encodeURIComponent(c.rendering)}.jpg`} alt="" /> : undefined,
  }));
  const stratSel = strat.findIndex((c) => c.name === state.image_strategy?.name);

  const photoCount = rows.filter((r) => r.image && r.image !== "none").length;
  const palette: Palette | null = state.color?.palette || null;
  const ratio = contrast(palette?.body_text, palette?.background);
  const stepLabel = stageNum ? `6 · 디자인 · 3단계 중 ${stageNum}` : "6 · 디자인";
  const primaryLabel = stageNum && stageNum < 3 ? "다음" : "이대로 만들기";

  const say = (
    <>
      {lead ? <>{lead}<br /></> : null}
      {colorNote
        ? <>색은 <strong>{candName(colorNote)}</strong>로 잡았어요. {colorNote.note || colorNote.mood || ""}<br /></>
        : null}
      분위기는 <strong>{named(styleItems, state.visual_style) || "아직"}</strong>{state.visual_style ? "이에요" : ""}.
      {aiOn && stratSel >= 0 ? <> 사진은 <strong>{candName(strat[stratSel])}</strong>, {strat[stratSel].visual || ""}</> : null}
      <br />사람은 한국 사람, 장소는 한국으로 만들어요. 그대로 두셔도 돼요.
    </>
  );

  return (
    <Shell band="발표" step={stepLabel} pct={72}
      title="이렇게 입힐게요"
      sub={rows.length ? <>고르면 위 {rows.length}장이 바로 바뀌어요</> : <>고르면 아래 값이 바로 바뀌어요</>}
      say={say}
      side={
        <>
          <Panel label="검사">
            <ul className="c">
              <li className={ratio !== null && ratio < 4.5 ? "bad" : ""}>{ratio !== null ? `색 대비 ${ratio}:1` : "색 대비는 색을 고르면 재요"}</li>
              <li>사진 자리 {photoCount}곳 정해짐</li>
              <li>글꼴 Pretendard</li>
            </ul>
          </Panel>
          <Panel label="이대로 만들면">
            <div style={{ fontSize: 14, lineHeight: 1.7 }}>
              {rows.length || state.page_count || "?"}장 · 사진 {aiOn ? photoCount : 0}장
              {docToo ? <><br />워드 문서는 이미 있어요</> : null}
            </div>
          </Panel>
        </>
      }
      error={error}
      footNote={busy ? "고르신 것을 저장하고 있어요" : `이대로 만들면 ${rows.length || state.page_count || "?"}장 · 사진 ${aiOn ? photoCount : 0}장`}
      actions={[
        ...(stageNum === 0 || stageNum === 3 ? [{ label: "계획서 먼저 보기", onClick: () => onPrimary(true), disabled: busy }] : []),
        { label: busy ? "저장하는 중…" : primaryLabel, kind: "pri" as const, onClick: () => onPrimary(false), disabled: busy },
      ]}>
      <Panel label="결과물 · 스토리보드" kind="out">
        {rows.length ? <Storyboard rows={rows} palette={palette} /> : <Empty title="뼈대가 확정되면 여기 장이 보여요" />}
        <div className="k">{[state.color?.name, named(styleItems, state.visual_style), aiOn ? `사진 ${photoCount}장` : "사진 없음"].filter(Boolean).join(" · ")}. 왼쪽부터 순서대로</div>
      </Panel>

      <Panel label="고르기 · 제작 순서대로">
        {showDesign || showAnchors ? (
          <Q n={1} title="톤앤매너" why="색 · 분위기 · 아이콘"
             note={colorNote ? <>{colorNote.note || colorNote.mood}<br />색 카드의 띠가 60·30·10이고, 그 아래 장이 그 비율로 칠한 예시예요.</> : "색 후보가 오면 여기서 왜 그 색인지 말해요."}>
            {showDesign ? (
              <>
                <h3>색 <span>60·30·10 띠와 그 비율로 칠한 예시 장</span></h3>
                <Pick kind="card" cols={4} items={colorShown} value={colorSel >= 0 ? String(colorSel) : null}
                      recommended={String(Number(rec.color?.selected) || 0)}
                      onChange={(i) => { const c = colorCands[Number(i)]; set("color", { name: candName(c), palette: { ...c.palette } }); }}
                      emptyTitle="색 후보가 아직 없어요" emptyNote="파이프라인이 후보를 쓰면 여기 보여요" />
                {colorItems.length > 4 ? <button className="chip sm" onClick={() => setMoreColors((v) => !v)}>{moreColors ? "접기" : `더 보기 · ${colorItems.length - 4}`}</button> : null}
              </>
            ) : null}
            {showAnchors ? (
              <>
                <h3>분위기 <span>{styleItems.length}가지, 맞는 것부터</span></h3>
                <Pick kind="card" cols={4} items={styleShown} value={state.visual_style} recommended={R.visual_style}
                      onChange={(v) => set("visual_style", v)} emptyTitle="분위기 목록이 비어 있어요" />
                {ordered.length > 4 ? <button className="chip sm" onClick={() => setMoreStyles((v) => !v)}>{moreStyles ? "접기" : `더 보기 · ${ordered.length - 4}`}</button> : null}
              </>
            ) : null}
            {showDesign ? (
              <>
                <h3>아이콘</h3>
                <Pick items={(cat.icons || []).map((i: Dict) => ({ id: i.id, label: i.label_ko || i.id }))} value={state.icons}
                      recommended={R.icons} onChange={(v) => set("icons", v)} />
              </>
            ) : null}
          </Q>
        ) : null}

        {showImages ? (
          <Q n={2} title="비주얼 소재" why={`사진 · ${rows.length || "?"}장 중 ${photoCount}장`}
             note={<>사진은 뼈대에서 «옆에»나 «전면»으로 정한 장에만 들어가요. 지금 {photoCount}장이에요.<br />사람은 한국 사람, 장소는 한국으로 만들어요.</>}>
            <Pick multi items={(cat.image_usage || []).map((i: Dict) => ({ id: i.id, label: i.label_ko || i.id }))}
                  value={state.image_usage} recommended={Array.isArray(R.image_usage) ? R.image_usage : [R.image_usage].filter(Boolean)}
                  onChange={(v) => set("image_usage", v)} />
            {aiOn ? (
              <>
                <h3>어떤 느낌으로 <span>사람은 한국 사람, 장소는 한국</span></h3>
                <Pick kind="card" cols={3} items={stratItems} value={stratSel >= 0 ? String(stratSel) : null}
                      recommended={String(Number(rec.image_strategy?.selected) || 0)}
                      onChange={(i) => set("image_strategy", { ...strat[Number(i)] })}
                      emptyTitle="사진 느낌 후보가 아직 없어요" />
                <h3>만드는 곳 <span>결과는 같아요. 알아서 정해 두었어요</span></h3>
                <Pick items={(cat.image_ai_path || []).map((i: Dict) => ({ id: i.id, label: i.label_ko || i.id }))} value={state.image_ai_path}
                      recommended={R.image_ai_path} onChange={(v) => set("image_ai_path", v)} />
              </>
            ) : null}
            <Field label="더 할 말" hint="사진에 대해 꼭 지킬 것" value={String(state.image_notes || "")} onChange={(v) => set("image_notes", v)}
                   placeholder="예: 실제 한국 공항과 호텔. 얼굴은 안 넣기" multiline />
          </Q>
        ) : null}

        {showAnchors ? (
          <Q n={3} title="규격" why="발표용 표준값">
            <div className="kv">
              <span>크기</span>
              <Pick items={DECK_CANVAS(cat).map((c: Dict) => ({ id: c.id, label: c.label_ko || c.id }))} value={state.canvas}
                    recommended={R.canvas} onChange={(v) => set("canvas", v)} />
              {isPpt ? <><span>글씨</span>
                <Pick items={(cat.delivery_purpose || []).map((d: Dict) => ({ id: d.id, label: SIZE_LABELS[d.id] || d.label_ko || d.id }))}
                      value={state.delivery_purpose} recommended={R.delivery_purpose} onChange={(v) => set("delivery_purpose", v)} /></> : null}
              {(cat.templates || []).length > 1 ? <><span>시안</span>
                <Pick items={(cat.templates || []).map((t: Dict) => ({ id: t.id, label: t.label_ko || t.summary || t.id }))}
                      value={state.template} recommended={R.template} onChange={(v) => set("template", v)} /></> : null}
              {state.template_adherence ? <><span>시안 따르기</span>
                <Pick items={(cat.template_adherence || []).map((t: Dict) => ({ id: t.id, label: t.label_ko || t.id }))}
                      value={state.template_adherence} recommended={R.template_adherence} onChange={(v) => set("template_adherence", v)} /></> : null}
            </div>
          </Q>
        ) : null}

        {showAnchors || showImages ? (
          <Q n={4} title="제작 방식">
            <div className="kv">
              {showAnchors ? <><span>서술</span>
                <Pick items={(cat.modes || []).map((m: Dict) => ({ id: m.id, label: m.label_ko || m.id }))} value={state.mode}
                      recommended={R.mode} onChange={(v) => set("mode", v)} /></> : null}
              {showImages ? <>
                <span>수학 공식</span>
                <Pick items={(cat.formula_policy || []).map((m: Dict) => ({ id: m.id, label: m.label_ko || m.id }))} value={state.formula_policy}
                      recommended={R.formula_policy} onChange={(v) => set("formula_policy", v)} />
                <span>만들기</span>
                <Pick items={(cat.generation_mode || []).map((m: Dict) => ({ id: m.id, label: m.label_ko || m.id }))} value={state.generation_mode}
                      recommended={R.generation_mode} onChange={(v) => set("generation_mode", v)} />
              </> : null}
            </div>
            {showImages ? <div className="k">«계획서 먼저 보기»를 누르면 슬라이드를 만들기 전에 계획서를 한 번 더 보여드려요. «이대로 만들기»는 바로 만들어요.</div> : null}
          </Q>
        ) : null}
      </Panel>
    </Shell>
  );
}
