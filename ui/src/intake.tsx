/* Intake — the one round of questions only the user can answer.

   DESIGN.md's rule holds here too: show the thing being chosen. A purpose is
   abstract, so each card draws the chain of sections that purpose produces —
   picking "성과 보고" shows you the report skeleton you are about to get,
   before any of it is written. */

import { useState } from "react";
import * as api from "./api";
import type { IntakeData } from "./api";
import { cardStyle, PresetField } from "./selectors";

type Dict = Record<string, any>;

/** Purpose → the frame it resolves to, and that frame's section chain.
    Mirrors references/planner.md §2 and §3; keep the two in step. */
const PURPOSES: {
  id: string; short: string; note: string; chain: string[]; split?: boolean;
}[] = [
  {
    id: "사내 예산 · 의사결정 승인", short: "승인 받기",
    note: "예산이나 결정을 받아내야 하는 자리",
    chain: ["현상", "영향", "원인", "배경", "목표", "검증", "기대효과", "과제"],
    split: true,
  },
  {
    id: "전략 제안", short: "전략 제안",
    note: "방향을 새로 제시하는 자리",
    chain: ["현상", "영향", "원인", "배경", "목표", "검증", "기대효과", "과제"],
    split: true,
  },
  {
    id: "성과 보고", short: "성과 보고",
    note: "이미 한 일의 결과를 전달",
    chain: ["하기로 한 것", "한 것", "결과", "해석", "한계", "다음"],
  },
  {
    id: "회사 · 서비스 · 프로그램 소개 / 제안서", short: "소개 · 제안서",
    note: "회사·서비스·프로그램 소개, 제안서",
    chain: ["왜 존재하나", "무엇인가", "무엇이 다른가", "근거·사례", "다음 행동"],
  },
  {
    id: "교육 · 강의", short: "교육 · 강의",
    note: "가르치는 자리",
    chain: ["학습 목표", "왜 필요한가", "개념", "예시", "실습", "정리"],
  },
  {
    id: "IR 투자 유치", short: "IR 투자 유치",
    note: "외부 투자자 앞에서",
    chain: ["문제", "해결책", "시장", "제품", "수익 모델", "트랙션", "경쟁", "팀", "재무", "요청"],
  },
];

const ASSIGNMENTS = [
  { id: "지시수명", label: "과제를 받았습니다", note: "위에서 내려온 일을 정리해 올립니다" },
  { id: "신규제안", label: "제가 제안합니다", note: "아이디어에서 출발해 설득합니다" },
];

const DOC_KINDS = [
  { id: "발표자료", note: "화면에 띄우고 말합니다" },
  { id: "보고서", note: "읽는 문서로 결재에 올립니다" },
  { id: "둘 다", note: "같은 재료로 둘 다 만듭니다" },
];

const INTERESTS = [
  "ROI · 수익성", "리스크 · 안정성", "실행 가능성", "비용 · 예산",
  "성장성 · 시장성", "차별성 · 경쟁력", "사회적 가치", "트렌드 · 혁신성",
];

const AUDIENCE_PRESETS = [
  { id: "exec", label: "사내 경영진", text: "사내 경영진 — 결정을 내려야 하는 자리" },
  { id: "invest", label: "투자자 · 심사역", text: "투자자·심사역 — 외부에서 처음 보는 사람" },
  { id: "staff", label: "실무 담당자", text: "실무 담당자 — 실행을 맡을 사람" },
  { id: "learner", label: "강의 수강생", text: "강의 수강생 — 처음 배우는 사람" },
  { id: "client", label: "고객 · 클라이언트", text: "고객·클라이언트 — 우리를 아직 모르는 사람" },
];

/** Draw the section chain a purpose produces. */
function Chain({ steps }: { steps: string[] }) {
  return (
    <svg viewBox={`0 0 ${steps.length * 46} 34`} className="h-[34px] w-full" aria-hidden="true">
      {steps.map((_, i) => (
        <g key={i}>
          <rect x={i * 46 + 3} y="10" width="34" height="14" rx="3"
                fill="var(--wdb-secondary)" opacity={0.16 + (i / steps.length) * 0.6} />
          {i < steps.length - 1 && (
            <path d={`M${i * 46 + 38} 17 L${i * 46 + 45} 17`}
                  stroke="var(--border)" strokeWidth="1.5" />
          )}
        </g>
      ))}
    </svg>
  );
}

function Field({ label, hint, children }: {
  label: string; hint?: string; children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <div>
        <div className="text-[15px] font-semibold">{label}</div>
        {hint ? (
          <div className="mt-0.5 text-[13px]" style={{ color: "var(--muted)" }}>{hint}</div>
        ) : null}
      </div>
      {children}
    </div>
  );
}

function Chips({ options, value, onToggle }: {
  options: string[]; value: string[]; onToggle: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2.5">
      {options.map((o) => (
        <button key={o} type="button" onClick={() => onToggle(o)}
                aria-pressed={value.includes(o)}
                className="rounded-full border px-4 py-2 text-[15px] transition"
                style={cardStyle(value.includes(o))}>
          {o}
        </button>
      ))}
    </div>
  );
}

export function Intake({ draft, onDone }: {
  draft: Partial<IntakeData>;
  onDone: (v: IntakeData) => void;
}) {
  const [v, setV] = useState<IntakeData>({ ...api.EMPTY_INTAKE, ...draft });
  const [msg, setMsg] = useState("");
  const set = (k: keyof IntakeData, val: any) => {
    setV((s) => ({ ...s, [k]: val }));
    setMsg("");
  };
  const needsAssignment = api.NEEDS_ASSIGNMENT.has(v.purpose);
  const picked = PURPOSES.find((p) => p.id === v.purpose);

  function submit() {
    const err = api.validateIntake(v);
    if (err) { setMsg(err); return; }
    onDone({ ...v, assignment: needsAssignment ? v.assignment : "" });
  }

  return (
    <div className="mx-auto flex h-full w-full max-w-[860px] flex-col">
      <header className="border-b px-8 py-6"
              style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
        <h1 className="text-xl font-bold">먼저, 이 자료가 무엇인지만 알려주세요</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
          나머지는 자료를 읽고 제가 채운 다음, 고르실 수 있게 보여드립니다.
        </p>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-8 py-7">
        <div className="flex flex-col gap-9">

          <Field label="이 자료는 무엇을 위한 건가요?"
                 hint="고르시면 어떤 뼈대로 짜이는지 아래 막대로 보여드립니다">
            <div className="grid gap-4 sm:grid-cols-2">
              {PURPOSES.map((p) => {
                const on = v.purpose === p.id;
                return (
                  <button key={p.id} type="button" aria-pressed={on}
                          onClick={() => { set("purpose", p.id); set("assignment", ""); }}
                          className="overflow-hidden rounded-xl border p-0 text-left transition"
                          style={cardStyle(on)}>
                    <div className="px-4 pt-4">
                      <div className="text-[15px] font-semibold">{p.short}</div>
                      <div className="mt-1 text-[13px] leading-relaxed"
                           style={{ color: "var(--muted)" }}>{p.note}</div>
                    </div>
                    <div className="px-4 pb-3 pt-3">
                      <Chain steps={p.chain} />
                      <div className="mt-1 text-[12px]" style={{ color: "var(--muted)" }}>
                        {p.chain.length}단 구성 · {p.chain[0]}부터
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </Field>

          {needsAssignment ? (
            <Field label="과제를 받으신 건가요, 직접 제안하시는 건가요?"
                   hint="같은 목적이라도 출발점이 다르면 뼈대가 달라집니다">
              <div className="grid gap-4 sm:grid-cols-2">
                {ASSIGNMENTS.map((a) => (
                  <button key={a.id} type="button" aria-pressed={v.assignment === a.id}
                          onClick={() => set("assignment", a.id)}
                          className="rounded-xl border p-4 text-left transition"
                          style={cardStyle(v.assignment === a.id)}>
                    <div className="text-[15px] font-semibold">{a.label}</div>
                    <div className="mt-1 text-[13px] leading-relaxed"
                         style={{ color: "var(--muted)" }}>{a.note}</div>
                  </button>
                ))}
              </div>
            </Field>
          ) : null}

          <Field label="결론적으로 무엇을 말하고 싶으신가요?"
                 hint="한 문장이면 됩니다. 이 문장이 덱 전체의 기준이 됩니다">
            <textarea value={v.conclusion} onChange={(e) => set("conclusion", e.target.value)}
                      rows={2} placeholder="예: 시범 성과가 확인됐으니 전사로 확대해야 합니다"
                      className="w-full rounded-lg border px-4 py-3 text-[15px] leading-relaxed outline-none"
                      style={{ borderColor: "var(--border)", background: "var(--surface)",
                               color: "var(--foreground)" }} />
          </Field>

          <Field label="이 자료에서 무엇을 중요하게 보시나요?"
                 hint="비워 두시면 제가 자료에서 찾아 제안드립니다">
            <textarea value={v.emphasis} onChange={(e) => set("emphasis", e.target.value)}
                      rows={2} placeholder="예: 신고 건수보다 재해 감소가 핵심입니다"
                      className="w-full rounded-lg border px-4 py-3 text-[15px] leading-relaxed outline-none"
                      style={{ borderColor: "var(--border)", background: "var(--surface)",
                               color: "var(--foreground)" }} />
          </Field>

          <Field label="누구에게 보여줍니까?">
            <PresetField legend="" presets={AUDIENCE_PRESETS} value={v.audience}
                         onChange={(t: string) => set("audience", t)}
                         placeholder="가까운 것을 고르고 필요하면 고쳐 쓰세요" />
          </Field>

          <Field label="그 청중이 무엇을 궁금해합니까?" hint="여러 개 고르셔도 됩니다">
            <Chips options={INTERESTS} value={v.interests}
                   onToggle={(o) => set("interests",
                     v.interests.includes(o) ? v.interests.filter((x) => x !== o)
                                             : [...v.interests, o])} />
          </Field>

          <Field label="어떤 형태로 만들까요?">
            <div className="grid gap-4 sm:grid-cols-3">
              {DOC_KINDS.map((d) => (
                <button key={d.id} type="button" aria-pressed={v.doc_kind === d.id}
                        onClick={() => set("doc_kind", d.id)}
                        className="rounded-xl border p-4 text-left transition"
                        style={cardStyle(v.doc_kind === d.id)}>
                  <div className="text-[15px] font-semibold">{d.id}</div>
                  <div className="mt-1 text-[13px] leading-relaxed"
                       style={{ color: "var(--muted)" }}>{d.note}</div>
                </button>
              ))}
            </div>
          </Field>

        </div>
      </div>

      <footer className="flex items-center justify-between gap-4 border-t px-8 py-4"
              style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
        <span className="text-[13px]" style={{ color: msg ? "var(--danger)" : "var(--muted)" }}>
          {msg || (picked
            ? `${picked.short} · ${picked.chain.length}단 구성으로 짭니다`
            : "무엇을 위한 자료인지부터 골라 주세요")}
        </span>
        <button type="button" onClick={submit}
                className="rounded-lg px-5 py-2.5 text-[15px] font-semibold text-white"
                style={{ background: "var(--wdb-primary)" }}>
          자료 읽고 기획 시작 →
        </button>
      </footer>
    </div>
  );
}
