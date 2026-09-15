/* 패턴. 토큰은 «무슨 값», 부품(pick.tsx)은 «무엇을 놓는가», 여기는 «어떻게
   짜는가». DESIGN.md «배치 · 구역 일곱» 과 «부품» 을 코드로 옮긴 것이다.

   화면은 네 가지 짜임 중 하나다.

   ① 묻는 화면 — 인터뷰, 디자인. 번호 붙은 대주제(<Q>) 아래 칩과 카드.
      답은 미리 채워져 있고, 확실·짐작·모름 꼬리표(<Conf>)가 붙는다.
      디자이너가 짧게 말하거나 하나 더 물을 때는 대주제 오른쪽 300 칸의
      포스트잇(<Q note>)이다.
   ② 다루는 화면 — 기획서, 뼈대, 완성. 결과물 판(<Panel kind="out">)이 제일
      크고, 고르면 결과물이 바뀐다. 고치는 서랍은 곁(오른쪽 380)에 있다.
   ③ 알리는 화면 — 만드는 중, 멈췄을 때. 무엇을 했고 무엇이 남았는지만.
      몇 % 는 적지 않는다. 재는 게 없다.
   ④ 비었을 때 — 목록이 비면 <Empty> 가 왜 비었는지 말한다. 빈 격자를 그냥
      두면 고장인지 원래 그런지 모른다.

   어느 짜임이든 디자이너의 긴 말은 곁 맨 위의 포스트잇(<Say>)이고, 본문 위에
   세로로 놓지 않는다. 본문을 밀어내지 않기 위해서다. */

import type React from "react";

/* ---- 판 ------------------------------------------------------------------ */
/** 흰 판. kind: "" 보통 · "out" 결과물(같은 흰 판, 이름으로 구분) ·
    "warn" 걸린 것(주황 물) · "memo" 인수인계·메모(남색 물). */
export function Panel({ label, kind = "", children, style }: {
  label: React.ReactNode; kind?: "" | "out" | "warn" | "memo";
  children: React.ReactNode; style?: React.CSSProperties;
}) {
  return (
    <section className={`panel ${kind}`} style={style}>
      <div className="ph">{label}</div>
      {children}
    </section>
  );
}

/* ---- 디자이너 말 ---------------------------------------------------------- */
/** 포스트잇. 곁 맨 위(긴 말)에는 그대로, 대주제 옆(짧은 말)에는 mini. */
export function Say({ children, mini = false, when = "방금" }: {
  children: React.ReactNode; mini?: boolean; when?: string;
}) {
  return (
    <aside className={`say${mini ? " mini" : ""}`}>
      <div className="who"><i>디</i>디자이너<em>{when}</em></div>
      <div>{children}</div>
    </aside>
  );
}

/* ---- 대주제 ------------------------------------------------------------------ */
export type ConfKind = "sure" | "guess" | "unk";
const CONF: Record<ConfKind, string> = { sure: "자료에서 확실", guess: "제 짐작이에요", unk: "모르겠어요" };
/** 확신 꼬리표. 확실은 안 봐도 되고, 짐작만 보면 되고, 모름은 대표가 채운다. */
export const Conf = ({ kind }: { kind: ConfKind }) => <span className={`tag ${kind}`}>{CONF[kind]}</span>;

export function Q({ n, title, why, conf, note, children }: {
  n: number; title: string; why?: string; conf?: ConfKind;
  /** 대주제 오른쪽 300 칸의 짧은 말. 그 자리에서 하나 더 묻는 것도 여기다. */
  note?: React.ReactNode; children: React.ReactNode;
}) {
  const body = note ? <div className="qb"><div>{children}</div><Say mini>{note}</Say></div> : children;
  return (
    <div className="q">
      <div className="qh">
        <span className="n">{n}</span><span className="t">{title}</span>
        {conf ? <Conf kind={conf} /> : null}
        {why ? <span className="why">{why}</span> : null}
      </div>
      {body}
    </div>
  );
}

/* ---- 꼬리표 · 되비추기 ------------------------------------------------------ */
export const Tag = ({ kind, children }: { kind: "rec" | "need"; children: React.ReactNode }) =>
  <span className={`tag ${kind}`}>{children}</span>;
export const Need = () => <Tag kind="need">확인 필요</Tag>;
/** 대표가 한 말을 되비춘다. 기획서 제목 아래, 뼈대의 디자이너 말에. */
export const Quote = ({ children }: { children: React.ReactNode }) =>
  <span className="quote"><b>대표님 말씀</b>«{children}»</span>;

/* ---- 입력 -------------------------------------------------------------------- */
export function Field({ label, hint, value, onChange, placeholder, multiline = false, readOnly = false }: {
  label: string; hint?: string; value: string; onChange?: (v: string) => void;
  placeholder?: string; multiline?: boolean; readOnly?: boolean;
}) {
  const common = { className: "in", value, placeholder, readOnly,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange?.(e.target.value) };
  return (
    <label className="field">
      <div className="lbl">{label}{hint ? <span className="k"> · {hint}</span> : null}</div>
      {multiline ? <textarea {...common} /> : <input {...common} />}
    </label>
  );
}

/* ---- 비었을 때 --------------------------------------------------------------- */
export function Empty({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="drop" style={{ padding: "var(--s-8) var(--s-6)" }}>
      <div style={{ fontWeight: 700 }}>{title}</div>
      {children ? <div className="k">{children}</div> : null}
    </div>
  );
}

/* ---- 알리는 화면의 가운데 ---------------------------------------------------- */
export function Mid({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="mid">
      <h1>{title}</h1>
      {children ? <div className="sub">{children}</div> : null}
    </div>
  );
}
