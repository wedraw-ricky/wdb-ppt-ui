import { useEffect, useMemo, useState } from "react";
import {
  Button, Card, Checkbox, CheckboxGroup, Description, Input, Label,
  Switch, TextArea, TextField,
} from "@heroui/react";
import * as api from "./api";
import type { Dict, Recommendations } from "./api";
import { T, label, desc, candName, candNote } from "./i18n";
import {
  AUDIENCE_PRESETS, Choice, DIVERGENCE_PRESETS, DiagramChoice, IconChoice,
  PresetField, RatioChoice, Star, ThumbChoice,
} from "./selectors";
import { DoneArt, WaitingArt } from "./states";

/* ---------- small building blocks ------------------------------------- */

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <Card className="mb-4">
      <Card.Header>
        <Card.Title className="flex items-center gap-3 text-base">
          <span
            className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm font-bold text-white"
            style={{ background: "var(--wdb-secondary)" }}
          >
            {n}
          </span>
          {title}
        </Card.Title>
      </Card.Header>
      <Card.Content className="flex flex-col gap-4">{children}</Card.Content>
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

/* ---------- live preview (the one gradient surface) -------------------- */

function Hero({ state }: { state: Dict }) {
  const pal = state.color?.palette || {};
  const headCss = state.typography?.heading?.css || "Paperlogy, sans-serif";
  const bodyCss = state.typography?.body?.css || "Paperlogy, sans-serif";
  const bodySize = Number(state.typography?.body_size) || 24;
  return (
    <aside className="wdb-hero hidden w-[38%] max-w-[560px] min-w-[360px] flex-col gap-5 p-6 lg:flex">
      <div className="flex items-center gap-3 border-b border-white/20 pb-4">
        <div className="grid h-9 w-9 place-items-center rounded-lg border border-white/30 bg-white/15 text-sm font-bold">
          PM
        </div>
        <div>
          <div className="text-[11px] tracking-widest opacity-80">PPT MASTER</div>
          <div className="text-sm font-bold">{T.title}</div>
        </div>
      </div>
      <div className="text-xs opacity-80">전체 인상 미리보기 · 실제 슬라이드 배치는 아닙니다</div>
      <div
        className="rounded-xl p-6 shadow-lg"
        style={{ background: pal.background || "#fff", color: pal.body_text || "#1a1a1a" }}
      >
        <div style={{ fontFamily: headCss, fontSize: 30, fontWeight: 800, color: pal.primary }}>
          큰 제목 <span style={{ color: pal.accent }}>섹션 제목</span>
        </div>
        <div style={{ fontFamily: bodyCss, fontSize: bodySize, marginTop: 12, lineHeight: 1.5 }}>
          본문 글씨가 이 정도 크기로 보입니다.
        </div>
        <div className="mt-4 h-1.5 w-24 rounded" style={{ background: pal.accent }} />
        <div
          className="mt-4 rounded-lg px-3 py-2 text-sm"
          style={{ background: pal.secondary_bg, color: pal.body_text }}
        >
          보조 배경 위의 문장
        </div>
      </div>
    </aside>
  );
}

/* ---------- app -------------------------------------------------------- */

type Phase = "loading" | "form" | "deriving" | "done" | "error";

export default function App() {
  const [phase, setPhase] = useState<Phase>("loading");
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
      setRec(r); setCat(c); setState(api.initialState(r, c)); setPhase("form");
    } catch {
      setPhase("error");
    }
  }
  useEffect(() => { load(); }, []);

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
        await api.postConfirm(api.stage1Payload(state, cat));
        setPhase("deriving"); pollNext(2); return;
      }
      if (stageNum === 2) {
        await api.postConfirm(api.stage2Payload(state, cat));
        setPhase("deriving"); pollNext(3); return;
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

  if (phase === "loading") return <Centered>{T.loading}</Centered>;
  if (phase === "error") return <Centered>{T.loadError}</Centered>;
  if (phase === "deriving")
    return (
      <Centered>
        <div className="flex flex-col items-center gap-4">
          <WaitingArt />
          <span>{T.deriving}</span>
        </div>
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
  let n = 0;

  return (
    <div className="flex h-full">
      <Hero state={state} />
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="border-b px-6 py-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <h1 className="text-lg font-bold">{stageNum ? T.stages[stageNum - 1] : T.title}</h1>
          <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>{T.hint}</p>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
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
                    <div className="mb-2 text-sm font-semibold">{T.subDelivery}</div>
                    <DiagramChoice items={cat.delivery_purpose || []}
                                   value={state.delivery_purpose}
                                   onChange={(v) => set("delivery_purpose", v)}
                                   recommended={R.delivery_purpose} />
                  </div>
                )}
              </Section>
              <Section n={++n} title={T.secStyle}>
                <div>
                  <div className="mb-2 text-sm font-semibold">{T.subMode}</div>
                  <DiagramChoice items={cat.modes || []} value={state.mode}
                                 onChange={(v) => set("mode", v)} recommended={R.mode} />
                </div>
                <div>
                  <div className="mb-2 text-sm font-semibold">{T.subVisual}</div>
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
                <TextField value={state.page_count} onChange={(v: string) => set("page_count", v)}>
                  <Input placeholder={T.phPages} />
                </TextField>
              </Section>
              <Section n={++n} title={T.secColor}>
                <Candidates
                  block={rec.color}
                  selected={(rec.color?.candidates || []).findIndex(
                    (c: Dict) => candName(c) === state.color?.name)}
                  onSelect={(i) => {
                    const c = rec.color.candidates[i];
                    set("color", { name: candName(c), palette: { ...c.palette } });
                  }}
                  render={(c) => (
                    <div className="flex gap-1">
                      {Object.entries(c.palette || {}).map(([k, v]) => (
                        <span key={k} title={T.roles[k] || k}
                              className="h-6 w-6 rounded border"
                              style={{ background: v as string, borderColor: "var(--border)" }} />
                      ))}
                    </div>
                  )}
                />
                <div>
                  <div className="mb-2 text-xs font-semibold" style={{ color: "var(--muted)" }}>
                    {T.hexOverride}
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {Object.keys(state.color?.palette || {}).map((role) => (
                      <TextField key={role} value={state.color.palette[role]}
                                 onChange={(v: string) =>
                                   setState((s) => ({ ...s,
                                     color: { ...s.color, palette: { ...s.color.palette, [role]: v } } }))}>
                        <Label className="text-xs">{T.roles[role] || role}</Label>
                        <Input />
                      </TextField>
                    ))}
                  </div>
                </div>
              </Section>
              <Section n={++n} title={T.secIcons}>
                <IconChoice items={cat.icons || []} value={state.icons}
                            onChange={(v) => set("icons", v)} recommended={R.icons} />
              </Section>
              <Section n={++n} title={T.secType}>
                <div className="rounded-xl border p-4" style={{ borderColor: "var(--border)" }}>
                  <div style={{ fontFamily: state.typography?.heading?.css, fontSize: 26, fontWeight: 800 }}>
                    {state.typography?.heading?.cjk} · 큰 제목
                  </div>
                  <div style={{ fontFamily: state.typography?.body?.css,
                                fontSize: Number(state.typography?.body_size) || 24, marginTop: 8 }}>
                    본문 글씨가 이 정도 크기로 보입니다.
                  </div>
                </div>
                <TextField
                  value={String(state.typography?.body_size ?? "")}
                  onChange={(v: string) => {
                    const next = parseFloat(v);
                    setState((s) => {
                      const prev = Number(s.typography.body_size) || 1;
                      const ratio = isFinite(next) && prev ? next / prev : 1;
                      const sizes = { ...s.typography.sizes };
                      if (isFinite(next)) for (const k of Object.keys(sizes))
                        sizes[k] = Math.round((Number(sizes[k]) || 0) * ratio);
                      return { ...s, typography: { ...s.typography, body_size: v, sizes } };
                    });
                  }}>
                  <Label>{T.bodySize}</Label>
                  <Input inputMode="decimal" />
                  <Description>
                    {T.bodySizeHint} {T.ptRelation}
                    {isFinite(Number(state.typography?.body_size))
                      ? ` · ${T.ptApprox(Math.round(Number(state.typography.body_size) * 0.75 * 10) / 10)}`
                      : ""}
                  </Description>
                </TextField>
                <div>
                  <div className="mb-2 text-xs font-semibold" style={{ color: "var(--muted)" }}>
                    {T.sizeOverride} — {T.sizeOverrideHint}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {(["title", "subtitle", "annotation"] as const).map((role) => (
                      <TextField key={role} value={String(state.typography?.sizes?.[role] ?? "")}
                                 onChange={(v: string) =>
                                   setState((s) => ({ ...s, typography: { ...s.typography,
                                     sizes: { ...s.typography.sizes, [role]: v } } }))}>
                        <Label className="text-xs">
                          {role === "title" ? T.roleTitle : role === "subtitle" ? T.roleSubtitle : T.roleAnnotation}
                        </Label>
                        <Input inputMode="decimal" />
                      </TextField>
                    ))}
                  </div>
                </div>
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
                <CheckboxGroup value={state.image_usage}
                               onChange={(v: string[]) => set("image_usage", v)}>
                  {(cat.image_usage || []).map((it: Dict) => (
                    <Checkbox key={it.id} value={it.id}>
                      <Checkbox.Content>
                        <Checkbox.Control><Checkbox.Indicator /></Checkbox.Control>
                        <span>
                          {label(it)}
                          {(Array.isArray(R.image_usage) ? R.image_usage : [R.image_usage]).includes(it.id)
                            ? <Star /> : null}
                        </span>
                      </Checkbox.Content>
                      {desc(it) ? <Description>{desc(it)}</Description> : null}
                    </Checkbox>
                  ))}
                </CheckboxGroup>
                <TextField value={state.image_notes} onChange={(v: string) => set("image_notes", v)}>
                  <Label>{T.subImageNotes}</Label>
                  <TextArea rows={2} placeholder={T.phImageNotes} />
                </TextField>
                {aiOn && (
                  <>
                    <Choice legend={T.subImagePath} items={cat.image_ai_path || []}
                            value={state.image_ai_path}
                            onChange={(v) => set("image_ai_path", v)} recommended={R.image_ai_path} />
                    <div>
                      <div className="mb-2 text-sm font-semibold">{T.subImageStrategy}</div>
                      <Candidates
                        block={rec.image_strategy}
                        selected={(rec.image_strategy?.candidates || []).findIndex(
                          (c: Dict) => c.name === state.image_strategy?.name)}
                        onSelect={(i) => set("image_strategy", { ...rec.image_strategy.candidates[i] })}
                        render={(c) => (
                          <dl className="text-xs" style={{ color: "var(--muted)" }}>
                            {Object.entries(T.strategyFields).map(([k, lab]) =>
                              c[k] ? (
                                <div key={k} className="flex gap-1">
                                  <dt className="font-semibold">{lab}</dt>
                                  <dd>{c[k]}</dd>
                                </div>
                              ) : null)}
                          </dl>
                        )}
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
