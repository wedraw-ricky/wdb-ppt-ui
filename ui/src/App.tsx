import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  Button, Card, Checkbox, CheckboxGroup, Description, Input, Label,
  Switch, TextArea, TextField,
} from "@heroui/react";
import * as api from "./api";
import type { Dict, Recommendations } from "./api";
import { T, label, desc, candName, candNote } from "./i18n";
import {
  ArtChoice, AUDIENCE_PRESETS, Choice, DIVERGENCE_PRESETS, DiagramChoice, IconChoice,
  IMAGE_PRESETS,
  PresetField, RatioChoice, Star, ThumbChoice,
} from "./selectors";
import { Deriving, Disconnected, DoneArt, ErrorArt, LoadingArt } from "./states";
import { Ask, Mid, Shell, Steps } from "./shell";
import modeContinuous from "./art/mode-continuous.png";
import modePlanNo from "./art/mode-plan-no.png";
import modePlanYes from "./art/mode-plan-yes.png";
import modeSplit from "./art/mode-split.png";
import { PaletteChoice, HexGrid, TypeSpecimen, PageCount, ImageSourceChoice, StrategyChoice } from "./stage23";
import { AnchorPreview, ImagePreview, SkinPreview, stageSteps } from "./previews";
import { Intake } from "./intake";
import { OutlineEditor } from "./outline";
import {
  localStamp, metaGet, metaSet, parseOutline, serializeOutline, type Doc, type Row,
} from "./outline/model";

/* ---------- small building blocks ------------------------------------- */

/** Which question is on screen. Read by `Section`, written by the footer and
    the rail — one source, so a jump from the rail and a press of 다음 cannot
    land on different questions. */
const StepCtx = createContext<{ current: string; index: (k: string) => number }>(
  { current: "", index: () => 0 });

const useStep = () => useContext(StepCtx);

/** One decision, one screen.

    Twelve of these stacked made a 4088px scroll: to answer the third question
    you had to remember the first two were above you and the rest below. Each
    now waits its turn, in the order the rail already lists — the rail and the
    form read the same `stageSteps`, so they can never disagree about what is
    left. */
/* 한 번에 한 가지만 묻는다. 예전에는 질문이 카드 안 번호 동그라미 옆에
   들어가 있어서, 화면의 주인공이 질문이 아니라 카드였다. 이제 질문이 곧
   제목이다. 안내 문구는 첫 질문에서만 — 매 질문마다 같은 말을 반복하면
   정작 질문이 밀려난다. */
function Section({ k, title, children }: { k: string; title: string; children: React.ReactNode }) {
  const { current, index } = useStep();
  if (k !== current) return null;
  return (
    <>
      <Ask title={title} sub={index(k) === 0 ? T.hint : undefined} />
      <div className="flex flex-col gap-9">{children}</div>
    </>
  );
}

/** Generative candidates (colour / typography / image style) as pickable cards. */
function Candidates({
  block, selected, onSelect, render,
}: {
  block: any; selected: number; onSelect: (i: number) => void;
  render: (c: any) => React.ReactNode;
}) {
  const list: any[] = block?.candidates || [];
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {list.map((c, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onSelect(i)}
          className="rounded-xl border p-3 text-left transition"
          style={{
            borderColor: i === selected ? "var(--wdb-primary)" : "var(--border)",
            boxShadow: i === selected ? "0 0 0 2px rgba(54,103,255,.18)" : "none",
            background: "var(--surface)",
          }}
        >
          <div className="mb-1 flex items-center text-sm font-semibold">
            {candName(c)}
            {i === (Number(block?.selected) || 0) ? <Star /> : null}
          </div>
          {candNote(c) ? (
            <div className="mb-2 text-xs" style={{ color: "var(--muted)" }}>{candNote(c)}</div>
          ) : null}
          {render(c)}
        </button>
      ))}
    </div>
  );
}

/* ---------- app -------------------------------------------------------- */

type Phase = "loading" | "intake" | "outline" | "form" | "deriving" | "done" | "error";

// Well inside the server's own idle budget (900s by default), and rare
// enough that a page left open all afternoon costs nothing worth counting.
const HEARTBEAT_MS = 30_000;

/** Keep the confirm server alive while this page is open, and say so when it
    is not. Filling in the form makes no requests — a person reads and types for
    minutes — and the server's idle watchdog cannot tell that from a closed tab,
    so it used to shut down under a waiting user. The ping restarts its clock;
    closing the tab stops the ping and the idle timeout goes back to working.

    One missed ping is a hiccup, not a death: the banner waits for two in a row
    so a momentary blip does not flash an alarm at someone mid-decision. Pings
    continue after that — a restarted server reconnects on its own. */
function useServerAlive(): boolean {
  const [alive, setAlive] = useState(true);
  useEffect(() => {
    let stopped = false;
    let misses = 0;
    async function ping() {
      const ok = await api.heartbeat();
      if (stopped) return;
      misses = ok ? 0 : misses + 1;
      setAlive(ok || misses < 2);
    }
    ping();
    const id = setInterval(ping, HEARTBEAT_MS);
    return () => { stopped = true; clearInterval(id); };
  }, []);
  return alive;
}

/* 맨 위 막대가 몇 %인지. 없는 진행률을 지어내지 않고, 전체 흐름을 여덟 걸음으로
   보고 지금 몇 번째인지만 적는다 — 인터뷰 · 기획서 · 뼈대 · 1·2·3단계 · 끝. */
/* 세 단계 안에서 몇 번째 질문인지까지 막대에 반영한다. 단계만 세면 질문
   여덟 개를 지나는 동안 막대가 한 번도 안 움직여서, 가고 있는지 알 수 없다. */
const stageProgress = (stageNum: number, at: number, len: number) => {
  const within = len > 0 ? (at + 1) / len : 1;
  if (!stageNum) return Math.round(40 + within * 56);
  return Math.round([54, 68, 82][stageNum - 1] + within * 12);
};

const derivingProgress = (target: number) =>
  target === 0 ? 16 : target === 1 ? 48 : target === 2 ? 68 : 82;

const derivingWhere = (target: number) =>
  target === 0 ? "기획서 만드는 중"
    : target === 1 ? "디자인 준비 중"
    : `${target}단계 준비 중`;

export default function App() {
  const alive = useServerAlive();
  return (
    <>
      {alive ? null : <Disconnected />}
      <Confirm />
    </>
  );
}

function Confirm() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [waitTarget, setWaitTarget] = useState(2);
  const [mismatchAck, setMismatchAck] = useState(false);
  const [intakeDraft, setIntakeDraft] = useState<any | null>(null);
  const [outlineDoc, setOutlineDoc] = useState<Doc | null>(null);
  const [rec, setRec] = useState<Recommendations>({});
  const [cat, setCat] = useState<Dict>({});
  const [state, setState] = useState<Dict>({});
  const [msg, setMsg] = useState("");
  // Which question is on screen, held by key so a changing list cannot strand
  // it. Declared here, above every early return: a hook that only runs in one
  // phase changes the hook count when the phase changes.
  const [stepKey, setStepKey] = useState("");

  const stageNum = useMemo(() => {
    const s = String(rec.stage || "");
    return s === "stage1" ? 1 : s === "stage2" ? 2 : s === "stage3" ? 3 : 0; // 0 = single pass
  }, [rec.stage]);

  const set = (k: string, v: any) => setState((s) => ({ ...s, [k]: v }));

  async function load() {
    try {
      const [r, c] = await Promise.all([
        api.getJson("/api/recommendations"),
        api.getJson("/api/catalogs"),
      ]);
      setRec(r); setCat(c); setState(api.initialState(r, c));
      // The planning artifacts live outside the three-stage machine; a missing
      // intake.json means the run has not been through Step 3.5 yet.
      let intake: any = null;
      try { intake = await api.readPlanning("intake"); } catch { /* server may predate the route */ }
      if (intake === null) { setIntakeDraft({}); setPhase("intake"); return; }
      // The skeleton is settled before any design choice (SKILL.md Step 3.7):
      // what the deck says decides what it needs to look like, not the reverse.
      let outline: any = null;
      try { outline = await api.readPlanning("outline"); } catch { /* same */ }
      if (outline?.text) {
        const doc = parseOutline(outline.text);
        if (!metaGet(doc, "confirmed_at")) { setOutlineDoc(doc); setPhase("outline"); return; }
      }
      setPhase("form");
    } catch {
      setPhase("error");
    }
  }
  useEffect(() => { load(); }, []);
  // 템플릿이나 크기를 다시 고르면 불일치 확인과 그때 띄운 오류 문구를 함께 무효화한다
  useEffect(() => { setMismatchAck(false); setMsg(""); }, [state?.template, state?.canvas]);
  // A new stage starts at its own first question. Clearing the key is enough —
  // an unknown key resolves to position 0 below.
  useEffect(() => { setStepKey(""); }, [stageNum]);

  /** After intake, wait for the agent to produce the outline the user edits. */
  async function pollOutline() {
    for (let i = 0; i < 3600; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      try {
        const all = await api.getJson("/api/planning");
        if (all?.outline?.exists) { await load(); return; }
      } catch { /* server may be restarting; keep polling */ }
    }
    setMsg(T.errRetry);
  }

  /** After a stage submit, wait for the agent to write the next stage. */
  async function pollNext(target: number) {
    for (let i = 0; i < 600; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      try {
        const s = await api.getJson("/api/session");
        if (Number(s?.recommendation_stage_number || 0) >= target) { await load(); return; }
      } catch { /* server may be restarting; keep polling */ }
    }
    setMsg(T.errRetry);
  }

  async function onPrimary() {
    setMsg("");
    try {
      if (stageNum === 1) {
        if (canvasMismatch && !mismatchAck) {
          setMsg(T.errCanvasMismatch);
          return;
        }
        await api.postConfirm(api.stage1Payload(state, cat));
        setWaitTarget(2); setPhase("deriving"); pollNext(2); return;
      }
      if (stageNum === 2) {
        await api.postConfirm(api.stage2Payload(state, cat));
        setWaitTarget(3); setPhase("deriving"); pollNext(3); return;
      }
      await api.postConfirm(api.finalPayload(state, cat));
      setPhase("done");
      api.shutdown();
    } catch (e: any) {
      if (e instanceof api.ValidationError) {
        setMsg(e.message === "image_usage_required" ? T.errImageRequired : T.errImageNoneExclusive);
      } else setMsg(T.errRetry);
    }
  }

  if (phase === "intake")
    return (
      <Intake
        draft={intakeDraft || {}}
        onDone={async (v) => {
          try {
            await api.savePlanning("intake", { data: v });
            setWaitTarget(0);
            setPhase("deriving");
            pollOutline();
          } catch {
            setMsg(T.errRetry);
          }
        }}
      />
    );
  if (phase === "outline" && outlineDoc)
    return (
      <OutlineEditor
        doc={outlineDoc}
        onConfirm={async (rows: Row[]) => {
          // `confirmed_at` is the person's approval, and it is also what makes
          // the write land: the agent waits on this file *changing*
          // (`--wait-planning outline`), so confirming an outline nobody edited
          // has to still differ from the version the agent wrote.
          const next = metaSet({ ...outlineDoc, rows }, "confirmed_at", localStamp());
          await api.savePlanning("outline", { text: serializeOutline(next) });
          setWaitTarget(1);
          setPhase("deriving");
          pollNext(1);
        }}
      />
    );
  // 고를 것이 없는 화면 넷. 셋 다 같은 틀 안에서 가운데만 바뀐다 — 예전에는
  // 여기만 머리띠도 없는 맨 화면이라 다른 물건처럼 보였다.
  if (phase === "loading")
    return (
      <Shell where="여는 중" progress={4} wide>
        <Mid art={<LoadingArt />} title={T.loading} />
      </Shell>
    );
  if (phase === "error")
    return (
      <Shell where="자료를 읽지 못함" progress={0} wide>
        <Mid art={<ErrorArt />} title={T.loadErrorTitle}>{T.loadError}</Mid>
      </Shell>
    );
  if (phase === "deriving")
    return (
      <Shell where={derivingWhere(waitTarget)} progress={derivingProgress(waitTarget)} wide>
        <Deriving target={waitTarget} />
      </Shell>
    );
  if (phase === "done")
    return (
      <Shell where="다 정했습니다" progress={100} wide>
        <Mid art={<DoneArt />} title={T.confirmedTitle}>{T.confirmedHint}</Mid>
      </Shell>
    );

  const R = rec.recommend || {};
  const showAnchors = stageNum === 0 || stageNum === 1;
  const showDesign = stageNum === 0 || stageNum === 2;
  const showImages = stageNum === 0 || stageNum === 3;
  const isPpt = api.isPptCanvas(state.canvas, cat);
  const aiOn = api.needsAi(state.image_usage || []);
  const spectrum: Record<string, string> = {};
  (rec.visual_style_spectrum || []).forEach((s: Dict) => {
    if (s?.id) spectrum[s.id] = `${s.tag_ko || s.tag_en || ""}${s.note_ko ? " · " + s.note_ko : ""}`;
  });
  const styleItems = (cat.visual_styles || []).flatMap((g: Dict) => g.items || []);
  // 덱 템플릿의 Master 기하는 그 덱의 canvas_format 에 고정돼 있다. 캔버스가 다르면
  // 구조화 라우트가 성립하지 않고 색·서체만 가져오는 flat 이 된다 — 조용히 넘기지 않는다.
  const pickedDeck = (cat.templates || []).find((d: Dict) => d.id === state.template);
  const deckFormat = state.template && state.template !== "free" ? pickedDeck?.canvas_format : null;
  const canvasMismatch = Boolean(deckFormat && deckFormat !== state.canvas);
  const steps = stageSteps(stageNum, state, cat, isPpt);

  // The list can change under us — picking a deck adds or drops a question — so
  // an unknown key falls back to the first, never to an empty screen.
  const at = Math.max(0, steps.findIndex((s) => s.key === stepKey));
  const current = steps[at]?.key ?? "";
  const stepCtx = { current, index: (k: string) => steps.findIndex((s) => s.key === k) };
  const goTo = (i: number) => {
    const next = steps[Math.min(Math.max(i, 0), steps.length - 1)];
    if (next) setStepKey(next.key);
  };
  const isLast = at >= steps.length - 1;

  return (
    <Shell
      where={stageNum ? `디자인 정하기 · 3단계 중 ${stageNum}` : T.title}
      progress={stageProgress(stageNum, at, steps.length)}
      footNote={`${at + 1} / ${steps.length}${isLast ? " · 마지막입니다" : ""}`}
      footActions={
        <>
          {msg ? <span className="text-sm" style={{ color: "var(--danger)" }}>{msg}</span> : null}
          <Button variant="secondary" isDisabled={at === 0} onPress={() => goTo(at - 1)}>
            ← {T.prev}
          </Button>
          {isLast
            ? <Button variant="primary" onPress={onPrimary}>
                {stageNum && stageNum < 3 ? `${T.next} →` : T.confirm}
              </Button>
            : <Button variant="primary" onPress={() => goTo(at + 1)}>{T.next} →</Button>}
        </>
      }>
      <Steps items={steps.map((s) => s.title)} at={at} />
      <StepCtx.Provider value={stepCtx}>
          {showAnchors && (
            <>
              {cat.templates?.length > 1 && (
                <Section k="template" title={T.secTemplate}>
                  <ThumbChoice
                    items={cat.templates} value={state.template}
                    onChange={(v) => set("template", v)} recommended={R.template}
                    srcFor={(it) =>
                      it.id === "free" ? null
                        : `/api/template_preview/${encodeURIComponent(it.id)}?lang=ko`}
                  />
                </Section>
              )}
              <Section k="canvas" title={T.secCanvas}>
                <RatioChoice items={cat.canvas || []} value={state.canvas}
                             onChange={(v) => set("canvas", v)} recommended={R.canvas} />
                {/* 고른 크기가 실제로 어떤 비율인지, 그리고 템플릿과 안 맞으면
                    여기서 막는다. 예전에는 이 경고가 화면 왼쪽 패널에 있어
                    질문에서 눈을 떼야 보였다. */}
                <AnchorPreview state={state} cat={cat} ack={mismatchAck}
                               onFixCanvas={(id) => set("canvas", id)}
                               onAck={() => setMismatchAck((v) => !v)} />
              </Section>
              <Section k="audience" title={T.secAudience}>
                <PresetField
                  legend="가까운 것을 고르고 필요하면 고쳐 쓰세요"
                  presets={AUDIENCE_PRESETS} value={state.audience}
                  onChange={(v) => set("audience", v)} placeholder={T.phAudience} />
                <PresetField
                  legend={T.subDivergence}
                  hint="비워 두면 알아서 균형을 잡습니다"
                  presets={DIVERGENCE_PRESETS} value={state.content_divergence}
                  onChange={(v) => set("content_divergence", v)} placeholder={T.phDivergence} />
                {isPpt && (
                  <div>
                    <div className="mb-3 text-base font-semibold">{T.subDelivery}</div>
                    <DiagramChoice items={cat.delivery_purpose || []}
                                   value={state.delivery_purpose}
                                   onChange={(v) => set("delivery_purpose", v)}
                                   recommended={R.delivery_purpose} />
                  </div>
                )}
              </Section>
              <Section k="style" title={T.secStyle}>
                <div>
                  <div className="mb-3 text-base font-semibold">{T.subMode}</div>
                  <DiagramChoice items={cat.modes || []} value={state.mode}
                                 onChange={(v) => set("mode", v)} recommended={R.mode} />
                </div>
                <div>
                  <div className="mb-3 text-base font-semibold">{T.subVisual}</div>
                  <ThumbChoice
                    items={styleItems} value={state.visual_style}
                    onChange={(v) => set("visual_style", v)} recommended={R.visual_style}
                    tags={spectrum} cols={3}
                    srcFor={(it) => `/static/style_previews/${encodeURIComponent(it.id)}.svg`} />
                </div>
                {state.template_adherence && (
                  <Choice legend={T.subAdherence} items={cat.template_adherence || []}
                          value={state.template_adherence}
                          onChange={(v) => set("template_adherence", v)}
                          recommended={R.template_adherence} />
                )}
              </Section>
            </>
          )}

          {showDesign && (
            <>
              <Section k="pages" title={T.secPages}>
                <PageCount value={state.page_count} onChange={(v) => set("page_count", v)} />
              </Section>
              <Section k="color" title={T.secColor}>
                <PaletteChoice
                  candidates={rec.color?.candidates || []}
                  selectedIndex={(rec.color?.candidates || []).findIndex(
                    (c: Dict) => candName(c) === state.color?.name)}
                  recommendedIndex={Number(rec.color?.selected) || 0}
                  nameOf={candName} noteOf={candNote}
                  onSelect={(i) => {
                    const c = rec.color.candidates[i];
                    set("color", { name: candName(c), palette: { ...c.palette } });
                  }}
                />
                <div>
                  <div className="mb-3 text-[15px] font-semibold">{T.hexOverride}</div>
                  <HexGrid palette={state.color?.palette || {}} roles={T.roles}
                           onChange={(role, v) =>
                             setState((s) => ({ ...s,
                               color: { ...s.color, palette: { ...s.color.palette, [role]: v } } }))} />
                </div>
              </Section>
              <Section k="icons" title={T.secIcons}>
                <IconChoice items={cat.icons || []} value={state.icons}
                            onChange={(v) => set("icons", v)} recommended={R.icons} />
              </Section>
              <Section k="type" title={T.secType}>
                <TypeSpecimen
                  typography={state.typography || {}}
                  onBody={(v) => setState((s) => {
                    const next = parseFloat(v);
                    const prev = Number(s.typography.body_size) || 1;
                    const ratio = isFinite(next) && prev ? next / prev : 1;
                    const sizes = { ...s.typography.sizes };
                    if (isFinite(next)) for (const k of Object.keys(sizes))
                      sizes[k] = Math.round((Number(sizes[k]) || 0) * ratio);
                    return { ...s, typography: { ...s.typography, body_size: v, sizes } };
                  })}
                  onRole={(role, v) => setState((s) => ({ ...s,
                    typography: { ...s.typography, sizes: { ...s.typography.sizes, [role]: v } } }))}
                />
                <div>
                  <div className="mb-3 text-base font-semibold">합쳐 놓으면 이렇게 보입니다</div>
                  <SkinPreview state={state} />
                </div>
              </Section>
              <Section k="formula" title={T.secFormula}>
                <Choice items={cat.formula_policy || []} value={state.formula_policy}
                        onChange={(v) => set("formula_policy", v)} recommended={R.formula_policy} />
              </Section>
            </>
          )}

          {showImages && (
            <>
              <Section k="images" title={T.secImages}>
                <ImageSourceChoice
                  items={cat.image_usage || []} value={state.image_usage}
                  onChange={(v) => set("image_usage", v)}
                  recommended={Array.isArray(R.image_usage) ? R.image_usage : [R.image_usage].filter(Boolean)} />
                <PresetField
                  legend={T.subImageNotes}
                  hint="가까운 것을 고르고 필요하면 고쳐 쓰세요"
                  presets={IMAGE_PRESETS} value={state.image_notes}
                  onChange={(v) => set("image_notes", v)} placeholder={T.phImageNotes} />
                {aiOn && (
                  <>
                    <Choice legend={T.subImagePath} items={cat.image_ai_path || []}
                            value={state.image_ai_path}
                            onChange={(v) => set("image_ai_path", v)} recommended={R.image_ai_path} />
                    <div>
                      <div className="mb-3 text-base font-semibold">{T.subImageStrategy}</div>
                      <StrategyChoice
                        candidates={rec.image_strategy?.candidates || []}
                        selectedIndex={(rec.image_strategy?.candidates || []).findIndex(
                          (c: Dict) => c.name === state.image_strategy?.name)}
                        recommendedIndex={Number(rec.image_strategy?.selected) || 0}
                        nameOf={candName} noteOf={candNote}
                        onSelect={(i) => set("image_strategy", { ...rec.image_strategy.candidates[i] })}
                      />
                    </div>
                  </>
                )}
                {/* 고른 이미지 방향이 실제로 어떤 그림인지. 옆 패널에 있을 때는
                    고르는 곳과 보는 곳이 떨어져 있어 대조가 안 됐다. */}
                <ImagePreview state={state} />
              </Section>
              <Section k="genmode" title={T.secMode}>
                <ArtChoice
                  items={(cat.generation_mode || []).map((m: Dict) => ({
                    id: String(m.id), label: String(m.label_ko || m.id),
                    note: String(m.desc_ko || m.note_ko || ""),
                  }))}
                  value={state.generation_mode}
                  onChange={(v) => set("generation_mode", v)}
                  recommended={R.generation_mode}
                  art={{ continuous: modeContinuous, split: modeSplit }} />
              </Section>
              <Section k="refine" title={T.secRefine}>
                {/* 켬/끔 스위치였다. 두 갈래가 어떻게 다른지는 스위치가 말해주지
                    못해서, 켠 상태의 글을 읽어야만 알 수 있었다. 카드 둘로
                    바꾸니 고르기 전에 차이가 보인다. */}
                <ArtChoice
                  items={[
                    { id: "yes", label: T.refineOn,
                      note: "기획서를 먼저 확인하고, 고칠 것을 고친 뒤에 슬라이드를 만듭니다" },
                    { id: "no", label: T.refineOff,
                      note: "기획서를 건너뛰고 바로 슬라이드까지 만듭니다" },
                  ]}
                  value={state.refine_spec ? "yes" : "no"}
                  onChange={(v) => set("refine_spec", v === "yes")}
                  art={{ yes: modePlanYes, no: modePlanNo }} />
              </Section>
            </>
          )}
      </StepCtx.Provider>
    </Shell>
  );
}

