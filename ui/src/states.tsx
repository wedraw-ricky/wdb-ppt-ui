/* Waiting and finished states.

   Drawn, not generated. DESIGN.md's own rule — "draw it if it can be computed"
   — applies: these are a few rectangles and a check. Inline SVG inherits the
   colour tokens (so a palette change follows automatically), stays flat by
   construction where a generated illustration kept coming back isometric, and
   costs about a kilobyte instead of a megabyte. */

const PANEL = "var(--wdb-card-bg)";
const LINE = "var(--border)";
const INDIGO = "var(--wdb-secondary)";
const BLUE = "var(--wdb-primary)";
const CYAN = "var(--wdb-cyan)";

/** A settled stack of slides; the top sheet drifts while work is in flight. */
export function WaitingArt({ animate = true }: { animate?: boolean }) {
  return (
    <svg viewBox="0 0 160 120" className="h-[120px] w-[160px]" role="img"
         aria-label="다음 단계를 준비하는 중">
      {[0, 1, 2].map((i) => (
        <rect key={i} x="28" y={62 + i * 16} width="104" height="12" rx="2"
              fill={PANEL} stroke={LINE} strokeWidth="1" />
      ))}
      <rect x="28" y="46" width="104" height="12" rx="2" fill={INDIGO} />
      <g>
        <rect x="40" y="16" width="80" height="20" rx="2" fill={BLUE} />
        {animate ? (
          <animateTransform attributeName="transform" type="translate"
                            values="0 0; 0 8; 0 0" dur="1.8s" repeatCount="indefinite"
                            calcMode="spline" keySplines="0.4 0 0.2 1; 0.4 0 0.2 1"
                            keyTimes="0; 0.5; 1" />
        ) : null}
      </g>
      <rect x="128" y="20" width="10" height="10" fill={CYAN} />
    </svg>
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
