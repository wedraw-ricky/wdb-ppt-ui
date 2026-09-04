/* The skeleton screen — where a person fixes the deck's spine before a single
   slide is drawn.

   This is the one artefact in the run that decides what the deck *says*, so it
   follows the same rules as the design stages (CLAUDE.md: a rule applied to one
   confirmation stage applies to all of them). Every row draws its own slide
   rather than naming a layout, the left pane carries the single gradient
   surface with a preview that tracks the row in hand, and the screen refuses to
   advance on a fault `outline.py --check` would refuse anyway — the canvas
   mismatch precedent in DESIGN.md.

   It shows and edits. It does not judge: the flow, the layer mapping and the
   section chain were decided by the contract upstream (references/storyline.md). */

import { useMemo, useState } from "react";
import { cardStyle } from "../selectors";
import { SlideArt } from "./art";
import {
  addRow, checkOutline, deleteRow, deleteWarning, FLOW_LABELS, LAYERS,
  mergeRows, mergeWarning, metaGet, moveRow, patchRow, ROLE_LABELS, SHAPES,
  type Doc, type Layer, type Row,
} from "./model";

const shapeLabel = (id: string) =>
  SHAPES.find((s) => s.id === id)?.label ?? id;

/* ---- left pane -------------------------------------------------------- */

function Rail({ rows, current, onPick }: {
  rows: Row[]; current: number; onPick: (i: number) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      {LAYERS.map((layer) => {
        const mine = rows
          .map((r, i) => ({ r, i }))
          .filter(({ r }) => r.layer === layer.id);
        return (
          <div key={layer.id}>
            <div className="flex items-baseline gap-2">
              <span className="text-[13px] font-bold">{layer.label}</span>
              <span className="text-[11px] opacity-70">{layer.note}</span>
              <span className="ml-auto text-[11px] opacity-70">{mine.length}장</span>
            </div>
            <div className="mt-1.5 flex flex-col gap-1 border-l border-white/25 pl-3">
              {mine.length === 0 ? (
                <div className="text-[12px] opacity-60">아직 없습니다</div>
              ) : mine.map(({ r, i }) => (
                <button key={i} type="button" onClick={() => onPick(i)}
                        className="truncate rounded px-1.5 py-0.5 text-left text-[12px] transition"
                        style={{ background: i === current ? "rgba(255,255,255,.18)" : "transparent",
                                 opacity: i === current ? 1 : 0.82 }}>
                  {r.n}. {r.title.trim() || "제목 미정"}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Preview({ row }: { row: Row | undefined }) {
  if (!row) return null;
  return (
    <div className="flex flex-col gap-2">
      <div className="text-xs opacity-80">
        {row.n}번째 장 · {ROLE_LABELS[row.role] || row.role} · {shapeLabel(row.shape)}
      </div>
      <div className="overflow-hidden rounded-lg bg-white/95 p-2">
        <SlideArt shape={row.shape} />
      </div>
      <div className="text-[13px] font-semibold">{row.title.trim() || "제목 미정"}</div>
      {row.screen.trim() ? (
        <div className="whitespace-pre-line text-[12px] leading-relaxed opacity-85">
          {row.screen}
        </div>
      ) : (
        <div className="text-[12px] opacity-70">화면에 넣을 내용은 아직 비어 있습니다</div>
      )}
    </div>
  );
}

/* ---- row -------------------------------------------------------------- */

function RowCard({
  row, index, total, open, picked, onOpen, onPick, onMove, onDelete, children,
}: {
  row: Row; index: number; total: number; open: boolean; picked: boolean;
  onOpen: () => void; onPick: () => void;
  onMove: (to: number) => void; onDelete: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border transition" style={cardStyle(open || picked)}>
      <div className="flex items-stretch gap-3 p-3">
        <div className="flex flex-col items-center justify-center gap-1.5 pl-1">
          <span className="cursor-grab select-none text-[13px] leading-none opacity-45"
                aria-hidden="true">⋮⋮</span>
          <input type="checkbox" checked={picked} onChange={onPick}
                 aria-label={`${row.n}번째 장 선택`} />
        </div>

        <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full
                         text-[11px] font-bold text-white"
              style={{ background: "var(--wdb-secondary)" }}>
          {row.n}
        </span>

        <button type="button" onClick={onOpen}
                className="w-[104px] shrink-0 overflow-hidden rounded-md border"
                style={{ borderColor: "var(--border)" }}
                aria-label={`${row.n}번째 장 펼치기`}>
          <SlideArt shape={row.shape} />
        </button>

        <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
          <div className="flex items-center gap-2">
            <span className="truncate text-[15px] font-semibold">
              {row.title.trim() || "제목 미정"}
            </span>
            {row.edited ? (
              <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                    style={{ background: "var(--wdb-cyan)", color: "var(--wdb-charcoal)" }}>
                고침
              </span>
            ) : null}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px]"
               style={{ color: "var(--muted)" }}>
            <span>{ROLE_LABELS[row.role] || row.role}</span>
            <span aria-hidden="true">·</span>
            <span>{shapeLabel(row.shape)}</span>
            {row.source.trim() ? (
              <>
                <span aria-hidden="true">·</span>
                <span className="truncate">{row.source.split("#").pop()}</span>
              </>
            ) : null}
          </div>
          {!open && row.screen.trim() ? (
            <div className="mt-1.5 line-clamp-2 whitespace-pre-line text-[12px] leading-relaxed"
                 style={{ color: "var(--muted)" }}>
              {row.screen}
            </div>
          ) : null}
        </button>

        <div className="flex shrink-0 flex-col items-end justify-between gap-1">
          <div className="flex gap-1">
            <IconBtn label="위로" disabled={index === 0} onClick={() => onMove(index - 1)}>↑</IconBtn>
            <IconBtn label="아래로" disabled={index === total - 1}
                     onClick={() => onMove(index + 1)}>↓</IconBtn>
          </div>
          <IconBtn label="이 장 지우기" onClick={onDelete}>✕</IconBtn>
        </div>
      </div>
      {open ? <div className="border-t px-3 pb-4 pt-4"
                   style={{ borderColor: "var(--border)" }}>{children}</div> : null}
    </div>
  );
}

function IconBtn({ children, label, onClick, disabled }: {
  children: React.ReactNode; label: string; onClick: () => void; disabled?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={label}
            title={label}
            className="grid h-6 w-6 place-items-center rounded border text-[12px] transition disabled:opacity-30"
            style={{ borderColor: "var(--border)", color: "var(--muted)" }}>
      {children}
    </button>
  );
}

const fieldStyle = {
  borderColor: "var(--border)", background: "var(--surface)",
  color: "var(--foreground)",
} as const;

function Editor({ row, onPatch }: { row: Row; onPatch: (p: Partial<Row>) => void }) {
  return (
    <div className="flex flex-col gap-5">
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-semibold">이 장의 제목</span>
        <input value={row.title} onChange={(e) => onPatch({ title: e.target.value })}
               placeholder="한 줄로 — 이 장이 무슨 말을 하는지"
               className="w-full rounded-lg border px-3 py-2 text-[15px] outline-none"
               style={fieldStyle} />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold">화면에 보이는 글</span>
          <span className="-mt-1 text-[12px]" style={{ color: "var(--muted)" }}>
            청중이 읽는 부분입니다. 3~5줄
          </span>
          <textarea value={row.screen} onChange={(e) => onPatch({ screen: e.target.value })}
                    rows={5} placeholder={"[규제 강화: 체계 정비 요구]\n[내부: 기준이 사람마다 다름]"}
                    className="w-full rounded-lg border px-3 py-2 text-[14px] leading-relaxed outline-none"
                    style={fieldStyle} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold">말로 하는 설명</span>
          <span className="-mt-1 text-[12px]" style={{ color: "var(--muted)" }}>
            발표자가 말하는 부분입니다. 화면 글과 같으면 안 됩니다
          </span>
          <textarea value={row.script} onChange={(e) => onPatch({ script: e.target.value })}
                    rows={5} placeholder="지금 상황을 두 축으로 보시면…"
                    className="w-full rounded-lg border px-3 py-2 text-[14px] leading-relaxed outline-none"
                    style={fieldStyle} />
        </label>
      </div>

      <div>
        <div className="text-[13px] font-semibold">이 장은 어떤 모양으로 만들까요?</div>
        <div className="mt-2 grid gap-2.5"
             style={{ gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))" }}>
          {SHAPES.map((s) => (
            <button key={s.id} type="button" aria-pressed={row.shape === s.id}
                    onClick={() => onPatch({ shape: s.id })}
                    className="overflow-hidden rounded-lg border p-0 text-left transition"
                    style={cardStyle(row.shape === s.id)}>
              <div className="border-b p-1.5" style={{ borderColor: "var(--border)",
                                                       background: "var(--wdb-card-bg)" }}>
                <SlideArt shape={s.id} />
              </div>
              <div className="px-2 py-1.5">
                <div className="text-[12px] font-semibold">{s.label}</div>
                <div className="text-[11px] leading-snug" style={{ color: "var(--muted)" }}>
                  {s.note}
                </div>
              </div>
            </button>
          ))}
        </div>
        {!SHAPES.some((s) => s.id === row.shape) ? (
          <div className="mt-2 text-[12px]" style={{ color: "var(--muted)" }}>
            지금은 <b>{row.shape}</b> 로 되어 있습니다. 위에서 고르면 바뀝니다.
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <div className="text-[13px] font-semibold">이야기의 어느 대목인가요?</div>
          <div className="mt-2 flex gap-2">
            {LAYERS.map((l) => (
              <button key={l.id} type="button" aria-pressed={row.layer === l.id}
                      onClick={() => onPatch({ layer: l.id })}
                      className="rounded-full border px-3 py-1.5 text-[13px] transition"
                      style={cardStyle(row.layer === l.id)}>
                {l.label}
              </button>
            ))}
          </div>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold">이 장의 역할</span>
          <select value={row.role} onChange={(e) => onPatch({ role: e.target.value })}
                  className="w-full rounded-lg border px-3 py-2 text-[14px] outline-none"
                  style={fieldStyle}>
            {Object.entries(ROLE_LABELS).map(([id, label]) => (
              <option key={id} value={id}>{label}</option>
            ))}
          </select>
        </label>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-semibold">어디서 가져온 이야기인가요?</span>
        <span className="-mt-1 text-[12px]" style={{ color: "var(--muted)" }}>
          기획서의 어느 절에서 왔는지. 표지는 비워 둡니다
        </span>
        <input value={row.source} onChange={(e) => onPatch({ source: e.target.value })}
               placeholder="plan_spec.md#현상"
               className="w-full rounded-lg border px-3 py-2 text-[14px] outline-none"
               style={fieldStyle} />
      </label>
    </div>
  );
}

/* ---- screen ----------------------------------------------------------- */

export function OutlineEditor({ doc, onConfirm }: {
  doc: Doc;
  onConfirm: (rows: Row[]) => Promise<void>;
}) {
  const [rows, setRows] = useState<Row[]>(doc.rows);
  const [open, setOpen] = useState<number>(-1);
  const [picked, setPicked] = useState<number[]>([]);
  const [pendingDelete, setPendingDelete] = useState<number>(-1);
  const [dragging, setDragging] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const issues = useMemo(() => checkOutline({ ...doc, rows }), [doc, rows]);
  const blocked = issues.filter((i) => i.tone === "block");
  const flow = metaGet(doc, "flow");
  const current = open >= 0 ? open : 0;

  /** Every mutation runs through here so the selection and the open row cannot
      point at a slide that moved or no longer exists. */
  const apply = (next: Row[], keep = -1) => {
    setRows(next);
    setPicked([]);
    setPendingDelete(-1);
    setOpen(keep);
    setMsg("");
  };

  const move = (from: number, to: number) => {
    if (to < 0 || to >= rows.length) return;
    apply(moveRow(rows, from, to), open === from ? to : -1);
  };

  function doMerge() {
    if (picked.length < 2) return;
    const warn = mergeWarning(rows, picked);
    apply(mergeRows(rows, picked), Math.min(...picked));
    if (warn) setMsg(warn);
  }

  function addAlt() {
    const next = addRow(rows, rows.length - 1);
    const at = next.length - 1;
    apply(patchRow(next, at, {
      role: "proposal_alt", layer: "what" as Layer, title: "2안 — 대안",
      shape: "comparison_columns", source: rows[rows.length - 1]?.source || "",
    }), at);
  }

  async function confirm() {
    if (blocked.length) { setMsg(blocked[0].text); return; }
    setBusy(true);
    try { await onConfirm(rows); }
    catch { setMsg("저장하지 못했습니다. 잠시 뒤 다시 눌러 주세요."); setBusy(false); }
  }

  return (
    <div className="flex h-full">
      <aside className="wdb-hero hidden w-[34%] max-w-[480px] min-w-[340px] flex-col gap-6
                        overflow-y-auto p-7 lg:flex">
        <div className="flex items-center gap-3 border-b border-white/20 pb-4">
          <div className="grid h-9 w-9 place-items-center rounded-lg border border-white/30
                          bg-white/15 text-sm font-bold">PM</div>
          <div>
            <div className="text-[11px] tracking-widest opacity-80">PPT MASTER</div>
            <div className="text-sm font-bold">뼈대 정하기</div>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <div className="text-xs opacity-80">고르신 이야기 흐름</div>
          <div className="text-[13px] font-semibold">
            {FLOW_LABELS[flow] || flow || "—"}
          </div>
          <div className="text-[12px] opacity-75">모두 {rows.length}장</div>
        </div>

        <Rail rows={rows} current={current} onPick={(i) => setOpen(i)} />

        <Preview row={rows[current]} />
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="border-b px-8 py-5"
                style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <h1 className="text-xl font-bold">이 순서로 이야기할까요?</h1>
          <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
            장을 끌어 순서를 바꾸고, 눌러서 안을 고치세요. 여기서 확정한 뼈대가 그대로 슬라이드가 됩니다.
          </p>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-8 py-6">
          {issues.length ? (
            <div className="mb-5 flex flex-col gap-2">
              {issues.map((it) => (
                <div key={it.code + it.text}
                     className="flex items-center gap-3 rounded-lg border px-4 py-2.5 text-[13px]"
                     style={{ borderColor: it.tone === "block" ? "var(--danger)" : "var(--warning)",
                              color: it.tone === "block" ? "var(--danger)" : "var(--warning)",
                              background: "var(--surface)" }}>
                  <span className="font-semibold">
                    {it.tone === "block" ? "고쳐야 넘어갑니다" : "확인해 주세요"}
                  </span>
                  <span style={{ color: "var(--foreground)" }}>{it.text}</span>
                  {it.code === "E-ALT" && it.text.startsWith("2안(대안) 장이 없") ? (
                    <button type="button" onClick={addAlt}
                            className="ml-auto shrink-0 rounded-md px-3 py-1.5 text-[12px]
                                       font-semibold text-white"
                            style={{ background: "var(--wdb-primary)" }}>
                      2안 장 넣기
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}

          <div className="flex flex-col gap-2.5">
            {rows.map((row, i) => {
              const bandStart = i === 0 || rows[i - 1].layer !== row.layer;
              const layer = LAYERS.find((l) => l.id === row.layer);
              return (
                <div key={i}>
                  {bandStart ? (
                    <div className={`mb-2.5 flex items-center gap-3 ${i ? "mt-4" : ""}`}>
                      <span className="text-[13px] font-bold">
                        {layer?.label || row.layer}
                      </span>
                      <span className="text-[12px]" style={{ color: "var(--muted)" }}>
                        {layer?.note}
                      </span>
                      <span className="h-px flex-1" style={{ background: "var(--border)" }} />
                    </div>
                  ) : null}

                  <div
                    draggable={open !== i}
                    onDragStart={() => setDragging(i)}
                    onDragEnd={() => { setDragging(null); setOver(null); }}
                    onDragOver={(e) => { e.preventDefault(); setOver(i); }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (dragging !== null && dragging !== i) move(dragging, i);
                      setDragging(null); setOver(null);
                    }}
                    style={{ opacity: dragging === i ? 0.45 : 1,
                             borderTop: over === i && dragging !== null && dragging !== i
                               ? "2px solid var(--wdb-primary)" : "2px solid transparent" }}
                  >
                    <RowCard
                      row={row} index={i} total={rows.length}
                      open={open === i} picked={picked.includes(i)}
                      onOpen={() => setOpen(open === i ? -1 : i)}
                      onPick={() => setPicked((p) =>
                        p.includes(i) ? p.filter((x) => x !== i) : [...p, i])}
                      onMove={(to) => move(i, to)}
                      onDelete={() => { setPendingDelete(i); setMsg(deleteWarning(rows, i)); }}
                    >
                      <Editor row={row}
                              onPatch={(p) => setRows(patchRow(rows, i, p))} />
                    </RowCard>

                    {pendingDelete === i ? (
                      <div className="mt-1.5 flex items-center gap-3 rounded-lg border px-4 py-2.5
                                      text-[13px]"
                           style={{ borderColor: "var(--danger)", background: "var(--surface)" }}>
                        <span>{row.n}번째 장을 지울까요?</span>
                        <button type="button" onClick={() => apply(deleteRow(rows, i))}
                                className="rounded-md px-3 py-1 text-[12px] font-semibold text-white"
                                style={{ background: "var(--danger)" }}>지웁니다</button>
                        <button type="button" onClick={() => { setPendingDelete(-1); setMsg(""); }}
                                className="rounded-md border px-3 py-1 text-[12px]"
                                style={{ borderColor: "var(--border)" }}>그대로 둡니다</button>
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>

          <button type="button" onClick={() => apply(addRow(rows, rows.length - 1), rows.length)}
                  className="mt-4 w-full rounded-xl border border-dashed py-3 text-[14px] transition"
                  style={{ borderColor: "var(--border)", color: "var(--muted)" }}>
            + 장 추가
          </button>
        </div>

        <footer className="flex items-center gap-3 border-t px-8 py-4"
                style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <button type="button" onClick={doMerge} disabled={picked.length < 2}
                  className="rounded-lg border px-4 py-2 text-[14px] transition disabled:opacity-40"
                  style={{ borderColor: "var(--border)" }}>
            선택한 {picked.length || ""}장 합치기
          </button>
          <span className="min-w-0 flex-1 truncate text-[13px]"
                style={{ color: msg ? "var(--danger)" : "var(--muted)" }}>
            {msg || (picked.length >= 2
              ? mergeWarning(rows, picked) || "고른 장을 한 장으로 합칩니다"
              : `모두 ${rows.length}장 · 고치신 장은 다시 만들어도 그대로 둡니다`)}
          </span>
          <button type="button" onClick={confirm} disabled={busy || blocked.length > 0}
                  className="rounded-lg px-5 py-2.5 text-[15px] font-semibold text-white
                             transition disabled:opacity-40"
                  style={{ background: "var(--wdb-primary)" }}>
            {busy ? "저장하는 중…" : "이 뼈대로 만들기 →"}
          </button>
        </footer>
      </main>
    </div>
  );
}
