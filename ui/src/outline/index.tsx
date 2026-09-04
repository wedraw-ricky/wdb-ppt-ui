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

/* 어디까지 왔나. 장 목록은 오른쪽에 이미 있으므로 여기서 되풀이하지 않는다 —
   같은 15장을 한 화면에 두 번 적으면 덜 쓸모 있는 쪽이 자리를 차지한다. */
const JOURNEY = [
  { id: "intake", label: "무엇을 · 누구에게" },
  { id: "plan", label: "기획서" },
  { id: "outline", label: "뼈대" },
  { id: "design", label: "디자인" },
];

function Journey({ here }: { here: string }) {
  const at = JOURNEY.findIndex((s) => s.id === here);
  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px]">
      {JOURNEY.map((s, i) => (
        <li key={s.id} className="flex items-center gap-2">
          <span className={i === at ? "font-bold" : ""}
                style={{ opacity: i < at ? 0.6 : i === at ? 1 : 0.4 }}>
            {i < at ? "✓ " : ""}{s.label}
          </span>
          {i < JOURNEY.length - 1 ? (
            <span aria-hidden="true" style={{ opacity: 0.35 }}>›</span>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

/* 고른 장 하나를 크게. 이 화면의 약속이 "고르는 걸 그려서 보여준다" 이므로,
   그림이 가장 큰 자리를 갖는다 — 목록 아래로 밀리면 노트북에서는 안 보인다. */
function Detail({ row }: { row: Row | undefined }) {
  if (!row) return null;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline gap-2">
        <span className="text-[13px] font-bold">{row.n}번째 장</span>
        <span className="text-[12px]" style={{ color: "var(--muted)" }}>
          {shapeLabel(row.shape)}
        </span>
      </div>
      <div className="overflow-hidden rounded-lg border"
           style={{ borderColor: "var(--border)" }}>
        <SlideArt shape={row.shape} />
      </div>
      <div className="text-[15px] font-bold leading-snug">
        {row.title.trim() || "제목 미정"}
      </div>
      {row.screen.trim() ? (
        <div className="whitespace-pre-line text-[13px] leading-relaxed"
             style={{ color: "var(--muted)" }}>{row.screen}</div>
      ) : (
        <div className="text-[13px]" style={{ color: "var(--muted)" }}>
          화면에 넣을 내용은 아직 비어 있습니다
        </div>
      )}
    </div>
  );
}

/* ---- row -------------------------------------------------------------- */

/* 한 장 = 스토리보드의 한 컷.

   줄로 늘어놓으면 순서는 읽히지만 흐름이 안 읽힌다 — 이 화면이 묻는 것은
   "이 순서로 이야기할까요" 이므로 여러 장이 한눈에 들어와야 한다. 그래서 컷을
   격자로 놓고, 그림을 카드 너비만큼 키운다. `art.tsx` 는 이미 레이아웃 14종을
   제 도형으로 그리고 있었고, 104px 로 줄여 쓰느라 그 노력이 안 보였다.

   글자로는 절 이름 하나만 쓴다. 모양(글 위주 · 항목 나열)은 그림이 이미 말하고,
   역할은 표지 · 1안 · 2안일 때만 — 본문일 때는 적어도 정보가 늘지 않는다. */
function ChapterCard({
  row, index, total, selected, picked, onOpen, onPick, onMove, onDelete,
}: {
  row: Row; index: number; total: number; selected: boolean; picked: boolean;
  onOpen: () => void; onPick: () => void;
  onMove: (to: number) => void; onDelete: () => void;
}) {
  const roleBadge = row.role !== "body" ? (ROLE_LABELS[row.role] || row.role) : "";
  // 절 이름이 제목과 같은 말이면 두 번 쓰지 않는다 — 잉크만 늘고 아는 것은 그대로다.
  const source = row.source.split("#").pop() || "";
  const sourceLabel = source && source !== row.title.trim() ? source : "";
  return (
    <div className="group relative flex flex-col gap-2 rounded-lg border p-2 transition"
         style={{
           borderColor: selected ? "var(--wdb-primary)" : "var(--border)",
           borderWidth: selected ? 2 : 1,
           padding: selected ? 7 : 8,
           background: "var(--surface)",
         }}>
      <button type="button" onClick={onOpen}
              className="overflow-hidden rounded-md border text-left"
              style={{ borderColor: "var(--border)" }}
              aria-label={`${row.n}번째 장 고르기`} aria-pressed={selected}>
        <SlideArt shape={row.shape} />
      </button>

      <span className="pointer-events-none absolute left-3.5 top-3.5 grid h-5 w-5
                       place-items-center rounded text-[10px] font-bold text-white"
            style={{ background: "var(--wdb-secondary)" }}>{row.n}</span>

      <div className="flex min-w-0 flex-col gap-0.5 px-0.5">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-[14px] font-semibold leading-snug">
            {row.title.trim() || "제목 미정"}
          </span>
          {row.edited ? (
            <span className="shrink-0 rounded px-1.5 text-[10px] font-semibold"
                  style={{ background: "var(--wdb-cyan)", color: "var(--wdb-charcoal)" }}>
              고침
            </span>
          ) : null}
        </div>
        {roleBadge || sourceLabel ? (
          <div className="flex items-center gap-1.5 text-[12px]"
               style={{ color: "var(--muted)" }}>
            {roleBadge ? (
              <span className="rounded px-1.5 font-semibold"
                    style={{ background: "var(--wdb-card-bg)", color: "var(--wdb-secondary)" }}>
                {roleBadge}
              </span>
            ) : null}
            {sourceLabel ? <span className="truncate">{sourceLabel}</span> : null}
          </div>
        ) : null}
      </div>

      {/* 손대는 장에만 보인다. 45개가 늘 떠 있으면 눈이 갈 곳이 45군데가 된다. */}
      <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition
                      group-hover:opacity-100 group-focus-within:opacity-100">
        <IconBtn label="앞으로" disabled={index === 0}
                 onClick={() => onMove(index - 1)}>←</IconBtn>
        <IconBtn label="뒤로" disabled={index === total - 1}
                 onClick={() => onMove(index + 1)}>→</IconBtn>
        <IconBtn label="이 장 지우기" onClick={onDelete}>✕</IconBtn>
      </div>

      <label className="absolute bottom-2 right-2 flex items-center gap-1 text-[11px]
                        opacity-0 transition group-hover:opacity-100
                        group-focus-within:opacity-100 has-[:checked]:opacity-100"
             style={{ color: "var(--muted)" }}>
        <input type="checkbox" checked={picked} onChange={onPick}
               aria-label={`${row.n}번째 장 선택`} />
        합치기
      </label>
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

      <div className="grid gap-4">
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

      <div className="grid gap-4">
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
      {/* 왼쪽은 "지금 손대는 장" 하나만 맡는다. 장 목록은 오른쪽에 있고,
          그라데이션은 브랜드를 알리는 얇은 띠로만 남긴다 — 판 전체를 덮는
          장식 그라데이션은 정보를 나르지 않으면서 그 위 글자를 읽기 어렵게 한다. */}
      <aside className="hidden w-[420px] shrink-0 flex-col overflow-y-auto border-r lg:flex"
             style={{ borderColor: "var(--border)", background: "var(--background)" }}>
        <div className="wdb-hero flex items-center gap-3 px-6 py-4">
          <div className="grid h-8 w-8 place-items-center rounded-lg border border-white/30
                          bg-white/15 text-[12px] font-bold">PM</div>
          <div className="min-w-0">
            <div className="text-[10px] tracking-widest opacity-80">PPT MASTER</div>
            <div className="truncate text-[13px] font-bold">뼈대 정하기</div>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-b px-6 py-4"
             style={{ borderColor: "var(--border)" }}>
          <Journey here="outline" />
          <div className="flex flex-wrap items-baseline gap-x-2 text-[12px]"
               style={{ color: "var(--muted)" }}>
            <span>이야기 흐름</span>
            <span className="font-semibold" style={{ color: "var(--foreground)" }}>
              {FLOW_LABELS[flow] || flow || "—"}
            </span>
            <span aria-hidden="true">·</span>
            <span>모두 {rows.length}장</span>
          </div>
        </div>

        <div className="flex flex-col gap-5 px-6 py-5">
          <Detail row={rows[current]} />
          {rows[current] ? (
            <div className="border-t pt-5" style={{ borderColor: "var(--border)" }}>
              <Editor row={rows[current]}
                      onPatch={(p) => setRows(patchRow(rows, current, p))} />
            </div>
          ) : null}
        </div>
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

          {/* Why · How · What 을 띠로 묶고 그 안에 컷을 늘어놓는다. 15개가 각자
              테두리를 두르면 정작 묶여야 할 세 덩어리의 경계가 안 보인다. */}
          <div className="flex flex-col gap-7">
            {LAYERS.map((layer) => {
              const items = rows
                .map((row, i) => ({ row, i }))
                .filter(({ row }) => row.layer === layer.id);
              if (!items.length) return null;
              return (
                <section key={layer.id} className="flex flex-col gap-3">
                  <header className="flex items-baseline gap-3">
                    <h2 className="text-[14px] font-bold">{layer.label}</h2>
                    <span className="text-[12px]" style={{ color: "var(--muted)" }}>
                      {layer.note}
                    </span>
                    <span className="h-px flex-1" style={{ background: "var(--border)" }} />
                    <span className="text-[12px] tabular-nums" style={{ color: "var(--muted)" }}>
                      {items.length}장
                    </span>
                  </header>

                  <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
                    {items.map(({ row, i }) => (
                      <div key={i}
                           draggable
                           onDragStart={() => setDragging(i)}
                           onDragEnd={() => { setDragging(null); setOver(null); }}
                           onDragOver={(e) => { e.preventDefault(); setOver(i); }}
                           onDrop={(e) => {
                             e.preventDefault();
                             if (dragging !== null && dragging !== i) move(dragging, i);
                             setDragging(null); setOver(null);
                           }}
                           style={{
                             opacity: dragging === i ? 0.4 : 1,
                             outline: over === i && dragging !== null && dragging !== i
                               ? "2px solid var(--wdb-primary)" : "none",
                             outlineOffset: 2, borderRadius: 10,
                           }}>
                        <ChapterCard
                          row={row} index={i} total={rows.length}
                          selected={current === i} picked={picked.includes(i)}
                          onOpen={() => setOpen(i)}
                          onPick={() => setPicked((q) =>
                            q.includes(i) ? q.filter((x) => x !== i) : [...q, i])}
                          onMove={(to) => move(i, to)}
                          onDelete={() => { setPendingDelete(i); setMsg(deleteWarning(rows, i)); }}
                        />
                        {pendingDelete === i ? (
                          <div className="mt-1.5 flex flex-wrap items-center gap-2 rounded-lg
                                          border px-3 py-2 text-[12px]"
                               style={{ borderColor: "var(--danger)", background: "var(--surface)" }}>
                            <span>{row.n}번째 장을 지울까요?</span>
                            <button type="button" onClick={() => apply(deleteRow(rows, i))}
                                    className="rounded-md px-2.5 py-1 text-[11px] font-semibold text-white"
                                    style={{ background: "var(--danger)" }}>지웁니다</button>
                            <button type="button"
                                    onClick={() => { setPendingDelete(-1); setMsg(""); }}
                                    className="rounded-md border px-2.5 py-1 text-[11px]"
                                    style={{ borderColor: "var(--border)" }}>그대로 둡니다</button>
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </section>
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
