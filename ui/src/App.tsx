import { useEffect, useMemo, useState } from "react";
import {
  Button, Card, Checkbox, CheckboxGroup, Description, Input, Label,
  Switch, TextArea, TextField,
} from "@heroui/react";
import * as api from "./api";
import type { Dict, Recommendations } from "./api";
import { T, label, desc, candName, candNote } from "./i18n";
import {
  AUDIENCE_PRESETS, Choice, DIVERGENCE_PRESETS, DiagramChoice, IconChoice, IMAGE_PRESETS,
  PresetField, RatioChoice, Star, ThumbChoice,
} from "./selectors";
import { Deriving, DoneArt } from "./states";
import { PaletteChoice, HexGrid, TypeSpecimen, PageCount, ImageSourceChoice, StrategyChoice } from "./stage23";
import { Hero, stageSteps } from "./hero";
import { Intake } from "./intake";

/* ---------- small building blocks ------------------------------------- */

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <Card className="mb-8">
      <Card.Header className="pb-1">
        <Card.Title className="flex items-center gap-3 text-xl font-bold">
          <span
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold text-white"
            style={{ background: "var(--wdb-secondary)" }}
          >
            {n}
          </span>
          {title}
        </Card.Title>
      </Card.Header>
      <Card.Content className="flex flex-col gap-7 pt-2">{children}</Card.Content>
    </Card>
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

type Phase = "loading" | "form" | "deriving" | "done" | "error";

export default function App() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [waitTarget, setWaitTarget] = useState(2);
  const [mismatchAck, setMismatchAck] = useState(false);
  const [intakeDraft, setIntakeDraft] = useState<any | null>(null);
  const [rec, setRec] = useState<Recommendations>({});
  const [cat, setCat] = useState<Dict>({});
  const [state, setState] = useState<Dict>({});
  const [msg, setMsg] = useState("");

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
      setPhase("form");
    } catch {
      setPhase("error");
    }
  }
  useEffect(() => { load(); }, []);
  // 템플릿이나 크기를 다시 고르면 불일치 확인과 그때 띄운 오류 문구를 함께 무효화한다
  useEffect(() => { setMismatchAck(false); setMsg(""); }, [state?.template, state?.canvas]);

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
  if (phase === "loading") return <Centered>{T.loading}</Centered>;
  if (phase === "error") return <Centered>{T.loadError}</Centered>;
  if (phase === "deriving")
    return (
      <Centered>
        <Deriving target={waitTarget} />
      </Centered>
    );
  if (phase === "done")
    return (
      <Centered>
        <div className="flex flex-col items-center gap-4 text-center">
          <DoneArt />
          <div className="text-2xl font-extrabold" style={{ color: "var(--foreground)" }}>
            {T.confirmedTitle}
          </div>
          <div className="mt-2 text-sm" style={{ color: "var(--muted)" }}>{T.confirmedHint}</div>
        </div>
      </Centered>
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
  let n = 0;

  return (
    <div className="flex h-full">
      <Hero state={state} cat={cat} stageNum={stageNum} steps={steps}
              ack={mismatchAck}
              onFixCanvas={(id) => set("canvas", id)}
              onAck={() => setMismatchAck((v) => !v)} />
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="border-b px-8 py-5" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <h1 className="text-xl font-bold">{stageNum ? T.stages[stageNum - 1] : T.title}</h1>
          <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>{T.hint}</p>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-8 py-7">
          {showAnchors && (
            <>
              {cat.templates?.length > 1 && (
                <Section n={++n} title={T.secTemplate}>
                  <ThumbChoice
                    items={cat.templates} value={state.template}
                    onChange={(v) => set("template", v)} recommended={R.template}
                    srcFor={(it) =>
                      it.id === "free" ? null
                        : `/api/template_preview/${encodeURIComponent(it.id)}?lang=ko`}
                  />
                </Section>
              )}
              <Section n={++n} title={T.secCanvas}>
                <RatioChoice items={cat.canvas || []} value={state.canvas}
                             onChange={(v) => set("canvas", v)} recommended={R.canvas} />
              </Section>
              <Section n={++n} title={T.secAudience}>
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
              <Section n={++n} title={T.secStyle}>
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
              <Section n={++n} title={T.secPages}>
                <PageCount value={state.page_count} onChange={(v) => set("page_count", v)} />
              </Section>
              <Section n={++n} title={T.secColor}>
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
              <Section n={++n} title={T.secIcons}>
                <IconChoice items={cat.icons || []} value={state.icons}
                            onChange={(v) => set("icons", v)} recommended={R.icons} />
              </Section>
              <Section n={++n} title={T.secType}>
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
              </Section>
              <Section n={++n} title={T.secFormula}>
                <Choice items={cat.formula_policy || []} value={state.formula_policy}
                        onChange={(v) => set("formula_policy", v)} recommended={R.formula_policy} />
              </Section>
            </>
          )}

          {showImages && (
            <>
              <Section n={++n} title={T.secImages}>
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
              </Section>
              <Section n={++n} title={T.secMode}>
                <Choice items={cat.generation_mode || []} value={state.generation_mode}
                        onChange={(v) => set("generation_mode", v)} recommended={R.generation_mode} />
              </Section>
              <Section n={++n} title={T.secRefine}>
                <Switch isSelected={state.refine_spec}
                        onChange={(b: boolean) => set("refine_spec", b)}>
                  <Switch.Control><Switch.Thumb /></Switch.Control>
                  <Switch.Content>
                    <Label>{state.refine_spec ? T.refineOn : T.refineOff}</Label>
                  </Switch.Content>
                </Switch>
              </Section>
            </>
          )}
        </div>

        <footer className="flex items-center justify-end gap-3 border-t px-6 py-3"
                style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          {msg ? <span className="text-sm" style={{ color: "var(--danger)" }}>{msg}</span> : null}
          <Button variant="primary" onPress={onPrimary}>
            {stageNum && stageNum < 3 ? `${T.next} →` : T.confirm}
          </Button>
        </footer>
      </main>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid h-full place-items-center p-8 text-sm" style={{ color: "var(--muted)" }}>
      {children}
    </div>
  );
}
