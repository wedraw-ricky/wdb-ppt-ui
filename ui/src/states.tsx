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

const PANEL = "var(--wdb-card-bg)";
const LINE = "var(--border)";
const INDIGO = "var(--wdb-secondary)";
const BLUE = "var(--wdb-primary)";
const CYAN = "var(--wdb-cyan)";
const GRAY = "var(--wdb-gray)";

const CYCLE = "3.6s";

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

/** The waiting screen: art, an honest bar, what is being prepared, elapsed. */
export function Deriving({ target }: { target: number }) {
  const reduced = useReducedMotion();
  const what = target === 2 ? "색과 글꼴 후보를 고르는 중"
             : target === 3 ? "이미지 방향을 정리하는 중"
             : "다음 단계를 준비하는 중";
  return (
    <div className="flex flex-col items-center gap-5">
      <WaitingArt animate={!reduced} />
      <div className="flex flex-col items-center gap-2.5">
        <div className="text-[15px] font-bold" style={{ color: "var(--foreground)" }}>
          {target}단계 · {what}
        </div>
        <Sweep animate={!reduced} />
        <Elapsed />
      </div>
      <div className="max-w-[320px] text-center text-[13px] leading-relaxed"
           style={{ color: "var(--muted)" }}>
        고르신 내용을 읽고 다음 단계 후보를 만들고 있습니다. 창을 닫지 마세요.
      </div>
    </div>
  );
}

/** The same stack, settled, with the check that says it is done. */
export function DoneArt() {
  return (
    <svg viewBox="0 0 160 120" className="h-[120px] w-[160px]" role="img"
         aria-label="선택이 저장됨">
      {[0, 1, 2].map((i) => (
        <rect key={i} x="12" y={52 + i * 16} width="88" height="12" rx="2"
              fill={PANEL} stroke={LINE} strokeWidth="1" />
      ))}
      <rect x="12" y="36" width="88" height="12" rx="2" fill={INDIGO} />
      <rect x="12" y="20" width="88" height="12" rx="2" fill={BLUE} />
      <path d="M114 74 L126 86 L148 56" fill="none" stroke={CYAN} strokeWidth="9"
            strokeLinecap="square" strokeLinejoin="miter" />
    </svg>
  );
}
