/* 장 축소판과 무대. DESIGN.md 컨셉 ①②③.

   축소판은 늘 16:9 다. 표지는 흰 바탕에 남색 판 62%, 간지는 남색에 흰 테 한
   줄. 둘 다 남색 무대 위에서도 흰 띠 위에서도 보인다. 본문 장은 outline/art.tsx
   의 SlideArt 가 도형으로 그린다 (고를 수 있는 모양은 모두 그려진다).

   무대는 30% 의 자리다. 색을 고르면 무대와 그 위의 장이 그 색으로 다시
   칠해진다 — CSS 변수 셋을 무대 안에서만 덮어쓴다. 그래서 «고른 색이 화면을
   칠한다» 는 규칙이 코드에서도 한 줄이다. */

import type React from "react";
import type { Row } from "./outline/model";
import { SlideArt } from "./outline/art";

export interface Palette {
  primary?: string; accent?: string; background?: string; [k: string]: string | undefined;
}

export function Thumb({ row, n, cur = false, painted = true }: { row: Row; n?: number; cur?: boolean; painted?: boolean }) {
  const num = n ?? row.n;
  const c = cur ? " cur" : "";
  if (row.role === "cover" || row.role === "closing")
    return <div className={`sl cover${c}`}><i className="rule" /><i className="ttl" /><span className="num">{num}</span></div>;
  if (row.role === "chapter")
    return <div className={`sl chapter${c}`}><i className="rule" /><i className="ttl" /><span className="num">{num}</span></div>;
  return (
    <div className={`sl${c}`} style={painted ? undefined : { ["--wdb-secondary" as any]: "var(--line-strong)", ["--wdb-primary" as any]: "var(--line-strong)" }}>
      <SlideArt shape={row.shape || "body"} image={row.image || "none"} />
      <span className="num">{num}</span>
    </div>
  );
}

export const Ghost = ({ n }: { n: number }) => <div className="sl ghost"><span className="num">{n}</span></div>;
export const Stop = ({ n, label = "여기서 멈춤" }: { n: number; label?: string }) =>
  <div className="sl ghost stop"><span className="num" style={{ textAlign: "center", lineHeight: 1.3 }}>{n}<br /><small>{label}</small></span></div>;

/** 남색 무대. 팔레트를 주면 그 색으로 칠해진다. */
export function Stage({ palette, cols = 7, children, style }: {
  palette?: Palette | null; cols?: number; children: React.ReactNode; style?: React.CSSProperties;
}) {
  const vars: Record<string, string> = {};
  if (palette?.primary) { vars["--stage-bg"] = palette.primary; vars["--wdb-secondary"] = palette.primary; }
  if (palette?.accent) vars["--wdb-primary"] = palette.accent;
  return (
    <div className="stage" style={{ gridTemplateColumns: cols ? `repeat(${cols}, 1fr)` : "1fr", ...(vars as any), ...style }}>
      {children}
    </div>
  );
}

/* ---- 파트로 묶기 --------------------------------------------------------------- */
export interface Part { label: string; rows: Row[]; head: boolean; }

/** 15장을 넘으면 파트가 단위다. 간지(role=chapter) 줄이 파트를 연다.
    간지 앞의 장(표지)과 닫는 장은 제 줄을 갖는다. */
export function parts(rows: Row[]): Part[] {
  const out: Part[] = [];
  let cur: Part | null = null;
  rows.forEach((r) => {
    if (r.role === "chapter") { cur = { label: r.title || `${out.length + 1}부`, rows: [r], head: true }; out.push(cur); return; }
    if (r.role === "closing") { out.push({ label: "닫는 장", rows: [r], head: false }); cur = null; return; }
    if (!cur) { cur = { label: r.role === "cover" ? "표지" : "", rows: [r], head: false }; out.push(cur); return; }
    cur.rows.push(r);
  });
  return out;
}
export const isLong = (rows: Row[]) => rows.length > 15 && rows.some((r) => r.role === "chapter");

/** 스토리보드. done 을 주면 그 번호까지만 그려지고 나머지는 빈 칸,
    stop 을 주면 그 장이 주황 테. cur 는 지금 보는 장. */
export function Storyboard({ rows, palette, done, stop, cur }: {
  rows: Row[]; palette?: Palette | null; done?: number; stop?: number; cur?: number;
}) {
  const cell = (r: Row, i: number) => {
    const n = i + 1;
    if (stop && n === stop) return <Stop key={n} n={n} />;
    if (done !== undefined && n > done) return <Ghost key={n} n={n} />;
    return <Thumb key={n} row={r} n={n} cur={cur === n} />;
  };
  if (!isLong(rows))
    return <Stage palette={palette} cols={Math.min(8, Math.max(4, rows.length))}>{rows.map(cell)}</Stage>;
  let k = 0;
  return (
    <Stage palette={palette} cols={0} style={{ gap: 10 }}>
      {parts(rows).map((p, pi) => {
        const start = k; k += p.rows.length;
        return (
          <div key={pi} className={`board-row${p.head ? "" : ""}`}>
            <div className={`rl${p.head ? "" : ""}`}>{p.label}{p.rows.length > 1 ? <small> {p.rows.length}장</small> : null}</div>
            <div className="grid" style={{ gridTemplateColumns: "repeat(9, 1fr)", gap: 8, flex: 1 }}>
              {p.rows.map((r, j) => cell(r, start + j))}
            </div>
          </div>
        );
      })}
    </Stage>
  );
}

/** 66장 같은 긴 자료의 리듬. 남색 칸이 간지, 골드 테가 지금 장. */
export function Ribbon({ rows, cur }: { rows: Row[]; cur?: number }) {
  return (
    <div className="ribbon">
      {rows.map((r, i) => {
        const n = i + 1;
        const cls = [r.role === "chapter" ? "g" : "", cur === n ? "cur" : ""].join(" ").trim();
        return <i key={n} className={cls} title={`${n} ${r.title}`} />;
      })}
    </div>
  );
}
