/* 고르는 카드 — 이 화면에서 무언가를 고르는 자리는 전부 이것이다.
 *
 * 왜 생겼나. 고르는 부품이 일곱 개였다 — 템플릿 · 크기 · 서술 방식 · 아이콘 ·
 * 목록 · 그림 카드 · 이미지 출처. 하는 일은 같은데(격자에 카드를 놓고 하나
 * 또는 여럿을 고른다) 각각 따로 쓰여서, 어떤 것은 그림자가 있고 어떤 것은
 * 없고, 모서리가 제각각이고, 고른 표시도 달랐다. 화면마다 다르게 보이던
 * 이유가 이것이다.
 *
 * 다른 것은 **가운데에 무엇이 들어가느냐** 뿐이다. 그래서 그 자리만 비워 둔다.
 *
 * 놓이는 면: 흰 면(`--surface`) 위. 파란 면 위에는 쓰지 않는다 — 예전에
 * 파란 패널용으로 만든 부품을 흰 화면에 옮겼다가 배경과 같은 색이 되어
 * 사라진 적이 있어서, 부품마다 어디 놓이는지를 적어 둔다.
 */

import type React from "react";
import { pickStyle } from "../src/shell";

export interface PickItem {
  id: string;
  label: string;
  /** 카드 아래 한두 줄. 없으면 이름만 나온다. */
  note?: string;
  /** 카드 위쪽 시각 영역. 그림·도형·비율 상자 무엇이든. */
  art?: React.ReactNode;
  /** 추천 표시. 하나만 붙인다. */
  star?: boolean;
  disabled?: boolean;
}

export function Pick({
  items, value, onChange, multi = false, cols = 3, artHeight = 112,
  ariaLabel,
}: {
  items: PickItem[];
  /** 하나 고르기면 문자열, 여럿이면 배열. */
  value: string | string[];
  onChange: (v: any) => void;
  multi?: boolean;
  cols?: 2 | 3 | 4;
  /** 시각 영역 높이(px). 0 이면 시각 영역 없이 글만. */
  artHeight?: number;
  ariaLabel?: string;
}) {
  const chosen = (id: string) =>
    multi ? (Array.isArray(value) ? value.includes(id) : false) : value === id;

  const toggle = (id: string) => {
    if (!multi) return onChange(id);
    const cur = Array.isArray(value) ? value : [];
    onChange(cur.includes(id) ? cur.filter((v) => v !== id) : [...cur, id]);
  };

  return (
    <div role={multi ? "group" : "radiogroup"} aria-label={ariaLabel}
         className="grid gap-4"
         style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}>
      {items.map((it) => {
        const on = chosen(it.id);
        return (
          <button key={it.id} type="button" disabled={it.disabled}
                  role={multi ? "checkbox" : "radio"}
                  aria-checked={on}
                  onClick={() => toggle(it.id)}
                  className="overflow-hidden p-0 text-left transition disabled:opacity-40"
                  style={pickStyle(on)}>
            {artHeight > 0 ? (
              <div className="grid place-items-center"
                   style={{ height: artHeight, background: "var(--sunken)" }}>
                {it.art}
              </div>
            ) : null}
            <div className="px-[var(--s-4)] pt-[var(--s-4)] pb-[var(--s-4)]">
              <div className="flex items-center gap-1.5">
                <span className="t-card truncate">{it.label}</span>
                {it.star ? <Star /> : null}
              </div>
              {it.note ? <div className="t-sub mt-1.5 line-clamp-3">{it.note}</div> : null}
            </div>
          </button>
        );
      })}
    </div>
  );
}

/** 추천 표시. 색 하나로 말하지 않게 별과 글이 함께 간다 (WCAG 1.4.1). */
export function Star() {
  return (
    <span className="t-label shrink-0 rounded-[var(--r-pill)] px-2 py-0.5"
          style={{ background: "var(--accent-soft)", color: "var(--accent-ink)" }}>
      ★ 추천
    </span>
  );
}
