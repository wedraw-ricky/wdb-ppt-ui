/* 알리는 화면 셋: 7 만드는 중, 8 완성, 멈췄을 때. DESIGN.md «알리는 화면»:
   무엇을 했고 무엇이 남았는지만. 몇 % 는 적지 않는다. 재는 게 없다.

   «만드는 중» 은 파이프라인이 다음 것을 쓰는 동안(기획서, 뼈대, 다음 단계
   후보) 보인다. 남은 일은 /api/progress 가 준 메모로 채운다. 멈췄을 때는
   서버 심장박동이 두 번 연속 끊겼을 때다. 한 번 끊긴 건 알리지 않는다. */

import { useEffect, useState } from "react";
import { Shell } from "./shell";
import { Panel, Empty } from "../system/patterns";
import { Storyboard } from "./slides";
import type { Row } from "./outline/model";
import type { Palette } from "./slides";
import * as api from "./api";

const PROGRESS_POLL_MS = 3000;

function useElapsed(): number {
  const [s, setS] = useState(0);
  useEffect(() => { const t = setInterval(() => setS((v) => v + 1), 1000); return () => clearInterval(t); }, []);
  return s;
}
const fmt = (s: number) => (s >= 60 ? `${Math.floor(s / 60)}분 ${s % 60}초` : `${s}초`);

/** 이번 기다림에 속한 메모만. 이전 단계의 메모가 섞이지 않게 나이로 거른다. */
function useNotes(): string[] {
  const [notes, setNotes] = useState<string[]>([]);
  const [started] = useState(() => Date.now());
  useEffect(() => {
    let stopped = false;
    async function read() {
      const all = await api.progressNotes();
      if (stopped) return;
      const waited = (Date.now() - started) / 1000 + PROGRESS_POLL_MS / 1000;
      setNotes(all.filter((n) => n.age_seconds <= waited).map((n) => n.note));
    }
    read();
    const id = setInterval(read, PROGRESS_POLL_MS);
    return () => { stopped = true; clearInterval(id); };
  }, [started]);
  return notes;
}

export type WaitKind = "plan" | "outline" | "stage" | "final";
const WAIT: Record<WaitKind, { band: "기획" | "발표"; step: string; pct: number; title: string; sub: string; steps: string[]; done: string[] }> = {
  plan:    { band: "기획", step: "3 · 기획서", pct: 26, title: "기획서를 쓰고 있어요", sub: "1~2분쯤 걸려요. 창을 닫아도 계속돼요.",
             steps: ["자료 다시 읽기", "제목과 거버닝 메시지 쓰기", "틀의 절마다 채우기", "없는 숫자는 확인 필요로"], done: ["자료 읽음", "인터뷰 답 저장"] },
  outline: { band: "발표", step: "5 · 뼈대", pct: 52, title: "뼈대를 짜고 있어요", sub: "1분쯤 걸려요. 창을 닫아도 계속돼요.",
             steps: ["흐름 정하기", "장으로 나누기", "장마다 모양과 사진 자리", "결론이 문서와 같은지 검사"], done: ["자료 읽음", "인터뷰 답", "기획서"] },
  stage:   { band: "발표", step: "6 · 디자인", pct: 66, title: "다음 후보를 준비하고 있어요", sub: "30초쯤 걸려요. 고르신 것에 맞춰 색과 글꼴 후보를 다시 골라요.",
             steps: ["고른 것 저장", "색 후보 셋 고르기", "글꼴과 아이콘 맞추기"], done: ["자료 읽음", "인터뷰 답", "기획서", "뼈대"] },
  final:   { band: "발표", step: "7 · 만드는 중", pct: 86, title: "만들고 있어요", sub: "몇 분 걸려요. 창을 닫아도 계속돼요.",
             steps: ["사진 만들기", "장 그리기", "글자 넘침과 대비 검사", "파워포인트로 내보내기"], done: ["자료 읽음", "인터뷰 답", "기획서", "뼈대", "색과 사진 정함"] },
};

export function Making({ kind, rows, palette, onStop, handedOff = false, agentWaiting = null }: {
  kind: WaitKind; rows: Row[]; palette?: Palette | null; onStop?: () => void;
  /** 고른 것을 넘긴 뒤. 만드는 일은 채팅의 파이프라인이 하고, 이 화면을 받쳐
      주던 서버는 꺼진다. 그래서 진행은 여기 안 보이고, 그 사실을 말한다. */
  handedOff?: boolean;
  /** 채팅이 기다리고 있었는가. false 면 «저장만 됐어요» 라고 말해야 한다. */
  agentWaiting?: boolean | null;
}) {
  const w = WAIT[kind];
  const elapsed = useElapsed();
  const notes = useNotes();
  const nobody = handedOff && agentWaiting === false;
  const title = nobody ? "고른 것을 저장했어요" : handedOff ? "만들기 시작했어요" : w.title;
  const sub = nobody
    ? "지금은 채팅이 이 프로젝트를 만들고 있지 않아요. 채팅에서 이어 만들 때 이 값을 써요. 이 창은 닫아도 돼요."
    : handedOff ? "고르신 것을 저장했어요. 이제 채팅에서 만들고 있어요. 이 창은 닫아도 돼요." : w.sub;
  return (
    <Shell band={w.band} step={w.step} pct={w.pct} title={title} sub={sub}
      say={<>
        {nobody ? <><strong>채팅이 기다리고 있지 않았어요.</strong> 이 화면은 손으로 띄운 거라, 누른 값은 저장만 됐어요. 채팅에서 «이 프로젝트 발표자료 이어서 만들어 줘»라고 하면 이 값으로 만들어요.<br /></>
          : handedOff ? <><strong>여기서는 진행이 안 보여요.</strong> 이 화면을 받쳐 주던 쪽이 일을 채팅에 넘기고 꺼지거든요. 진행은 채팅에서 보여요.<br /></> : null}
        순서는 이래요.<ol>{w.steps.map((s) => <li key={s}>{s}</li>)}</ol>
        {handedOff ? <>다 되면 채팅에 PPTX 와 PDF 가 와요. 파워포인트에서 글자 하나까지 고칠 수 있게 만들어요.</> : <>끝나는 대로 아래에 채워져요.</>}
      </>}
      side={
        handedOff ? (
          <>
            <Panel label="넘긴 것" kind="memo">
              <ul className="c"><li>색, 분위기, 아이콘</li><li>사진을 어디서 어떻게</li><li>크기, 글씨, 서술 방식</li><li>{rows.length ? `뼈대 ${rows.length}장` : "뼈대"}</li></ul>
            </Panel>
            <Panel label="고칠 게 생기면">
              <div style={{ fontSize: 14, lineHeight: 1.7 }}>채팅에서 «디자인 다시»라고 하면 그 단계로 돌아가요. 앞에서 한 답은 남아요.</div>
            </Panel>
          </>
        ) : (
          <>
            <Panel label="지난 시간">
              <div className="big">{fmt(elapsed)}</div>
              <div className="k">몇 %인지는 적지 않아요. 재는 게 없거든요.<br />무엇을 했는지가 살아 있다는 증거예요.</div>
            </Panel>
            <Panel label="서버가 끊기면">
              <div style={{ fontSize: 14, lineHeight: 1.7 }}>두 번 연속 대답이 없을 때 여기서 말해요.<br />한 번 끊긴 건 알리지 않아요. 결정하는 중에 경고가 번쩍이면 안 되니까요.</div>
            </Panel>
          </>
        )
      }
      footNote={nobody ? "저장됐어요. 이 창은 닫아도 돼요." : handedOff ? "이 창은 닫아도 돼요. 채팅으로 돌아가세요." : notes.length ? notes[notes.length - 1] : "채팅 창의 진행도 여기 함께 보여요"}
      actions={!handedOff && onStop ? [{ label: "멈추기", kind: "ghost", onClick: onStop }] : []}>
      {kind === "final" && rows.length ? (
        <Panel label="결과물 · 채워지는 스토리보드" kind="out">
          <Storyboard rows={rows} palette={palette} done={0} />
          <div className="k">{handedOff ? "장은 채팅에서 만들어져요. 여기 빈 칸은 그 자리예요." : "장이 완성되는 순서는 파이프라인이 아직 알려 주지 않아요. 끝나면 한 번에 채워져요."}</div>
        </Panel>
      ) : null}
      <Panel label="지금까지 한 것">
        <ul className="c" style={{ fontSize: 15, gap: 8 }}>
          {w.done.map((d) => <li key={d}>{d}</li>)}
          {handedOff ? <><li>고른 것 저장</li><li className={nobody ? "todo" : "now"}>{nobody ? "채팅에서 이어 만들기 (아직)" : "채팅에서 만드는 중"}</li>{w.steps.map((s) => <li key={s} className="todo">{s}</li>)}</> : <>
            {notes.map((n, i) => <li key={i} className={i === notes.length - 1 ? "now" : ""}>{n}</li>)}
            {!notes.length ? <li className="now">{w.steps[0]}</li> : null}
            {w.steps.slice(notes.length ? 0 : 1).map((s) => <li key={s} className="todo">{s}</li>)}
          </>}
        </ul>
      </Panel>
    </Shell>
  );
}

const REVERT: [string, string, string][] = [
  ["기획으로 · 내용과 결론", "남아요: 답, 자료", "바뀌어요: 기획서부터 전부"],
  ["뼈대로 · 장 순서와 제목", "남아요: 기획서, 색, 사진", "바뀌어요: 장 구성"],
  ["디자인으로 · 색과 사진", "남아요: 글, 순서, 사진 자리", "바뀌어요: 색, 글꼴, 사진"],
  ["사진만 다시 만들기", "남아요: 전부", "바뀌어요: 사진만"],
];

export function Done({ rows, palette, docToo }: { rows: Row[]; palette?: Palette | null; docToo: boolean }) {
  return (
    <Shell band="발표" step="8 · 완성" pct={100} title="다 정했어요"
      sub={<>고르신 것이 저장됐어요. 이 창을 닫고 채팅으로 돌아가면 파이프라인이 만들기를 이어가요.<br />고칠 게 있으면 채팅에서 «디자인 다시»라고 하면 그 단계로 돌아가요.</>}
      say={<>{rows.length ? <>{rows.length}장, </> : null}{docToo ? "워드 문서와 함께 " : ""}만들어요.<br />다 되면 채팅에 PPTX 와 PDF 가 와요. 파워포인트에서 글자 하나까지 고칠 수 있게 만들어요.</>}
      side={
        <>
          <Panel label="넘기기 전에 볼 것" kind="memo">
            <Empty title="완성되면 여기에 적어요">확인 필요가 남은 장, 잘 나온 장, 걱정되는 장. 지금은 파이프라인이 이 메모를 아직 안 써요.</Empty>
          </Panel>
          <Panel label="검사 결과">
            <ul className="c"><li>결론 = 문서 결론 (뼈대에서 검사)</li><li>글꼴 Pretendard</li><li className="todo">글자 넘침 · 대비는 만든 뒤 검사</li></ul>
          </Panel>
        </>
      }
      footNote="받는 것은 채팅으로 와요. 화면에서 바로 받는 자리는 아직 없어요."
      actions={[{ label: "PPTX 내려받기", kind: "pri", disabled: true }]}>
      <Panel label="결과물 · 발표자료" kind="out">
        {rows.length ? <Storyboard rows={rows} palette={palette} /> : <Empty title="뼈대가 없어서 장을 못 보여줘요" />}
      </Panel>
      <Panel label="고칠 게 있나요">
        <div className="k">처음부터가 아니라 그 단계로. 앞 답은 남아요. 지금은 채팅에서 말해야 해요.</div>
        <div className="grid" style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
          {REVERT.map(([t, keep, change]) => (
            <div className="card" key={t}><div className="nm"><span>{t}</span></div><div className="dt">{keep}<br />{change}</div></div>
          ))}
        </div>
      </Panel>
    </Shell>
  );
}

/** 멈췄을 때. 제 쪽 문제라고 말하고, 무엇이 남았는지부터. */
export function Broken({ reason, kept, onRetry }: { reason: "server" | "load"; kept: string[]; onRetry: () => void }) {
  return (
    <Shell band="발표" step="멈췄을 때" pct={0} title="제 쪽 문제예요"
      sub={<>대표님이 하신 건 다 남아 있어요.<br />다시 해 볼게요.</>}
      say={reason === "server"
        ? <>화면을 받쳐 주는 쪽이 두 번 연속 대답을 안 했어요. 대표님 자료나 설정 때문이 아니에요.<br />고르신 것은 이 화면에 그대로 있어요. 채팅으로 돌아가 화면을 다시 열면 여기서 이어져요.</>
        : <>자료를 읽지 못했어요. 채팅으로 돌아가 다시 시도해 주세요.<br />답하신 것과 기획서는 파일로 남아 있어요.</>}
      side={
        <>
          <Panel label="남아 있는 것">
            {kept.length ? <ul className="c">{kept.map((k) => <li key={k}>{k}</li>)}</ul> : <Empty title="아직 저장된 것이 없어요" />}
          </Panel>
          <Panel label="무슨 일이었나">
            <div style={{ fontSize: 14, lineHeight: 1.7 }}>{reason === "server" ? "심장박동이 두 번 끊겼어요. 기록은 남겨 뒀어요." : "추천 파일이나 목록을 못 읽었어요."}</div>
          </Panel>
        </>
      }
      footNote="다시 연결해 보는 중이에요"
      actions={[{ label: "다시 해 보기", kind: "pri", onClick: onRetry }]}>
      <Panel label="어떻게 할까요">
        <div className="k">추천은 첫 번째예요.</div>
        <div className="grid" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
          <button className="card on" onClick={onRetry}><div className="nm"><span>다시 해 보기</span><span className="tag rec">추천</span></div><div className="dt">여기서 이어져요. 고른 것은 그대로</div></button>
          <div className="card"><div className="nm"><span>채팅으로 돌아가기</span></div><div className="dt">화면을 다시 열면 같은 자리예요</div></div>
        </div>
      </Panel>
    </Shell>
  );
}
