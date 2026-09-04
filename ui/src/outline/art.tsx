/* Mini slides.

   DESIGN.md's rule for this screen: show the thing being chosen, never a list
   of names. A row that said only `kpi_cards` would ask the reader to imagine
   the page; the drawing is the page. Every layout here is computable geometry,
   so it is drawn rather than fetched — same reasoning as the canvas ratios and
   the narrative-shape diagrams in stage 1.

   그림 한 장만 예외다. "여기에 사진이 온다" 는 도형으로 그릴 수 있는 게 아니라
   사진으로 보여줘야 하는 것이라, 자리 표시용 사진 한 장을 넣어 잘라 쓴다.
   레이아웃 자체는 여전히 전부 도형이다. */

import photoArt from "../art/photo.png";

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

    case "agenda_list":
      return (
        <>
          <Head short />
          {[0, 1, 2, 3, 4].map((i) => (
            <g key={i}>
              <circle cx="17" cy={36 + i * 11} r="4.5" fill={ACCENT}
                      opacity={i === 0 ? 1 : 0.28} />
              {bar(27, 33 + i * 11, 40 + (i % 3) * 22, 5, 0.4)}
            </g>
          ))}
        </>
      );

    case "labeled_card":
      return (
        <>
          <Head />
          {[0, 1, 2].map((i) => (
            <g key={i}>
              <rect x={12 + i * 46} y="32" width="42" height="46" rx="3"
                    fill={BLOCK} opacity="0.08" />
              {bar(16 + i * 46, 36, 22, 5, 0.65, INK)}
              {bar(16 + i * 46, 46, 34, 3, 0.26)}
              {bar(16 + i * 46, 53, 28, 3, 0.26)}
              {bar(16 + i * 46, 60, 31, 3, 0.26)}
            </g>
          ))}
        </>
      );

    case "pros_cons_chart":
      return (
        <>
          <Head />
          {[0, 1].map((c) => (
            <g key={c}>
              <rect x={12 + c * 70} y="32" width="66" height="46" rx="3"
                    fill={c ? "#E11D48" : "#059669"} opacity="0.09" />
              {bar(17 + c * 70, 36, 24, 5, 0.7, c ? "#E11D48" : "#059669")}
              {[0, 1, 2].map((i) => bar(17 + c * 70, 48 + i * 9, 50, 3, 0.3))}
            </g>
          ))}
        </>
      );

    case "vertical_pillars":
      return (
        <>
          <Head />
          {[0, 1, 2].map((i) => (
            <g key={i}>
              <rect x={14 + i * 45} y="31" width="38" height="48" rx="3"
                    fill={ACCENT} opacity={0.1 + i * 0.06} />
              {bar(19 + i * 45, 35, 20, 5, 0.7, INK)}
              {[0, 1, 2].map((k) => bar(19 + i * 45, 47 + k * 8, 28, 3, 0.28))}
            </g>
          ))}
        </>
      );

    case "icon_grid":
      return (
        <>
          <Head />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <g key={i}>
              <rect x={13 + (i % 3) * 46} y={32 + Math.floor(i / 3) * 24}
                    width="42" height="20" rx="3" fill={BLOCK} opacity="0.09" />
              <circle cx={20 + (i % 3) * 46} cy={42 + Math.floor(i / 3) * 24} r="4"
                      fill={ACCENT} opacity="0.55" />
              {bar(28 + (i % 3) * 46, 40 + Math.floor(i / 3) * 24, 22, 4, 0.32)}
            </g>
          ))}
        </>
      );

    case "matrix_2x2":
      return (
        <>
          <Head short />
          <line x1="80" y1="30" x2="80" y2="80" stroke={LINE} strokeWidth="1" />
          <line x1="14" y1="55" x2="146" y2="55" stroke={LINE} strokeWidth="1" />
          <circle cx="52" cy="42" r="6" fill={ACCENT} opacity="0.5" />
          <circle cx="108" cy="40" r="9" fill={ACCENT} opacity="0.85" />
          <circle cx="44" cy="68" r="4" fill={BLOCK} opacity="0.34" />
          <circle cx="116" cy="68" r="5.5" fill={BLOCK} opacity="0.34" />
        </>
      );

    case "quadrant_text_bullets":
      return (
        <>
          <Head short />
          {[0, 1, 2, 3].map((i) => (
            <g key={i}>
              <rect x={13 + (i % 2) * 67} y={31 + Math.floor(i / 2) * 25}
                    width="64" height="22" rx="3" fill={BLOCK}
                    opacity={i % 3 === 0 ? 0.13 : 0.07} />
              {bar(17 + (i % 2) * 67, 35 + Math.floor(i / 2) * 25, 18, 4, 0.65, INK)}
              {bar(17 + (i % 2) * 67, 43 + Math.floor(i / 2) * 25, 44, 3, 0.26)}
              {bar(17 + (i % 2) * 67, 48 + Math.floor(i / 2) * 25, 36, 3, 0.26)}
            </g>
          ))}
        </>
      );

    case "progress_bar_chart":
      return (
        <>
          <Head />
          {[72, 45, 88, 30].map((pct, i) => (
            <g key={i}>
              {bar(12, 34 + i * 12, 30, 5, 0.4)}
              <rect x="48" y={34 + i * 12} width="96" height="5" rx="2.5"
                    fill={BLOCK} opacity="0.12" />
              <rect x="48" y={34 + i * 12} width={96 * pct / 100} height="5" rx="2.5"
                    fill={ACCENT} opacity="0.75" />
            </g>
          ))}
        </>
      );

    case "gauge_chart":
      return (
        <>
          <Head short />
          <path d="M46 70 A34 34 0 0 1 114 70" fill="none" stroke={BLOCK}
                strokeWidth="9" opacity="0.14" strokeLinecap="round" />
          <path d="M46 70 A34 34 0 0 1 104 46" fill="none" stroke={ACCENT}
                strokeWidth="9" opacity="0.85" strokeLinecap="round" />
          {bar(66, 58, 28, 9, 0.85, INK)}
        </>
      );

    case "line_chart":
      return (
        <>
          <Head short />
          <line x1="16" y1="76" x2="146" y2="76" stroke={LINE} strokeWidth="1" />
          <polyline points="20,68 44,58 68,62 92,44 116,48 140,34" fill="none"
                    stroke={ACCENT} strokeWidth="2.4" opacity="0.9"
                    strokeLinejoin="round" strokeLinecap="round" />
          <polyline points="20,72 44,70 68,66 92,64 116,58 140,56" fill="none"
                    stroke={BLOCK} strokeWidth="1.8" opacity="0.3"
                    strokeLinejoin="round" strokeLinecap="round" />
        </>
      );

    case "waterfall_chart":
      return (
        <>
          <Head short />
          <line x1="16" y1="76" x2="146" y2="76" stroke={LINE} strokeWidth="1" />
          {[[20, 52, 24], [46, 44, 8], [72, 38, 6], [98, 44, 6], [124, 38, 38]]
            .map(([x, y, h], i) => (
              <rect key={i} x={x} y={y} width="20" height={h} rx="1.5"
                    fill={i === 0 || i === 4 ? ACCENT : BLOCK}
                    opacity={i === 0 || i === 4 ? 0.75 : 0.3} />
            ))}
        </>
      );

    case "consulting_table":
      return (
        <>
          <Head />
          <line x1="12" y1="40" x2="148" y2="40" stroke={LINE} strokeWidth="1.4" />
          {[0, 1, 2, 3].map((r) => (
            <g key={r}>
              {bar(12, 45 + r * 9, 34, 4, 0.42)}
              {bar(52, 45 + r * 9, 20, 4, 0.24)}
              <rect x="80" y={45 + r * 9} width="60" height="4" rx="2"
                    fill={BLOCK} opacity="0.12" />
              <rect x="80" y={45 + r * 9} width={[46, 28, 54, 34][r]} height="4" rx="2"
                    fill={ACCENT} opacity="0.7" />
            </g>
          ))}
        </>
      );

    case "chevron_process":
      return (
        <>
          <Head short />
          {[0, 1, 2, 3].map((i) => (
            <g key={i}>
              <path d={`M${14 + i * 34} 38 h26 l7 9 -7 9 h-26 l7 -9 z`}
                    fill={ACCENT} opacity={0.22 + i * 0.2} />
              {bar(16 + i * 34, 62, 24, 3, 0.26)}
              {bar(16 + i * 34, 68, 18, 3, 0.26)}
            </g>
          ))}
        </>
      );

    case "journey_map":
      return (
        <>
          <Head short />
          {[0, 1, 2, 3].map((i) => (
            <g key={i}>
              {bar(14 + i * 34, 32, 24, 4, 0.6, INK)}
              <rect x={14 + i * 34} y="40" width="28" height="12" rx="2"
                    fill={BLOCK} opacity="0.1" />
            </g>
          ))}
          <polyline points="26,68 60,60 94,72 128,58" fill="none" stroke={ACCENT}
                    strokeWidth="2.2" opacity="0.85" strokeLinejoin="round" />
          {[[26, 68], [60, 60], [94, 72], [128, 58]].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="3.4" fill={ACCENT} opacity="0.9" />
          ))}
        </>
      );

    case "hub_spoke":
      return (
        <>
          <Head short />
          {[[46, 40], [114, 40], [46, 70], [114, 70]].map(([x, y], i) => (
            <g key={i}>
              <line x1="80" y1="55" x2={x} y2={y} stroke={LINE} strokeWidth="1.2" />
              <circle cx={x} cy={y} r="7.5" fill={BLOCK} opacity="0.24" />
            </g>
          ))}
          <circle cx="80" cy="55" r="13" fill={ACCENT} opacity="0.8" />
        </>
      );

    case "layered_architecture":
      return (
        <>
          <Head short />
          {[0, 1, 2].map((i) => (
            <g key={i}>
              <rect x="20" y={34 + i * 16} width="120" height="13" rx="2.5"
                    fill={ACCENT} opacity={0.5 - i * 0.14} />
              {[0, 1, 2].map((k) => (
                <rect key={k} x={28 + k * 38} y={37 + i * 16} width="30" height="7"
                      rx="1.5" fill={GROUND} opacity="0.55" />
              ))}
            </g>
          ))}
        </>
      );

    case "pyramid_chart":
      return (
        <>
          <Head short />
          {[0, 1, 2].map((i) => (
            <path key={i}
                  d={`M${80 - 18 - i * 20} ${40 + i * 14} h${36 + i * 40} l-8 12 h${-(20 + i * 40)} z`}
                  fill={ACCENT} opacity={0.85 - i * 0.24} />
          ))}
        </>
      );

    case "venn_diagram":
      return (
        <>
          <Head short />
          <circle cx="64" cy="56" r="22" fill={ACCENT} opacity="0.32" />
          <circle cx="96" cy="56" r="22" fill={BLOCK} opacity="0.3" />
          <ellipse cx="80" cy="56" rx="8" ry="18" fill={ACCENT} opacity="0.55" />
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

/** 사진이 지면을 어떻게 차지하는가. 이름을 읽는 대신 자리를 보게 한다 —
    "전면" 이라고 적어두면 읽는 사람이 상상해야 하지만, 그려두면 그냥 보인다.
    사선 빗금은 "여기에 사진이 온다" 는 표시다. 실제 사진은 Step 5 에서 붙는다. */
function ImageArea({ use }: { use: string }) {
  if (use === "none") return null;
  // 예전에는 빗금이었다. 빗금은 "여기에 뭔가 온다" 까지만 말하고 무엇이 오는지는
  // 보는 사람이 상상해야 해서, 세 배치의 차이가 잘 안 느껴졌다. 사진 한 장을
  // 자리마다 다르게 잘라 보여주면 전면·옆에·겹침이 한눈에 갈린다.
  const photo = (x: number, y: number, w: number, h: number, id: string) => (
    <>
      <defs>
        <clipPath id={id}>
          <rect x={x} y={y} width={w} height={h} rx="3" />
        </clipPath>
      </defs>
      <image href={photoArt} x={x} y={y} width={w} height={h}
             preserveAspectRatio="xMidYMid slice" clipPath={`url(#${id})`} />
    </>
  );
  if (use === "full") {
    // 사진이 지면을 꽉 채우고, 글이 읽히도록 그 위에 어두운 막을 깐다.
    return (
      <>
        {photo(1, 1, 158, 88, "wdb-photo-full")}
        <rect x="1" y="1" width="158" height="88" rx="3" fill={INK} opacity="0.42" />
      </>
    );
  }
  if (use === "side") return photo(100, 1, 59, 88, "wdb-photo-side");
  return photo(86, 14, 66, 62, "wdb-photo-over");
}

export function SlideArt({ shape, image = "none", className = "" }: {
  shape: string; image?: string; className?: string;
}) {
  const onPhoto = image === "full";
  return (
    <svg viewBox="0 0 160 90" className={className} aria-hidden="true"
         style={{ display: "block", width: "100%", height: "auto" }}>
      <rect x="0.5" y="0.5" width="159" height="89" rx="3"
            fill={GROUND} stroke={LINE} strokeWidth="1" />
      <ImageArea use={image} />
      {/* 전면 사진 위에서는 글이 흰색이라야 읽힌다 — 실제 장에서도 그렇다. */}
      <g style={onPhoto ? { filter: "invert(1) brightness(2)" } : undefined}>
        <Body shape={shape} />
      </g>
    </svg>
  );
}
