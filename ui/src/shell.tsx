/* 화면 뼈대. DESIGN.md «배치 · 구역 일곱».

   머리띠(기획·문서·발표 + 지금 단계 + 골드 진행 막대) · 왼쪽 본문(제목, 부제,
   판들) · 오른쪽 곁 380(디자이너 포스트잇이 맨 위, 그 아래 근거와 검사) ·
   고정 바닥(왼쪽 한 줄 안내, 오른쪽 둘째·첫째 버튼). 왼쪽 패널은 없다.

   모든 화면이 이 하나를 쓴다. 알리는 화면(만드는 중, 멈췄을 때)도 같은
   머리띠와 바닥 안에 있어야 다른 물건처럼 보이지 않는다. */

import type React from "react";
import { Say } from "../system/patterns";

export type Band = "기획" | "문서" | "발표";
const BANDS: Band[] = ["기획", "문서", "발표"];

export interface Action {
  label: string;
  kind?: "pri" | "" | "ghost";
  onClick?: () => void;
  disabled?: boolean;
}

export function Shell({ band, step, pct, title, sub, say, side, children, footNote, actions, error }: {
  band: Band;
  /** «2 · 인터뷰» 처럼 지금 어디인지 한 줄. */
  step: string;
  /** 진행 막대 0~100. */
  pct: number;
  title: string;
  sub?: React.ReactNode;
  /** 디자이너의 긴 말. 곁 맨 위 포스트잇. */
  say?: React.ReactNode;
  /** 곁의 나머지 판들. */
  side?: React.ReactNode;
  children: React.ReactNode;
  footNote?: React.ReactNode;
  actions?: Action[];
  error?: string;
}) {
  return (
    <div className="scr">
      <header className="top">
        <div className="logo"><i />PPT 만들기</div>
        <div className="bands">{BANDS.map((b) => <span key={b} className={b === band ? "on" : ""}>{b}</span>)}</div>
        <div className="step">{step}</div>
        <div className="prog" aria-label={`진행 ${pct}%`}><i style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} /></div>
      </header>
      <main className="body">
        <div className="cols">
          <div className="stack">
            <div><h1>{title}</h1>{sub ? <div className="sub">{sub}</div> : null}</div>
            {children}
          </div>
          <aside className="side">
            {say ? <Say>{say}</Say> : null}
            {side}
          </aside>
        </div>
      </main>
      <footer className="foot">
        <span>{footNote}</span>
        <span className="sp" />
        {error ? <span className="err">{error}</span> : null}
        {(actions || []).map((a) => (
          <button key={a.label} type="button" className={`btn ${a.kind || ""}`} onClick={a.onClick} disabled={a.disabled}>
            {a.label}
          </button>
        ))}
      </footer>
    </div>
  );
}
