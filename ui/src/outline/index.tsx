/* 5 뼈대. DESIGN.md «다루는 화면»: 결과물(장 목록)이 제일 크고, 고치는 서랍은
   곁에 있다. 15장을 넘으면 파트가 단위라 목록이 파트별로 들여쓰기 된다.

   outline.md 는 파이프라인이 쓴 것이고 사람이 고친 줄은 edited 표시가 남는다
   (storyline.md §8). 여기서 하는 일은 순서, 병합, 삭제, 추가, 제목·글·모양·
   사진 고치기, 그리고 확정이다. 규칙 검사(checkOutline)는 outline.py --check
   의 거울이라 여기서 새 규칙을 만들지 않는다. */

import { useMemo, useState } from "react";
import { Shell } from "../shell";
import { Panel, Field, Empty, Need, Tag } from "../../system/patterns";
import { Pick } from "../../system/pick";
import { Thumb, parts, isLong } from "../slides";
import {
  type Doc, type Row, addRow, checkOutline, deleteRow, deleteWarning, mergeRows, mergeWarning,
  metaGet, moveRow, patchRow, FLOW_LABELS, SHAPES, SHAPE_GROUPS, IMAGE_USES, ROLE_LABELS,
} from "./model";

const shapeLabel = (id: string) => SHAPES.find((s) => s.id === id)?.label || (id === "cover" ? "표지" : id || "글 위주");
const imageLabel = (id: string) => IMAGE_USES.find((u) => u.id === id)?.label || "안 씀";
const NEED = /확인\s*필요|\[\?\]|TBD/;

export function OutlineEditor({ doc, quote, onConfirm, onBack }: {
  doc: Doc; quote?: string; onConfirm: (rows: Row[]) => Promise<void>; onBack?: () => void;
}) {
  const [rows, setRows] = useState<Row[]>(doc.rows);
  const [sel, setSel] = useState<number>(-1);
  const [picked, setPicked] = useState<number[]>([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const issues = useMemo(() => checkOutline({ ...doc, rows }), [doc, rows]);
  const flow = metaGet(doc, "flow");
  const long = isLong(rows);
  const cur = rows[sel];
  const needs = rows.filter((r) => NEED.test(r.title) || NEED.test(r.screen)).length;
  const chapters = rows.filter((r) => r.role === "chapter").length;

  const patch = (p: Partial<Row>) => setRows((rs) => patchRow(rs, sel, p));
  const togglePick = (i: number) => setPicked((p) => (p.includes(i) ? p.filter((x) => x !== i) : [...p, i]));
  async function confirm() {
    if (issues.some((i) => i.tone === "block")) { setMsg("막힌 검사가 있어요. 오른쪽 «검사»를 봐 주세요."); return; }
    setBusy(true); setMsg("");
    try { await onConfirm(rows); } catch { setMsg("저장이 안 됐어요. 다시 눌러 주세요."); setBusy(false); }
  }

  const rowEl = (r: Row, i: number, indent = "") => {
    const need = NEED.test(r.title) || NEED.test(r.screen);
    const isHead = r.role === "chapter";
    return (
      <button type="button" key={i}
              className={`orow ${isHead ? "head" : ""}${sel === i ? " on" : ""} ${indent}`}
              onClick={() => setSel(i)}>
        <span className="no">{i + 1}</span>
        <div className="th"><Thumb row={r} n={i + 1} painted={false} /></div>
        <div className="tt">
          <div className="t1"><span>{r.title || "제목이 비어 있어요"}</span>{need ? <Need /> : null}{r.edited ? <Tag kind="rec">고침</Tag> : null}</div>
          <div className="k">{ROLE_LABELS[r.role] || r.role}{r.source ? ` · ${r.source}` : ""}</div>
        </div>
        {!isHead ? <><span className="lay">{shapeLabel(r.shape)}</span><span className="lay" style={{ width: 56 }}>{imageLabel(r.image)}</span></> : null}
        <span className={`chip sm${picked.includes(i) ? " on" : ""}`} onClick={(e) => { e.stopPropagation(); togglePick(i); }}>
          {picked.includes(i) ? "골랐음" : isHead ? "이 파트 고치기" : "이 장 고치기"}
        </span>
      </button>
    );
  };

  const list = long
    ? parts(rows).map((p, pi) => {
        const start = rows.indexOf(p.rows[0]);
        return p.rows.map((r, j) => rowEl(r, start + j, p.head && j > 0 ? "indent1" : ""));
      })
    : rows.map((r, i) => rowEl(r, i));

  const say = (
    <>
      «{FLOW_LABELS[flow] || flow || "흐름"}»로 가요.<br />
      {quote ? <>대표님이 «{quote}»라고 하셨으니 여는 장과 닫는 장이 그 말을 되풀이하게 짰어요. </> : null}
      마지막 장의 결론이 <strong>문서의 결론과 같은지</strong> 검사해요.
      {long ? <><br />15장을 넘어서 파트가 단위예요. 간지 {chapters}장, 파트 순서를 바꾸면 그 안의 장이 함께 움직여요.</> : null}
    </>
  );

  return (
    <Shell band="발표" step={long ? "5 · 뼈대 · 15장 이상" : "5 · 뼈대"} pct={58}
      title={long ? `${chapters}부 ${rows.length}장으로 나눴어요` : `${rows.length}장으로 나눴어요`}
      sub={long
        ? <>15장을 넘어서 파트가 단위예요. 파트 순서를 바꾸면 그 안의 장이 함께 움직여요.<br />장은 파트 안에서 고쳐요.</>
        : <>15장 미만이라 파트 없이 한 목록이에요.<br />순서, 병합, 제목은 목록에서 고쳐요. 흐름은 파이프라인이 정했고 여기서는 바꾸지 않아요.</>}
      say={say}
      side={
        <>
          {cur ? (
            <Panel label={<>{sel + 1}장 고치기 <b>{ROLE_LABELS[cur.role] || cur.role}</b></>}>
              <Field label="제목" hint="광고처럼, 숫자는 숫자로" value={cur.title} onChange={(v) => patch({ title: v })} />
              <Field label="화면에 적을 글" value={cur.screen} onChange={(v) => patch({ screen: v })} multiline />
              {cur.role !== "chapter" && cur.role !== "cover" ? (
                <>
                  <div className="lbl">모양</div>
                  <Pick kind="card" cols={2} value={cur.shape} onChange={(v) => patch({ shape: v })}
                        items={SHAPES.filter((s) => s.group === (SHAPES.find((x) => x.id === cur.shape)?.group || "text"))
                          .slice(0, 4).map((s) => ({ id: s.id, label: s.label, note: s.note, thumb: <Thumb row={{ ...cur, shape: s.id }} n={sel + 1} /> }))} />
                  <Pick small items={SHAPE_GROUPS.map((g) => ({ id: g.id, label: g.label }))}
                        value={SHAPES.find((x) => x.id === cur.shape)?.group || "text"}
                        onChange={(g) => patch({ shape: SHAPES.find((s) => s.group === g)?.id || cur.shape })} />
                  <div className="lbl">사진</div>
                  <Pick items={IMAGE_USES.map((u) => ({ id: u.id, label: u.label, note: u.note }))} value={cur.image} onChange={(v) => patch({ image: v })} />
                </>
              ) : null}
              <div className="lbl">왜 이 장인가 <span className="k">· {cur.source || "근거 없음"}</span></div>
              <Field label="발표자 말" value={cur.script} onChange={(v) => patch({ script: v })} multiline />
              <div className="row" style={{ gap: 8 }}>
                <button className="chip sm" onClick={() => setRows((rs) => moveRow(rs, sel, sel - 1))} disabled={sel <= 0}>▲ 위로</button>
                <button className="chip sm" onClick={() => setRows((rs) => moveRow(rs, sel, sel + 1))} disabled={sel >= rows.length - 1}>▼ 아래로</button>
                <button className="chip sm" onClick={() => { const w = deleteWarning(rows, sel); if (w && !window.confirm(w)) return; setRows((rs) => deleteRow(rs, sel)); setSel(-1); }}>이 장 빼기</button>
              </div>
            </Panel>
          ) : (
            <Panel label="고치기">
              <Empty title="목록에서 장을 고르세요">고른 장이 여기 서랍에 열려요. 목록은 그대로예요.</Empty>
            </Panel>
          )}
          <Panel label="검사">
            {issues.length || needs
              ? <ul className="c">
                  {issues.map((i) => <li key={i.code} className={i.tone === "block" ? "bad" : ""}>{i.text}</li>)}
                  {needs ? <li className="bad">{rows.length}장 중 확인 필요 {needs}곳</li> : null}
                </ul>
              : <ul className="c"><li>여는 장, 닫는 장 있음</li><li>제목이 다 채워짐</li>{long ? <li>파트 {chapters}개, 부마다 간지 1장</li> : null}</ul>}
          </Panel>
        </>
      }
      footNote={picked.length >= 2 ? `${picked.length}장을 골랐어요. «두 장 합치기»를 누르면 하나가 돼요.` : "확정하면 «확정한 시각»이 뼈대에 남아요"}
      error={msg}
      actions={[...(onBack ? [{ label: "뒤로", onClick: onBack }] : []), { label: "디자인으로", kind: "pri" as const, onClick: confirm, disabled: busy }]}>
      <Panel label="고르기 · 흐름">
        <Pick items={Object.entries(FLOW_LABELS).map(([id, label]) => ({ id, label, off: id !== flow, note: id !== flow ? "흐름은 기획서에서 정해져요" : "" }))}
              value={flow} onChange={() => {}} />
      </Panel>
      <Panel label={long ? "결과물 · 장 목록, 파트별" : "결과물 · 장 목록"} kind="out">
        {rows.length ? <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>{list}</div>
                     : <Empty title="장이 하나도 없어요">outline.md 가 비어 있어요. 기획서로 돌아가 다시 만들어 주세요.</Empty>}
        <div className="row" style={{ gap: 10 }}>
          <button className="chip" onClick={() => { setRows((rs) => addRow(rs, sel < 0 ? rs.length - 1 : sel)); }}>장 더하기</button>
          <button className="chip" disabled={picked.length < 2}
                  onClick={() => { const w = mergeWarning(rows, picked); if (w && !window.confirm(w)) return; setRows((rs) => mergeRows(rs, picked)); setPicked([]); setSel(-1); }}>두 장 합치기</button>
          <span className="k">합치면 어느 절이 장을 잃는지 미리 말해요</span>
        </div>
      </Panel>
    </Shell>
  );
}
