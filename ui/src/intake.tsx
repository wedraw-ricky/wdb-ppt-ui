/* 2 인터뷰. DESIGN.md «원칙 다섯» ③: 답은 미리 채우고 확실·짐작·모름 꼬리표를
   붙인다. 자료에 없는 것(언제, 누가 쓰나)은 짐작으로 채우지 않고 비워 두고
   먼저 묻는다.

   intake.json 이 이미 있으면(파이프라인이 자료를 읽고 채운 것) 그 값이
   «제 짐작이에요» 다. 아직 없으면 꼬리표 없이 빈 칸이다. 자료에서 확실한
   것과 짐작을 갈라 주는 근거는 파이프라인이 아직 넘겨주지 않아서, 채워진 답은
   전부 짐작으로 표시한다. 걸린 것도 같은 이유로 비어 있다. */

import { useMemo, useState } from "react";
import { Shell } from "./shell";
import { Panel, Q, Field, Empty } from "../system/patterns";
import { Pick } from "../system/pick";
import * as api from "./api";
import type { IntakeData } from "./api";

type Dict = Record<string, any>;

/** Purpose → the frame it resolves to, and that frame's section chain.
 *
 *  Mirrors `plan_spec.py`'s FRAMES. The card draws what the purpose actually
 *  produces, so a chain that falls behind makes the screen promise a shorter
 *  document than the person will get — it did exactly that when the planning
 *  chain grew from 8 sections to 12 and this list stayed put.
 *
 *  `tests/test_planning.py` compares the two: same length, and every label
 *  here has to be the real section name or a shortening of it. */
const PURPOSES: {
  id: string; short: string; note: string; chain: string[]; split?: boolean;
}[] = [
  {
    id: "사내 예산 · 의사결정 승인", short: "승인 받기",
    note: "예산이나 결정을 받아내야 하는 자리",
    chain: ["현상", "영향", "원인", "배경", "목표", "목적 검증", "기대효과",
            "과제", "컨셉", "해결책", "실행 계획", "리스크 대책"],
    split: true,
  },
  {
    id: "전략 제안", short: "전략 제안",
    note: "방향을 새로 제시하는 자리",
    chain: ["현상", "영향", "원인", "배경", "목표", "목적 검증", "기대효과",
            "과제", "컨셉", "해결책", "실행 계획", "리스크 대책"],
    split: true,
  },
  {
    id: "성과 보고", short: "성과 보고",
    note: "이미 한 일의 결과를 전달",
    chain: ["하기로 한 것", "한 것", "결과", "결과 해석", "한계", "다음",
            "실행 계획", "리스크 대책"],
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
  { id: "지시수명", label: "과제를 받았어요" },
  { id: "신규제안", label: "직접 제안해요" },
];
const DOC_KINDS = [
  { id: "발표자료", note: "장 7~14" },
  { id: "보고서", note: "워드 3~6쪽" },
  { id: "둘 다", note: "같은 결론으로 둘 다" },
];
const INTERESTS = [
  "ROI · 수익성", "리스크 · 안정성", "실행 가능성", "비용 · 예산",
  "성장성 · 시장성", "차별성 · 경쟁력", "사회적 가치", "트렌드 · 혁신성",
];
const AUDIENCES = [
  { id: "사내 경영진", label: "경영진" },
  { id: "실무 담당자", label: "실무 담당자" },
  { id: "고객 · 클라이언트", label: "고객" },
  { id: "투자자 · 심사역", label: "투자자" },
  { id: "강의 수강생", label: "수강생" },
];
const WHEN = ["오늘 안에", "내일", "이번 주", "여유 있어요"];
const PRESENTER = ["대표님이 직접", "다른 분이", "읽는 자료예요"];
/** 분량 네 단계 (DESIGN.md 2026-09-16). 지금은 뼈대가 장 수를 정하므로
    여기서 고른 것은 기록만 남는다. */
const LENGTHS = [
  { id: "short", label: "짧게 · 15장 미만" },
  { id: "normal", label: "보통 · 15~30장" },
  { id: "long", label: "길게 · 30~50장" },
  { id: "huge", label: "그 이상 · 50장 넘게" },
];

/** intake.json 에 더 적는 두 가지. 파이프라인은 아직 안 읽지만 기록은 남는다. */
export interface IntakeExtra extends IntakeData {
  when?: string;
  presenter?: string;
  length?: string;
}

export function Interview({ draft, onDone, onBack }: {
  draft: Partial<IntakeExtra>; onDone: (v: IntakeExtra) => Promise<void>; onBack?: () => void;
}) {
  const [v, setV] = useState<IntakeExtra>({ ...api.EMPTY_INTAKE, ...draft });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  // 처음 열었을 때 채워져 있던 답이 «짐작» 이다. 사람이 고치면 꼬리표는 그대로 둔다 —
  // 고친 뒤에도 원래 짐작이었다는 사실은 변하지 않는다.
  const prefilled = useMemo(() => ({
    purpose: Boolean(draft.purpose), emphasis: Boolean(draft.emphasis),
    conclusion: Boolean(draft.conclusion), audience: Boolean(draft.audience),
    interests: Boolean(draft.interests?.length), doc_kind: Boolean(draft.doc_kind),
  }), []);
  const guess = (k: keyof typeof prefilled) => (prefilled[k] ? "guess" : undefined);
  const set = (k: keyof IntakeExtra, val: any) => setV((s) => ({ ...s, [k]: val }));
  const picked = PURPOSES.find((p) => p.id === v.purpose);
  const needsAssignment = api.NEEDS_ASSIGNMENT.has(v.purpose);
  const audienceCustom = v.audience && !AUDIENCES.some((a) => a.id === v.audience);
  const answered = [v.purpose, v.conclusion.trim(), v.audience, v.doc_kind].filter(Boolean).length;

  async function submit() {
    const bad = api.validateIntake(v);
    if (bad) { setErr(bad); return; }
    setErr(""); setBusy(true);
    try { await onDone(v); } catch { setErr("저장이 안 됐어요. 다시 눌러 주세요."); setBusy(false); }
  }

  const say = (
    <>
      {picked
        ? <>«{picked.short}» 자료로 읽혀요. <strong>{picked.chain.length}절 틀</strong>로 갈게요. 틀은 여기서 정해지고 다시 묻지 않아요.</>
        : <>자료를 읽고 아홉 가지를 여쭤볼게요. 자료에서 확실한 건 채워 두고, 짐작한 건 «제 짐작이에요» 라고 적어요.</>}
      <br />①은 자료에 없어서 먼저 여쭤요. 그다음 짐작이라고 적힌 것만 봐 주시면 돼요.
    </>
  );

  return (
    <Shell band="기획" step="2 · 인터뷰" pct={16}
      title="아홉 가지만 여쭤볼게요"
      sub={<>자료에서 확실한 건 채워 뒀어요.<br />①은 자료에 없어서 먼저 여쭤요. 그다음 <b>제 짐작</b>이라고 적힌 것만 봐 주세요.</>}
      say={say}
      side={
        <>
          <Panel label="자료에서 읽은 것">
            <Empty title="아직 읽은 것을 넘겨받지 못해요">자료를 읽고 요약해 주는 자리는 파이프라인에 아직 없어요. 지금은 채워진 답이 읽은 것의 전부예요.</Empty>
          </Panel>
          <Panel label="읽다가 걸린 것" kind="warn">
            <Empty title="걸린 것을 적어 주는 단계가 아직 없어요">자료에서 숫자가 두 개면 여기서 고르게 할 거예요. 지어내지 않아요.</Empty>
          </Panel>
          <Panel label="틀">
            {picked
              ? <><div style={{ fontWeight: 700 }}>{picked.short}</div>
                  <ol className="n">{picked.chain.map((c) => <li key={c}>{c}</li>)}</ol>
                  <div className="k">②에서 정해져요. 다시 묻지 않아요</div></>
              : <Empty title="②를 고르면 틀이 정해져요" />}
          </Panel>
        </>
      }
      footNote={`답 ${answered}/4 · 답을 바꾸면 기획서가 달라져요. 틀은 다시 묻지 않아요.`}
      error={err}
      actions={[...(onBack ? [{ label: "뒤로", onClick: onBack }] : []), { label: "기획서 쓰기", kind: "pri" as const, onClick: submit, disabled: busy }]}>
      <Panel label="고르기 · 아홉 가지">
        <Q n={1} title="언제, 누가 쓰나요" why="속도와 말투를 정해요" conf="unk">
          <div className="kv">
            <span>언제</span><Pick items={WHEN.map((w) => ({ id: w, label: w }))} value={v.when} onChange={(x) => set("when", x)} />
            <span>발표는</span><Pick items={PRESENTER.map((w) => ({ id: w, label: w }))} value={v.presenter} onChange={(x) => set("presenter", x)} />
          </div>
          <div className="k">급하시면 확인 필요한 곳부터 같이 채워요. 직접 발표하시면 발표자 노트를 대표님 말투로 써요. 읽는 자료면 글을 조금 더 넣어요.</div>
        </Q>
        <Q n={2} title="이 자료는 무엇을 위한 건가요" why="여기서 틀이 정해져요" conf={guess("purpose")}>
          <Pick items={PURPOSES.map((p) => ({ id: p.id, label: p.short, note: p.note }))} value={v.purpose}
                onChange={(x) => { set("purpose", x); if (!api.NEEDS_ASSIGNMENT.has(x)) set("assignment", ""); }} />
        </Q>
        <Q n={3} title="과제를 받으신 건가요, 직접 제안하시는 건가요" why="승인이나 전략일 때만 물어요">
          <Pick items={ASSIGNMENTS.map((a) => ({ ...a, off: !needsAssignment, note: needsAssignment ? "" : "이 목적에서는 안 물어요" }))}
                value={needsAssignment ? v.assignment : null} onChange={(x) => set("assignment", x)} />
        </Q>
        <Q n={4} title="이 자료에서 무엇을 중요하게 보시나요" conf={guess("emphasis")}>
          <Field label="강조할 것" value={v.emphasis} onChange={(x) => set("emphasis", x)} multiline
                 placeholder="예: 혜택을 나열하지 말고 실제 여정 순서로" />
        </Q>
        <Q n={5} title="결론적으로 무엇을 말하고 싶으신가요" conf={guess("conclusion")}>
          <Field label="결론 한 문장" value={v.conclusion} onChange={(x) => set("conclusion", x)} multiline
                 placeholder="예: 다음 출장 전에 발급하면 공항부터 호텔까지 카드 한 장으로 끝난다" />
        </Q>
        <Q n={6} title="누구에게 보여주나요" why="말투와 깊이가 달라져요" conf={guess("audience")}>
          <Pick items={[...AUDIENCES, { id: "__custom", label: "직접 적기" }]}
                value={audienceCustom ? "__custom" : v.audience}
                onChange={(x) => set("audience", x === "__custom" ? (audienceCustom ? v.audience : " ") : x)} />
          {audienceCustom ? <Field label="누구인지 한 줄" value={v.audience.trim()} onChange={(x) => set("audience", x || " ")} placeholder="예: 카드 발급을 검토하는 고객" /> : null}
        </Q>
        <Q n={7} title="그 사람들이 무엇을 궁금해하나요" why="여럿 고를 수 있어요" conf={guess("interests")}>
          <Pick items={INTERESTS.map((i) => ({ id: i, label: i }))} value={v.interests} multi onChange={(x) => set("interests", x)} />
        </Q>
        <Q n={8} title="얼마나 길게" why="자료 양과 목적으로 짐작해요. 바꿔도 돼요">
          <Pick kind="card" cols={4} items={LENGTHS} value={v.length} onChange={(x) => set("length", x)} />
          <div className="k">15장을 넘으면 파트로 나누고 부마다 간지를 넣어요. 부는 4~12장이에요. 50장을 넘으면 부를 편으로 한 번 더 묶어요. 지금은 뼈대가 장 수를 정하고, 여기서 고른 것은 기록으로 남아요.</div>
        </Q>
        <Q n={9} title="무엇을 만들까요" why="여기서 흐름이 갈려요" conf={guess("doc_kind")}>
          <Pick kind="card" cols={3} items={DOC_KINDS.map((d) => ({ id: d.id, label: d.id, note: d.note }))} value={v.doc_kind} onChange={(x) => set("doc_kind", x)} />
        </Q>
      </Panel>
    </Shell>
  );
}

/** 옛 이름. App 이 아직 이 이름으로 부른다. */
export const Intake = Interview;
export type { Dict };
