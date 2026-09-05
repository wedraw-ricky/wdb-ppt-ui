/* Waiting and finished states.

   Drawn, not generated. DESIGN.md's own rule — "draw it if it can be computed"
   — applies: inline SVG inherits the colour tokens (so a palette change follows
   automatically), stays flat by construction where a generated illustration kept
   coming back isometric, and costs about a kilobyte instead of a megabyte.

   The waiting screen shows no percentage. The agent's work is not instrumented,
   so any number would be invented. What it shows instead is true: an
   indeterminate bar (something is running), an elapsed counter (it is still
   running), and the name of the stage being prepared. */

import { useEffect, useState } from "react";
import * as api from "./api";
import { T } from "./i18n";
import doneArt from "./art/done.png";
import errorArt from "./art/error.png";
import loadingArt from "./art/loading.png";

const PANEL = "var(--wdb-card-bg)";
const LINE = "var(--border)";
const INDIGO = "var(--wdb-secondary)";
const BLUE = "var(--wdb-primary)";
const CYAN = "var(--wdb-cyan)";
const GRAY = "var(--wdb-gray)";

const CYCLE = "3.6s";

// Often enough that a note lands while the person is still looking at the
// step before it; rare enough to be invisible next to the 1s stage poll.
const PROGRESS_POLL_MS = 2_000;

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduced(m.matches);
    on();
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return reduced;
}

/** Seconds since mount. The only honest progress signal available: it proves
    the page is live without claiming to know how much work is left. */
function Elapsed() {
  const [s, setS] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setS((v) => v + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const mm = Math.floor(s / 60), ss = s % 60;
  return (
    <span className="tabular-nums text-[13px]" style={{ color: "var(--muted)" }}>
      {mm}:{String(ss).padStart(2, "0")} 경과
    </span>
  );
}

/** Indeterminate bar. A band sweeps the track; it never claims a percentage. */
function Sweep({ animate }: { animate: boolean }) {
  return (
    <div className="h-1.5 w-[260px] overflow-hidden rounded-full"
         style={{ background: "var(--border)" }}>
      <div className={animate ? "wdb-sweep h-full w-2/5 rounded-full" : "h-full w-full rounded-full"}
           style={{ background: `linear-gradient(90deg, ${INDIGO}, ${BLUE}, ${CYAN})` }} />
    </div>
  );
}

/** A page being composed: the title rules in, body lines fill, the image lands,
    then the palette is swatched — the order the work actually happens in. */
export function WaitingArt({ animate = true }: { animate?: boolean }) {
  const A = (props: Record<string, string>) =>
    animate ? <animate dur={CYCLE} repeatCount="indefinite" {...props} /> : null;

  return (
    <svg viewBox="0 0 220 132" className="h-[132px] w-[220px]" role="img"
         aria-label="다음 단계를 준비하는 중">
      <rect x="14" y="10" width="192" height="108" rx="5"
            fill={PANEL} stroke={LINE} strokeWidth="1" />

      <g>
        {/* the whole composition clears before the next pass, so nothing snaps */}
        {A({ attributeName: "opacity", values: "1;1;0;0",
             keyTimes: "0;0.90;0.97;1" })}

        <rect x="28" y="26" height="11" rx="2" fill={INDIGO} width={animate ? 0 : 74}>
          {A({ attributeName: "width", values: "0;0;74;74;74",
               keyTimes: "0;0.04;0.20;0.9;1", calcMode: "spline",
               keySplines: "0.4 0 0.2 1;0.4 0 0.2 1;0 0 1 1;0 0 1 1" })}
        </rect>

        <rect x="28" y="46" height="6" rx="2" fill={GRAY} opacity="0.35" width={animate ? 0 : 66}>
          {A({ attributeName: "width", values: "0;0;66;66;66",
               keyTimes: "0;0.20;0.34;0.9;1", calcMode: "spline",
               keySplines: "0 0 1 1;0.4 0 0.2 1;0 0 1 1;0 0 1 1" })}
        </rect>
        <rect x="28" y="58" height="6" rx="2" fill={GRAY} opacity="0.35" width={animate ? 0 : 50}>
          {A({ attributeName: "width", values: "0;0;50;50;50",
               keyTimes: "0;0.26;0.40;0.9;1", calcMode: "spline",
               keySplines: "0 0 1 1;0.4 0 0.2 1;0 0 1 1;0 0 1 1" })}
        </rect>

        <rect x="124" y="26" width="68" height="50" rx="3" fill={BLUE}
              opacity={animate ? 0 : 1}>
          {A({ attributeName: "opacity", values: "0;0;1;1;1",
               keyTimes: "0;0.42;0.56;0.9;1" })}
        </rect>

        {/* the palette, swatched one at a time */}
        {[INDIGO, BLUE, CYAN, GRAY].map((c, i) => (
          <rect key={i} x={28 + i * 17} y="90" width="13" height="13" rx="2" fill={c}
                opacity={animate ? 0 : 1}>
            {A({ attributeName: "opacity", values: "0;0;1;1;1",
                 keyTimes: `0;${(0.58 + i * 0.06).toFixed(2)};${(0.66 + i * 0.06).toFixed(2)};0.9;1` })}
          </rect>
        ))}
      </g>
    </svg>
  );
}

/** What the agent has actually done since this wait began.

    A stage label alone stops reading as movement within about half a minute —
    the elapsed counter proves the page is alive, but not that the *work* is.
    These are the agent's own notes, and they are strictly a record: the last
    one is what is happening now, the ones above it already finished. Nothing
    counts what is left, because nothing here knows. */
function useProgress(): string[] {
  const [notes, setNotes] = useState<string[]>([]);
  useEffect(() => {
    const startedAt = Date.now();
    let stopped = false;
    async function read() {
      const all = await api.progressNotes();
      if (stopped) return;
      // Only notes from this wait. An older one would describe work that
      // finished before the person even got here.
      const waited = (Date.now() - startedAt) / 1000 + 2;
      setNotes(all.filter((n) => n.age_seconds <= waited).map((n) => n.note));
    }
    read();
    const id = setInterval(read, PROGRESS_POLL_MS);
    return () => { stopped = true; clearInterval(id); };
  }, []);
  return notes;
}

function ProgressTrail({ notes }: { notes: string[] }) {
  if (notes.length === 0) return null;
  const last = notes.length - 1;
  return (
    <ul className="flex w-[320px] flex-col gap-1.5" aria-live="polite">
      {notes.map((note, i) => (
        <li key={`${i}-${note}`} className="flex items-baseline gap-2 text-[13px]"
            style={{ color: i === last ? "var(--foreground)" : "var(--muted)",
                     fontWeight: i === last ? 600 : 400 }}>
          <span aria-hidden="true" style={{ color: i === last ? CYAN : GRAY }}>
            {i === last ? "▸" : "✓"}
          </span>
          <span className="min-w-0 flex-1">{note}</span>
        </li>
      ))}
    </ul>
  );
}

/** The waiting screen: art, an honest bar, what is being prepared, elapsed. */
export function Deriving({ target }: { target: number }) {
  const reduced = useReducedMotion();
  const notes = useProgress();
  const what = target === 0 ? "자료를 읽고 기획 뼈대를 짜는 중"
             : target === 2 ? "색과 글꼴 후보를 고르는 중"
             : target === 3 ? "이미지 방향을 정리하는 중"
             : "다음 단계를 준비하는 중";
  return (
    <div className="grid h-full place-items-center px-8">
      <div className="flex flex-col items-center gap-5">
      <WaitingArt animate={!reduced} />
      <div className="flex flex-col items-center gap-2.5">
        <div className="text-[15px] font-bold" style={{ color: "var(--foreground)" }}>
          {target === 0 ? "기획" : `${target}단계`} · {what}
        </div>
        <Sweep animate={!reduced} />
        <Elapsed />
      </div>
      <ProgressTrail notes={notes} />
      <div className="max-w-[380px] text-center text-[13px] leading-relaxed"
           style={{ color: "var(--muted)" }}>
        {/* Once the trail is running it already says what is happening; repeating
            it here just pushes the one instruction that matters further down. */}
        {notes.length > 0
          ? "창을 닫지 마세요."
          : "고르신 내용을 읽고 다음 단계 후보를 만들고 있습니다. 창을 닫지 마세요."}
      </div>
      </div>
    </div>
  );
}

/** The same stack, settled, with the check that says it is done. */
/* 상태 그림 셋. 예전에는 <rect> 를 쌓아 만들었는데, 그건 그린 게 아니라
   자리만 잡아둔 티가 나서 오히려 "기계가 만든 화면" 으로 읽혔다. 세 장을 한
   세트로 그려 붙인다 — 같은 장 더미, 같은 선 굵기, 같은 정면 시점.
   글자를 대신하는 그림이 아니라 옆의 문장을 거드는 그림이라 alt 는 비운다. */
function StateArt({ src }: { src: string }) {
  return <img src={src} alt="" className="h-[132px] w-auto" draggable={false} />;
}

export function LoadingArt() { return <StateArt src={loadingArt} />; }
export function ErrorArt() { return <StateArt src={errorArt} />; }
export function DoneArt() { return <StateArt src={doneArt} />; }

/** Says the server went away — the one thing this screen cannot recover from
    on its own. It stays a banner rather than a blocking overlay because the
    choices already made are still on screen and still readable; the person
    reopens the page from chat and finds the same questions waiting. */
export function Disconnected() {
  return (
    <div role="status"
         className="fixed inset-x-0 top-0 z-50 flex flex-wrap items-baseline justify-center gap-x-3 gap-y-1 px-4 py-2.5 text-center"
         style={{ background: "var(--ink)", color: "var(--ink-on-accent)" }}>
      <span className="text-[13px] font-bold">{T.offlineTitle}</span>
      <span className="text-[13px]" style={{ opacity: 0.82 }}>{T.offlineHint}</span>
      <span className="text-[12px]" style={{ opacity: 0.6 }}>{T.offlineRetry}</span>
    </div>
  );
}
