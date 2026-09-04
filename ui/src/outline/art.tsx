/* Mini slides.

   DESIGN.md's rule for this screen: show the thing being chosen, never a list
   of names. A row that said only `kpi_cards` would ask the reader to imagine
   the page; the drawing is the page. Every layout here is computable geometry,
   so it is drawn rather than fetched — same reasoning as the canvas ratios and
   the narrative-shape diagrams in stage 1. */

const GROUND = "var(--surface)";
const LINE = "var(--border)";
const INK = "var(--wdb-charcoal)";
const BLOCK = "var(--wdb-secondary)";
const ACCENT = "var(--wdb-primary)";

const bar = (x: number, y: number, w: number, h: number, o = 0.28, fill = BLOCK) => (
  <rect x={x} y={y} width={w} height={h} rx={Math.min(2, h / 2)} fill={fill} opacity={o} />
);

/** Title rule every non-cover layout carries. */
const Head = ({ short = false }: { short?: boolean }) => (
  <>
    {bar(12, 12, short ? 52 : 76, 7, 0.82, INK)}
    <line x1="12" y1="25" x2="148" y2="25" stroke={LINE} strokeWidth="1" />
  </>
);

function Body({ shape }: { shape: string }) {
  switch (shape) {
    case "cover":
      return (
        <>
          {bar(14, 30, 96, 11, 0.88, INK)}
          {bar(14, 46, 62, 7, 0.5, INK)}
          {bar(14, 62, 30, 4, 1, ACCENT)}
        </>
      );

    case "kpi_cards":
      return (
        <>
          <Head />
          {[0, 1, 2, 3].map((i) => (
            <g key={i}>
              <rect x={12 + i * 34.5} y={33} width={30} height={30} rx="3"
                    fill={BLOCK} opacity={0.12} />
              {bar(16 + i * 34.5, 39, 18, 9, i === 0 ? 1 : 0.55, i === 0 ? ACCENT : BLOCK)}
              {bar(16 + i * 34.5, 52, 22, 4, 0.3)}
            </g>
          ))}
        </>
      );

    case "numbered_steps":
      return (
        <>
          <Head />
          {[0, 1, 2].map((i) => (
            <g key={i}>
              <circle cx="18" cy={38 + i * 15} r="5.5" fill={BLOCK} opacity={0.55} />
              {bar(29, 34.5 + i * 15, 60 - i * 6, 6, 0.42)}
              {bar(29, 43 + i * 15, 96 - i * 10, 3, 0.2)}
            </g>
          ))}
        </>
      );

    case "comparison_columns":
      return (
        <>
          <Head />
          {[0, 1].map((i) => (
            <g key={i}>
              <rect x={12 + i * 71} y={32} width={65} height={44} rx="3"
                    fill={BLOCK} opacity={i === 0 ? 0.1 : 0.18} />
              {bar(18 + i * 71, 38, 34, 6, i === 1 ? 1 : 0.5, i === 1 ? ACCENT : BLOCK)}
              {bar(18 + i * 71, 50, 52, 3.5, 0.24)}
              {bar(18 + i * 71, 58, 44, 3.5, 0.24)}
              {bar(18 + i * 71, 66, 48, 3.5, 0.24)}
            </g>
          ))}
        </>
      );

    case "vertical_list":
      return (
        <>
          <Head />
          {[0, 1, 2, 3].map((i) => (
            <g key={i}>
              <rect x="12" y={33 + i * 12} width="3" height="9" fill={ACCENT}
                    opacity={i === 0 ? 1 : 0.3} />
              {bar(21, 33 + i * 12, 46, 5, 0.42)}
              {bar(73, 34.5 + i * 12, 72, 3, 0.2)}
            </g>
          ))}
        </>
      );

    case "grouped_bar_chart":
    case "column_chart":
    case "stacked_bar_chart":
      return (
        <>
          <Head />
          <line x1="14" y1="72" x2="148" y2="72" stroke={LINE} strokeWidth="1" />
          {[0, 1, 2, 3].map((g) =>
            [0, 1].map((s) => {
              const h = [22, 30, 17, 26][g] - s * 7;
              return (
                <rect key={`${g}-${s}`} x={20 + g * 32 + s * 11} y={72 - h}
                      width="9" height={h} rx="1"
                      fill={s === 0 ? ACCENT : BLOCK} opacity={s === 0 ? 0.85 : 0.32} />
              );
            }))}
        </>
      );

    case "dumbbell_chart":
      return (
        <>
          <Head />
          {[0, 1, 2, 3].map((i) => {
            const y = 36 + i * 11;
            const x1 = 30 + i * 6;
            const x2 = 96 + i * 9;
            return (
              <g key={i}>
                {bar(12, y - 2, 14, 4, 0.28)}
                <line x1={x1} y1={y} x2={x2} y2={y} stroke={BLOCK} strokeWidth="2" opacity={0.3} />
                <circle cx={x1} cy={y} r="3.5" fill={BLOCK} opacity={0.5} />
                <circle cx={x2} cy={y} r="3.5" fill={ACCENT} />
              </g>
            );
          })}
        </>
      );

    case "pie_chart":
    case "donut_chart":
      return (
        <>
          <Head />
          <circle cx="52" cy="52" r="21" fill={BLOCK} opacity={0.22} />
          <path d="M52 52 L52 31 A21 21 0 0 1 70 62 Z" fill={ACCENT} opacity={0.9} />
          {[0, 1, 2].map((i) => (
            <g key={i}>
              <rect x="92" y={38 + i * 12} width="7" height="7" rx="1.5"
                    fill={i === 0 ? ACCENT : BLOCK} opacity={i === 0 ? 0.9 : 0.35} />
              {bar(104, 39.5 + i * 12, 40 - i * 6, 4, 0.24)}
            </g>
          ))}
        </>
      );

    case "basic_table":
    case "comparison_table":
      return (
        <>
          <Head />
          <rect x="12" y="32" width="136" height="10" fill={BLOCK} opacity={0.22} />
          {[0, 1, 2, 3].map((r) => (
            <line key={r} x1="12" y1={42 + r * 9} x2="148" y2={42 + r * 9}
                  stroke={LINE} strokeWidth="1" />
          ))}
          {[0, 1, 2].map((c) => (
            <line key={c} x1={12 + (c + 1) * 34} y1="32" x2={12 + (c + 1) * 34} y2="69"
                  stroke={LINE} strokeWidth="1" />
          ))}
          {[0, 1, 2, 3].map((r) =>
            [0, 1, 2, 3].map((c) => bar(17 + c * 34, 45.5 + r * 9, 20, 3, 0.2)))}
        </>
      );

    case "timeline":
    case "process_flow":
      return (
        <>
          <Head />
          <line x1="14" y1="52" x2="146" y2="52" stroke={BLOCK} strokeWidth="2" opacity={0.28} />
          {[0, 1, 2, 3].map((i) => (
            <g key={i}>
              <circle cx={24 + i * 36} cy="52" r="4.5" fill={i === 0 ? ACCENT : BLOCK}
                      opacity={i === 0 ? 1 : 0.45} />
              {bar(14 + i * 36, 36, 26, 5, 0.35)}
              {bar(14 + i * 36, 62, 20, 3, 0.2)}
            </g>
          ))}
        </>
      );

    case "body":
      return (
        <>
          <Head />
          {bar(12, 34, 112, 5, 0.4)}
          {[0, 1, 2, 3].map((i) => bar(12, 46 + i * 8, i === 3 ? 74 : 136, 3.5, 0.2))}
        </>
      );

    default:
      /* Any other chart in the library: say "a chart goes here" honestly
         rather than drawing a shape the pipeline will not produce. */
      return (
        <>
          <Head />
          <line x1="14" y1="72" x2="148" y2="72" stroke={LINE} strokeWidth="1" />
          {[26, 40, 32, 52, 44].map((h, i) => (
            <rect key={i} x={20 + i * 26} y={72 - h} width="16" height={h} rx="1"
                  fill={i === 3 ? ACCENT : BLOCK} opacity={i === 3 ? 0.85 : 0.3} />
          ))}
        </>
      );
  }
}

export function SlideArt({ shape, className = "" }: { shape: string; className?: string }) {
  return (
    <svg viewBox="0 0 160 90" className={className} aria-hidden="true"
         style={{ display: "block", width: "100%", height: "auto" }}>
      <rect x="0.5" y="0.5" width="159" height="89" rx="3"
            fill={GROUND} stroke={LINE} strokeWidth="1" />
      <Body shape={shape} />
    </svg>
  );
}
