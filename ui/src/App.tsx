/* 흐름. DESIGN.md «서비스의 모양»: 기획(1 자료 넣기 → 2 인터뷰 → 3 기획서) →
   문서(4) → 발표(5 뼈대 → 6 디자인 → 7 만드는 중 → 8 완성). 인터뷰 ⑨에서 갈린다.

   어느 화면인지는 파이프라인이 남긴 파일이 정한다. intake.json 이 없으면 인터뷰,
   outline.md 가 없으면 기획서(쓰는 중), 뼈대가 확정 전이면 뼈대, 확정됐으면
   디자인. 세 단계 후보(stage1·2·3)는 디자인 화면 안에서 돈다. 주소 뒤의
   #/n 은 검토용으로 그 화면을 억지로 연다 — 1 자료 넣기와 4 문서처럼 아직
   파이프라인이 없는 껍데기도 그렇게 본다. */

import { useEffect, useMemo, useState } from "react";
import * as api from "./api";
import type { Recommendations } from "./api";
import { Interview, type IntakeExtra } from "./intake";
import { Input, Plan, Doc, parsePlanSpec, type PlanDoc } from "./planning";
import { OutlineEditor } from "./outline";
import { type Doc as OutlineDoc, type Row, localStamp, metaGet, metaSet, parseOutline, serializeOutline } from "./outline/model";
import { Design } from "./design";
import { Making, Done, Broken, type WaitKind } from "./states";
import { StepsCtx, type StepInfo } from "./shell";

type Dict = Record<string, any>;
type Phase = "loading" | "error" | "interview" | "plan" | "outline" | "form" | "wait" | "handoff" | "done";
const HEARTBEAT_MS = 5000;

function useServerAlive(): boolean {
  const [alive, setAlive] = useState(true);
  useEffect(() => {
    let stopped = false, misses = 0;
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

/** 주소 뒤 #/n. 검토용. */
function useHashScreen(): number {
  const read = () => Number((location.hash.match(/^#\/(\d)/) || [])[1] || 0);
  const [n, setN] = useState(read);
  useEffect(() => { const f = () => setN(read()); addEventListener("hashchange", f); return () => removeEventListener("hashchange", f); }, []);
  return n;
}
/** 6 디자인은 기본 화면이라 주소가 비어 있다. */
const go = (n: number) => { location.hash = n === 6 ? "" : `#/${n}`; };

export default function App() {
  const alive = useServerAlive();
  const [retry, setRetry] = useState(0);
  // 고른 것을 넘기고 나면 서버가 일부러 꺼진다 (파이프라인의 약속). 그건 고장이
  // 아니라 순서라서 «제 쪽 문제예요» 를 띄우지 않는다.
  const [handed, setHanded] = useState(false);
  if (!alive && !handed) return <Broken reason="server" kept={["답하신 것", "기획서", "뼈대", "이 화면에 고른 것"]} onRetry={() => setRetry((v) => v + 1)} />;
  return <Flow key={retry} onHandoff={() => setHanded(true)} />;
}

function Flow({ onHandoff }: { onHandoff: () => void }) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [wait, setWait] = useState<WaitKind>("plan");
  const [rec, setRec] = useState<Recommendations>({});
  const [cat, setCat] = useState<Dict>({});
  const [state, setState] = useState<Dict>({});
  const [intake, setIntake] = useState<Partial<IntakeExtra> | null>(null);
  const [plan, setPlan] = useState<PlanDoc | null>(null);
  const [outline, setOutline] = useState<OutlineDoc | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  // 채팅이 기다리고 있는가. null 이면 서버가 그 길을 모르는 것(옛 판).
  const [agent, setAgent] = useState<api.AgentInfo | null>(null);
  const hash = useHashScreen();

  const stageNum = useMemo(() => {
    const s = String(rec.stage || "");
    return s === "stage1" ? 1 : s === "stage2" ? 2 : s === "stage3" ? 3 : 0;
  }, [rec.stage]);
  const set = (k: string, v: any) => setState((s) => ({ ...s, [k]: v }));
  const rows: Row[] = outline?.rows || [];
  const confirmedRows: Row[] = outline && metaGet(outline, "confirmed_at") ? rows : [];
  const docToo = intake?.doc_kind === "둘 다" || intake?.doc_kind === "보고서";
  const deckToo = intake?.doc_kind !== "보고서";
  const quote = (intake?.conclusion || "").trim().split(/[.。]/)[0].slice(0, 30) || undefined;

  async function load() {
    try {
      const [r, c, ag] = await Promise.all([api.getJson("/api/recommendations"), api.getJson("/api/catalogs"), api.agentWaiting()]);
      setRec(r); setCat(c); setState(api.initialState(r, c)); setAgent(ag);
      let ik: any = null, ps: any = null, ol: any = null;
      try { ik = await api.readPlanning("intake"); } catch { /* 옛 서버 */ }
      try { ps = await api.readPlanning("plan-spec"); } catch { /* 같음 */ }
      try { ol = await api.readPlanning("outline"); } catch { /* 같음 */ }
      setIntake(ik?.data ?? ik ?? null);
      setPlan(ps?.text ? parsePlanSpec(ps.text) : null);
      const doc = ol?.text ? parseOutline(ol.text) : null;
      setOutline(doc);
      if (!ik) { setPhase("interview"); return; }
      if (!doc) { setPhase("plan"); return; }
      if (!metaGet(doc, "confirmed_at")) { setPhase("outline"); return; }
      setPhase("form");
    } catch { setPhase("error"); }
  }
  useEffect(() => { load(); }, []);

  /** 인터뷰 뒤. 파이프라인이 기획서와 뼈대를 쓰는 동안 기다린다. 기획서가 먼저
      오면 그걸 보여주고, 뼈대가 오면 뼈대로. */
  async function pollPlanning() {
    for (let i = 0; i < 3600; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      try {
        const all = await api.getJson("/api/planning");
        if (all?.outline?.exists) { await load(); return; }
        if (all?.["plan-spec"]?.exists) {
          const ps = await api.readPlanning("plan-spec");
          if (ps?.text) { setPlan(parsePlanSpec(ps.text)); setPhase("plan"); }
        }
      } catch { /* 서버가 다시 뜨는 중일 수 있다 */ }
    }
    setMsg("너무 오래 걸려요. 채팅을 봐 주세요.");
  }

  /** 단계 제출 뒤. 파이프라인이 다음 단계 후보를 쓸 때까지. */
  async function pollNext(target: number) {
    for (let i = 0; i < 600; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      try {
        const s = await api.getJson("/api/session");
        if (Number(s?.recommendation_stage_number || 0) >= target) { await load(); return; }
        // 후보를 한 번에 다 쓰는 것이 기본이고 그때는 stage 키가 없다. 후보가
        // 이미 쓰여 있고 단계가 안 붙어 있으면 그게 준비된 것이다.
        if (!s?.recommendation_stage && s?.recommendation_version) { await load(); return; }
      } catch { /* 같음 */ }
    }
    setMsg("너무 오래 걸려요. 채팅을 봐 주세요.");
  }

  async function onPrimary(refineFirst: boolean) {
    setMsg(""); setBusy(true);
    const sent = { ...state, refine_spec: refineFirst || state.refine_spec };
    if (confirmedRows.length && !sent.page_count) sent.page_count = String(confirmedRows.length);
    try {
      if (stageNum === 1) { await api.postConfirm(api.stage1Payload(sent, cat)); setWait("stage"); setPhase("wait"); pollNext(2); return; }
      if (stageNum === 2) { await api.postConfirm(api.stage2Payload(sent, cat)); setWait("stage"); setPhase("wait"); pollNext(3); return; }
      // 누르기 직전에 한 번 더 본다. 채팅이 기다리고 있는지는 그 사이 바뀔 수 있다.
      setAgent(await api.agentWaiting());
      await api.postConfirm(api.finalPayload(sent, cat));
      // 여기서부터는 채팅의 파이프라인이 만든다. 이 화면을 받쳐 주던 서버는
      // 일을 넘기고 꺼진다. 그래서 «다 됐어요» 가 아니라 «만들기 시작했어요» 다.
      onHandoff();
      setPhase("handoff");
      api.shutdown();
    } catch (e: any) {
      if (e instanceof api.ValidationError)
        setMsg(e.message === "image_usage_required" ? "사진을 어디서 가져올지 하나는 골라 주세요." : "«사진 없이»는 다른 것과 같이 못 골라요.");
      else setMsg("저장이 안 됐어요. 다시 눌러 주세요.");
    } finally { setBusy(false); }
  }

  /** 답이 그대로면 저장하지 않고 다음 화면으로. 바뀌었으면 저장하고, 기획서는
      파이프라인이 다시 써야 한다고 말한다 (이 서버만 떠 있을 때는 아무도 안 쓴다). */
  const [intakeChanged, setIntakeChanged] = useState(false);
  async function saveIntake(v: IntakeExtra) {
    const same = intake && JSON.stringify({ ...api.EMPTY_INTAKE, ...intake }) === JSON.stringify({ ...api.EMPTY_INTAKE, ...v });
    if (same && plan) { go(3); return; }
    await api.savePlanning("intake", { data: v });
    setIntake(v);
    if (plan) { setIntakeChanged(true); go(3); return; }
    location.hash = ""; setWait("plan"); setPhase("wait"); pollPlanning();
  }
  const toOutline = () => { if (outline) go(5); else { location.hash = ""; setPhase("plan"); } };

  const palette = state.color?.palette || null;
  const sources: string[] = []; // 자료 목록은 파이프라인이 아직 안 넘겨준다
  const confirmedAt = outline ? metaGet(outline, "confirmed_at") : "";
  const priorNote = confirmedAt
    ? `인터뷰, 기획서, 뼈대는 ${confirmedAt.slice(0, 10)}에 끝나 있어요. 여기서 이어가요. 앞 단계는 위 번호를 눌러 볼 수 있어요.`
    : undefined;

  /* 여덟 걸음의 상태. 파일이 있으면 끝난 것이다. */
  const nowStep =
    hash || (phase === "interview" ? 2 : phase === "plan" ? 3 : phase === "outline" ? 5 : phase === "form" ? 6
      : phase === "wait" ? ({ plan: 3, outline: 5, stage: 6, final: 7 } as const)[wait] : phase === "handoff" ? 7 : phase === "done" ? 8 : 1);
  const doneFlags = [Boolean(intake), Boolean(intake), Boolean(plan), Boolean(plan && docToo), Boolean(confirmedAt),
                     Boolean(rec._already_confirmed) || phase === "handoff", false, false];
  const labels = ["자료", "인터뷰", "기획서", "문서", "뼈대", "디자인", "만드는 중", "완성"];
  const steps: StepInfo[] = labels.map((label, i) => ({
    n: i + 1, label,
    state: i + 1 === nowStep ? "now" : doneFlags[i] ? "done" : "todo",
    note: i === 3 && !docToo ? "발표자료만 만들어서 건너뛰어요" : undefined,
  }));

  const view = () => {
    /* 검토용 강제 화면 */
    if (hash === 1) return <Input sources={sources} onNext={() => go(2)} />;
    if (hash === 2) return <Interview draft={intake || {}} onBack={() => go(1)} onDone={saveIntake} />;
    if (hash === 3) return <Plan doc={plan} quote={quote} waiting={!outline && !plan} stale={intakeChanged}
                                 onBack={() => go(2)} onDoc={() => go(4)} onOutline={toOutline} />;
    if (hash === 4) return <Doc doc={plan} deckToo={deckToo} onBack={() => go(3)} onNext={toOutline} />;
    if (hash === 7 || phase === "handoff") return <Making kind="final" rows={rows} palette={palette} handedOff={phase === "handoff"} agentWaiting={agent?.waiting ?? null} />;
    if (hash === 8 || phase === "done") return <Done rows={rows} palette={palette} docToo={docToo} />;

    if (phase === "loading") return <Making kind="plan" rows={[]} />;
    if (phase === "error") return <Broken reason="load" kept={[intake ? "답하신 것" : "", plan ? "기획서" : "", outline ? "뼈대" : ""].filter(Boolean)} onRetry={load} />;
    if (phase === "wait") return <Making kind={wait} rows={confirmedRows} palette={palette} />;
    if (phase === "interview") return <Interview draft={intake || {}} onDone={saveIntake} />;
    if (phase === "plan") return <Plan doc={plan} quote={quote} waiting={!outline} stale={intakeChanged} onBack={() => go(2)} onDoc={() => go(4)} onOutline={outline ? toOutline : undefined} />;
    if ((phase === "outline" || hash === 5) && outline)
      return <OutlineEditor key={outline.rows.length} doc={outline} quote={quote} onBack={() => go(3)}
        onConfirm={async (rs) => {
          // 확정된 뼈대를 다시 보기만 했으면 저장하지 않는다. 바뀌었거나 처음
          // 확정이면 confirmed_at 을 새로 찍는다 — 파이프라인은 이 파일이
          // «바뀌는» 것을 기다린다.
          const untouched = confirmedAt && serializeOutline({ ...outline, rows: rs }) === serializeOutline(outline);
          if (untouched) { location.hash = ""; setPhase("form"); return; }
          const next = metaSet({ ...outline, rows: rs }, "confirmed_at", localStamp());
          await api.savePlanning("outline", { text: serializeOutline(next) });
          setOutline(next); location.hash = ""; setWait("stage"); setPhase("wait"); pollNext(1);
        }} />;

    return (
      <Design rec={rec} cat={cat} state={state} set={set} rows={confirmedRows} stageNum={stageNum}
              onPrimary={onPrimary} error={msg} docToo={docToo} lead={priorNote} busy={busy} agentWaiting={agent?.waiting ?? null} />
    );
  };
  return <StepsCtx.Provider value={{ steps, go }}>{view()}</StepsCtx.Provider>;
}
