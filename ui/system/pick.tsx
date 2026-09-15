/* 고르는 부품은 이것 하나다.

   고르는 부품이 일곱이던 때가 있었다. 하는 일은 같은데 각각 따로 쓰여서
   그림자·모서리·고른 표시가 제각각이었다. 지금은 모양이 둘뿐이다.

   - chip: 이름만으로 고를 수 있을 때 (크기, 서술 방식, 만드는 방식).
   - card: 보고 골라야 할 때 (색, 분위기, 사진 느낌, 장 모양). 축소판은 늘 16:9.

   놓이는 면: 흰 판(--white) 위. 종이(--paper) 위에 바로 놓으면 칩의 흰 면이
   판처럼 보이니 판 안에서만 쓴다. 남색 무대 위에는 놓지 않는다.

   추천은 골드 꼬리표 하나로만 말한다. 고른 것은 남색이다. 둘이 다른 색인
   이유는 «추천을 골랐다» 와 «추천이지만 안 골랐다» 가 한눈에 갈려야 해서다. */

import type React from "react";
import { Empty, Tag } from "./patterns";

export interface PickItem {
  id: string;
  label: string;
  /** 카드 아래 한 줄 설명. 칩에는 안 보인다. */
  note?: string;
  /** 카드의 16:9 축소판. 없으면 카드가 이름만 있는 카드가 된다. */
  thumb?: React.ReactNode;
  /** 지금은 고를 수 없음 (점선). 이유는 note 에. */
  off?: boolean;
}

export function Pick({ items, value, onChange, kind = "chip", cols = 4, recommended, multi = false, small = false, emptyTitle = "고를 것이 없어요", emptyNote }: {
  items: PickItem[];
  /** 하나면 id, 여럿이면 id 배열. */
  value: string | string[] | null | undefined;
  onChange: (next: any) => void;
  kind?: "chip" | "card";
  cols?: number;
  recommended?: string | string[] | null;
  multi?: boolean;
  small?: boolean;
  emptyTitle?: string;
  emptyNote?: string;
}) {
  if (!items.length) return <Empty title={emptyTitle}>{emptyNote}</Empty>;
  const picked = new Set(Array.isArray(value) ? value.map(String) : value ? [String(value)] : []);
  const rec = new Set(Array.isArray(recommended) ? recommended.map(String) : recommended ? [String(recommended)] : []);
  const toggle = (id: string) => {
    if (!multi) { onChange(id); return; }
    const next = new Set(picked);
    if (next.has(id)) next.delete(id); else next.add(id);
    onChange([...next]);
  };
  if (kind === "chip") {
    return (
      <div className="row" style={{ gap: "var(--gap-chip)" }} role={multi ? "group" : "radiogroup"}>
        {items.map((it) => (
          <button key={it.id} type="button" disabled={it.off} title={it.note}
                  role={multi ? "checkbox" : "radio"} aria-checked={picked.has(it.id)}
                  className={`chip${picked.has(it.id) ? " on" : ""}${it.off ? " off" : ""}${small ? " sm" : ""}`}
                  onClick={() => toggle(it.id)}>
            {it.label}
          </button>
        ))}
      </div>
    );
  }
  return (
    <div className="grid" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }} role={multi ? "group" : "radiogroup"}>
      {items.map((it) => (
        <button key={it.id} type="button" disabled={it.off}
                role={multi ? "checkbox" : "radio"} aria-checked={picked.has(it.id)}
                className={`card${picked.has(it.id) ? " on" : ""}`} onClick={() => toggle(it.id)}>
          {it.thumb !== undefined ? <div className="th">{it.thumb}</div> : null}
          <div className="nm">
            <span>{it.label}</span>
            {rec.has(it.id) ? <Tag kind="rec">추천</Tag> : null}
          </div>
          {it.note ? <div className="dt">{it.note}</div> : null}
        </button>
      ))}
    </div>
  );
}
