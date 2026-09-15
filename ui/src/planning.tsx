/* 기획 띠와 문서 띠의 화면 셋: 1 자료 넣기, 3 기획서, 4 보고서·기획서(워드).

   셋 다 아직 파이프라인이 다 받쳐 주지 않는다. 자료 넣기는 폴더에 놓는
   것이고, 기획서는 plan_spec.md 를 읽어 보여 주되 여기서 고치지는 못하며,
   워드 문서는 양식 고르기만 있고 내려받기는 없다. 없는 것은 없다고 화면에
   적는다 (DESIGN.md «원칙 다섯» ④ 지어내지 않는다). */

import { useState } from "react";
import { Shell } from "./shell";
import { Panel, Field, Empty, Need, Quote } from "../system/patterns";
import { Pick } from "../system/pick";

/* ---- 1 자료 넣기 ------------------------------------------------------------ */
export function Input({ sources, onNext }: { sources: string[]; onNext: () => void }) {
  return (
    <Shell band="기획" step="1 · 자료 넣기" pct={6}
      title="무엇으로 만들까요?"
      sub={<>자료를 놓거나 주제를 한 줄 적어 주세요.<br />읽고 나서 여쭤볼게요.</>}
      say={<>PDF, 워드, 한글, 글, 링크 어느 것이든 돼요. 여러 개도 괜찮아요.<br />읽고 요약해서 보여드리고, 그다음 아홉 가지를 여쭤볼게요.<br />만들 수 있는 건 셋이에요. <strong>발표자료</strong>, <strong>보고서·기획서(워드)</strong>, 또는 둘 다.</>}
      side={
        <>
          <Panel label="읽는 동안">
            {sources.length
              ? <ul className="c">{sources.map((s) => <li key={s}>{s}</li>)}</ul>
              : <Empty title="아직 놓인 자료가 없어요" />}
            <div className="k">파일 이름, 쪽수, 언어가 여기 보여요</div>
          </Panel>
          <Panel label="지난번" kind="memo">
            <Empty title="아직 기억이 없어요">다섯 번째쯤부터 지난번 색과 분위기를 기억하고 «늘 하던 대로 시작»을 먼저 보여줘요.</Empty>
          </Panel>
          <Panel label="이어 하기">
            <Empty title="만들다 만 것이 없어요" />
          </Panel>
        </>
      }
      footNote="자료는 프로젝트 폴더의 sources/ 에 놓아요. 화면에서 놓는 자리는 아직 파이프라인에 없어요."
      actions={[{ label: "읽기 시작", kind: "pri", onClick: onNext }]}>
      <Panel label="자료">
        <div className="drop">
          <div className="docicon"><i style={{ right: 10, top: 16 }} /><i style={{ right: 18, top: 26 }} /><i style={{ right: 14, top: 36 }} /></div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>여기에 자료를 놓으세요</div>
          <div className="k">PDF · DOCX · HWP · TXT · MD · 링크. 표와 그림도 읽어요</div>
          <div className="row" style={{ gap: 10, marginTop: 6 }}>
            <span className="chip off">파일 고르기</span><span className="chip off">링크 붙이기</span>
          </div>
          {sources.map((s) => <div key={s} className="filechip" style={{ marginTop: 14 }}><i />{s}</div>)}
        </div>
        <div className="k" style={{ textAlign: "center" }}>또는</div>
        <Field label="주제 한 줄 · 자료 없이 시작" value="" placeholder="예: 아멕스 플래티넘 카드 출장 혜택 소개서" readOnly />
      </Panel>
    </Shell>
  );
}

/* ---- plan_spec.md 읽기 --------------------------------------------------------- */
export interface PlanSection { no: string; name: string; status: string; lines: string[]; source: string; }
export interface PlanDoc { meta: Record<string, string>; title: string; governing: string; sections: PlanSection[]; appendix: string[]; }

/** plan_spec.py 가 쓰는 모양을 그대로 읽는다. 앞머리(---), # 제목, ## 거버닝
    메시지, ## N. 절 (status: · 본문 · source:), ## 별첨. 주석은 건너뛴다. */
export function parsePlanSpec(text: string): PlanDoc {
  const doc: PlanDoc = { meta: {}, title: "", governing: "", sections: [], appendix: [] };
  let body = text;
  if (text.startsWith("---")) {
    const end = text.indexOf("\n---", 3);
    if (end > 0) {
      text.slice(3, end).split("\n").forEach((l) => {
        const i = l.indexOf(":");
        if (i > 0) doc.meta[l.slice(0, i).trim()] = l.slice(i + 1).trim();
      });
      body = text.slice(end + 4);
    }
  }
  let cur: PlanSection | null = null;
  let mode: "" | "gov" | "sec" | "app" = "";
  body.split("\n").forEach((raw) => {
    const line = raw.replace(/<!--.*?-->/g, "").trimEnd();
    if (!line.trim()) return;
    if (line.startsWith("# ")) { doc.title = line.slice(2).trim(); return; }
    if (line.startsWith("## ")) {
      const h = line.slice(3).trim();
      if (h.startsWith("거버닝")) { mode = "gov"; cur = null; return; }
      if (h.startsWith("별첨")) { mode = "app"; cur = null; return; }
      const m = h.match(/^(\d+)\.\s*(.+)$/);
      cur = { no: m ? m[1] : String(doc.sections.length + 1), name: m ? m[2] : h, status: "", lines: [], source: "" };
      doc.sections.push(cur); mode = "sec"; return;
    }
    if (mode === "gov") { doc.governing += (doc.governing ? " " : "") + line.trim(); return; }
    if (mode === "app") { doc.appendix.push(line.replace(/^[-*]\s*/, "").trim()); return; }
    if (mode === "sec" && cur) {
      if (line.startsWith("status:")) { cur.status = line.slice(7).trim(); return; }
      if (line.startsWith("source:")) { cur.source = line.slice(7).trim(); return; }
      cur.lines.push(line);
    }
  });
  return doc;
}

/** 마크다운 굵게 표시(**)와 긴 줄표를 화면에서는 뺀다. 글은 그대로다. */
const plain = (t: string) => t.replace(/\*\*/g, "");
const FRAME_NAMES: Record<string, string> = {
  problem: "문제 해결", hypothesis: "가설 검증", report: "성과 보고", intro: "소개·제안", teach: "교안", ir: "IR",
};
const needsCheck = (s: PlanSection) =>
  s.status !== "확정" || s.lines.some((l) => l.includes("확인 필요")) || s.lines.some((l) => l.includes("[확인 필요]"));

/* ---- 3 기획서 ---------------------------------------------------------------- */
export function Plan({ doc, quote, waiting, stale = false, onBack, onDoc, onOutline }: {
  doc: PlanDoc | null; quote?: string; waiting: boolean;
  /** 인터뷰 답이 바뀌었는데 기획서는 옛 답으로 쓴 것. */
  stale?: boolean;
  onBack: () => void; onDoc: () => void; onOutline?: () => void;
}) {
  const secs = doc?.sections || [];
  const flagged = secs.filter(needsCheck);
  const frame = FRAME_NAMES[doc?.meta.frame || ""] || doc?.meta.frame || "";
  return (
    <Shell band="기획" step="3 · 기획서" pct={30}
      title={doc ? "이렇게 이해했어요" : "기획서를 쓰고 있어요"}
      sub={doc
        ? <>제목과 거버닝 메시지가 먼저, 나머지는 틀의 순서대로예요.<br />여기서는 읽기만 해요. 고칠 게 있으면 plan_spec.md 를 고치면 그대로 반영돼요.</>
        : <>인터뷰 답을 바탕으로 제목, 거버닝 메시지, 절을 쓰고 있어요.<br />창을 닫아도 계속돼요.</>}
      say={doc
        ? <>{stale ? <><strong>답을 바꾸셨어요.</strong> 이 기획서는 옛 답으로 쓴 거예요. 채팅에서 «기획서 다시»라고 하면 새 답으로 다시 써요.<br /></> : null}
            {quote ? <>대표님이 «{quote}»라고 하셨죠. 그 말을 축으로 잡았어요.<br /></> : null}
            숫자는 자료에 있는 것만 옮겼어요. 없는 건 <strong>확인 필요</strong>로 비워 뒀어요. 지어내지 않아요.
            {flagged.length ? <><br />확인 필요가 {flagged.length}절에 있어요. 오른쪽에 적어 뒀어요.</> : null}</>
        : <>자료를 읽고 틀의 절마다 무엇을 넣을지 정하는 중이에요. 보통 1~2분이에요.</>}
      side={
        <>
          <Panel label={`틀 · ${frame || "정하는 중"}`}>
            {secs.length ? <ol className="n">{secs.map((s) => <li key={s.no}>{s.name}</li>)}</ol> : <Empty title="틀은 인터뷰 ②에서 정해져요" />}
            <div className="k">인터뷰 ②에서 정해졌어요. 다시 묻지 않아요</div>
          </Panel>
          <Panel label={`확인 필요 ${flagged.length}곳`} kind="warn">
            {flagged.length
              ? <ol className="n">{flagged.map((s) => <li key={s.no}>{s.no}절 {s.name}{s.status && s.status !== "확정" ? ` · ${s.status}` : ""}</li>)}</ol>
              : <div style={{ fontSize: 14 }}>없어요. 절마다 근거가 붙어 있어요.</div>}
            <div className="k">비워 두면 문서에 «확인 필요»로 나가요</div>
          </Panel>
          <Panel label="별첨">
            {doc?.appendix.length ? <ul className="c">{doc.appendix.map((a) => <li key={a}>{a}</li>)}</ul> : <Empty title="별첨이 없어요" />}
          </Panel>
          <Panel label="문체 검사">
            <Empty title="워드로 나갈 때 검사해요">최상급 없음, 수치가 문장 앞쪽, 개조식 마침표 없음.</Empty>
          </Panel>
        </>
      }
      footNote={waiting ? "기획서를 쓰는 중이에요. 다 되면 여기가 바뀌어요." : "기획서는 워드 문서와 발표자료 둘 다의 바탕이에요"}
      actions={[
        { label: "뒤로", onClick: onBack },
        { label: "문서로", onClick: onDoc, disabled: !doc },
        ...(onOutline ? [{ label: "뼈대로", kind: "pri" as const, onClick: onOutline, disabled: !doc }] : []),
      ]}>
      <Panel label="결과물 · 기획서">
        {!doc ? <Empty title="아직 기획서가 없어요">인터뷰 답을 저장하면 파이프라인이 plan_spec.md 를 써요. 다 되면 여기 보여요.</Empty> : (
          <>
            <div style={{ background: "var(--paper)", borderRadius: "var(--r-card)", padding: "22px 24px", display: "flex", flexDirection: "column", gap: 10 }}>
              <div className="lbl">제목 <span className="k">· 핵심 수단 + 결과 수치, 12~18자</span></div>
              <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.01em" }}>{doc.title || "제목이 비어 있어요"}</div>
              {quote ? <div className="row"><Quote>{quote}</Quote><span className="k">인터뷰 ⑤에서</span></div> : null}
              <div className="lbl" style={{ marginTop: 8 }}>거버닝 메시지 <span className="k">· 현황 + 해결 + 정량 결과, 2~3문장</span></div>
              <div style={{ fontSize: 15, lineHeight: 1.7 }}>{doc.governing || "거버닝 메시지가 비어 있어요"}</div>
            </div>
            <div>
              {secs.map((s) => (
                <div className="sec" key={s.no}>
                  <div className="hd">
                    <span className="fr">{s.no} · {s.name}</span>
                    <span className="ti" title={s.lines[0]}>{plain(s.lines[0] || "").replace(/^[-*▢◦]\s*/, "")}</span>
                    {needsCheck(s) ? <Need /> : null}
                    <span className="src">{s.source ? `근거 · ${s.source}` : s.status ? `상태 · ${s.status}` : ""}</span>
                  </div>
                  {s.lines.slice(1).map((l, i) => (
                    <p key={i} className={l.startsWith("- ") ? "s" : ""}>{plain(l.replace(/^- /, ""))}</p>
                  ))}
                </div>
              ))}
            </div>
          </>
        )}
      </Panel>
    </Shell>
  );
}

/* ---- 4 보고서·기획서 (워드) ------------------------------------------------------ */
const FORMS = [
  { id: "bok", label: "한국은행 보도자료형", note: "흑백 · Ⅰ → □ → ─ → *" },
  { id: "khnp", label: "한수원 개조식 보고서형", note: "파란 대제목 · Ⅰ → ▢ → ◦ → *" },
  { id: "upload", label: "회사 양식 올리기", note: "DOCX를 놓으면 글꼴과 머리글을 써요", off: true },
];
const ROMAN = ["Ⅰ", "Ⅱ", "Ⅲ", "Ⅳ", "Ⅴ", "Ⅵ", "Ⅶ", "Ⅷ", "Ⅸ", "Ⅹ", "Ⅺ", "Ⅻ"];

export function Doc({ doc, onBack, onNext, deckToo }: { doc: PlanDoc | null; onBack: () => void; onNext: () => void; deckToo: boolean }) {
  const [form, setForm] = useState("khnp");
  const secs = doc?.sections || [];
  const flagged = secs.filter(needsCheck).length;
  return (
    <Shell band="문서" step="4 · 보고서·기획서" pct={44}
      title="워드 문서로 이렇게 나가요"
      sub={<>양식을 고르면 아래 문서가 바뀌어요.<br />기획서 {secs.length || "N"}절이 그대로 {secs.length || "N"}항목이에요.</>}
      say={<>소개서는 절을 묶지 않고 하나씩 항목으로 놓아요. 기획서와 보고서는 여섯 항목으로 묶어요. 목적, 개요, 내용 및 계획, 리스크 대책, 기대효과.<br />
            {flagged ? <>확인 필요 {flagged}곳이 남아 있어서 표지에 <strong>«검토 중»</strong> 표시가 붙어요. 채우면 사라져요.</> : <>확인 필요가 없어서 «검토 중» 표시 없이 나가요.</>}</>}
      side={
        <>
          <Panel label="문서 검사">
            <ul className="c">
              <li>제목 {doc?.title.length || 0}자</li>
              <li>거버닝 {doc?.governing ? doc.governing.split(/[.。]\s*/).filter(Boolean).length : 0}문장</li>
              <li className={flagged ? "bad" : ""}>확인 필요 {flagged}곳</li>
              <li>별첨 {doc?.appendix.length || 0}</li>
            </ul>
          </Panel>
          {deckToo ? (
            <Panel label="발표자료도 만들면">
              <div style={{ fontSize: 14, lineHeight: 1.7 }}>마지막 장의 결론이 이 문서의 결론과 같아야 해요.<br />뼈대에서 검사해요.</div>
            </Panel>
          ) : null}
        </>
      }
      footNote="워드 내려받기는 파이프라인의 report_form.py 가 해요. 화면에서 바로 받는 자리는 아직 없어요."
      actions={[
        { label: "뒤로", onClick: onBack },
        { label: "워드 내려받기", disabled: true },
        ...(deckToo ? [{ label: "발표자료로", kind: "pri" as const, onClick: onNext }] : []),
      ]}>
      <Panel label="고르기 · 양식">
        <Pick kind="card" cols={3} items={FORMS} value={form} onChange={setForm} />
        <div className="kv" style={{ marginTop: 6 }}>
          <span>글꼴</span><Pick items={[{ id: "form", label: form === "khnp" ? "양식대로 · Pretendard" : "양식대로 · 맑은 고딕" }]} value="form" onChange={() => {}} />
          <span>쪽</span><Pick items={[{ id: "a4", label: "A4" }, { id: "letter", label: "Letter", off: true }]} value="a4" onChange={() => {}} />
          <span>쪽번호</span><Pick items={[{ id: "y", label: "넣기" }, { id: "n", label: "빼기", off: true }]} value="y" onChange={() => {}} />
        </div>
      </Panel>
      <Panel label={<>결과물 · 문서 미리보기 <b>1 / {Math.max(1, Math.ceil(secs.length / 2))}쪽</b></>}>
        {!doc ? <Empty title="기획서가 있어야 문서가 나와요" /> : (
          <div className="page">
            <div className="t">{doc.title} {flagged ? <Need /> : null}</div>
            <div style={{ color: "var(--ink-muted)" }}>{doc.governing}</div>
            {secs.map((s, i) => (
              <div className="it" key={s.no}>
                <b>{ROMAN[i] || s.no}. {s.name}</b>
                <div>
                  {s.lines.slice(0, 3).map((l, j) => <p key={j}>{(l.startsWith("- ") ? "◦ " : j === 0 ? "▢ " : "") + plain(l.replace(/^- /, ""))}</p>)}
                  {needsCheck(s) ? <p>* 확인 필요</p> : null}
                </div>
              </div>
            ))}
            <div className="k" style={{ textAlign: "center", marginTop: 10 }}>1</div>
          </div>
        )}
      </Panel>
    </Shell>
  );
}
