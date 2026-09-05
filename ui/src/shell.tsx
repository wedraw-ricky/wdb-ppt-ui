/* 모든 화면이 쓰는 하나의 틀.

   왜 생겼나: 화면마다 골격이 달랐다. 인터뷰는 가운데 한 줄, 뼈대는 왼쪽 흰
   패널 2열, 디자인 확인은 왼쪽 파란 그러데이션 2열. 같은 서비스인데 화면을
   넘길 때마다 다른 물건처럼 보였고, 한 화면만 새로 그려서는 고쳐지지 않았다.

   틀은 셋뿐이다 — 위 얇은 띠, 가운데 본문, 아래 고정 버튼. 진행 상황은 왼쪽
   패널이 아니라 맨 위 3px 막대와 한 줄 글이 맡는다. 그래서 본문이 화면 전체를
   쓴다.

   노트북(1440×900)을 기준 크기로 잡는다. 본문 폭 1040px 는 그 화면에서 한 줄이
   너무 길어지지 않는 값이다 — 한글은 한 줄 45자쯤에서 눈이 다음 줄 첫 글자를
   놓치기 시작한다. */

import type React from "react";

export function Shell({
  where, progress, wide = false, footNote, footActions, children,
}: {
  /** 맨 위 띠에 적히는 "지금 어디" 한 줄. */
  where: string;
  /** 0–100. 맨 위 3px 막대. */
  progress: number;
  /** true 면 본문이 화면 폭을 그대로 쓴다 (뼈대 화면처럼 서랍이 붙는 경우). */
  wide?: boolean;
  footNote?: React.ReactNode;
  footActions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full flex-col" style={{ background: "var(--background)" }}>
      <header className="flex h-[60px] shrink-0 items-center gap-3.5 border-b px-7"
              style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
        <div className="grid h-7 w-7 place-items-center rounded-[9px] text-[11px] font-extrabold"
             style={{ background: "var(--accent)", color: "var(--accent-foreground)" }}>W</div>
        <div className="text-sm font-bold tracking-tight">PPT 만들기</div>
        <div className="h-4 w-px" style={{ background: "var(--border)" }} />
        <div className="truncate text-[13px]" style={{ color: "var(--muted)" }}>{where}</div>
      </header>

      {/* 몇 걸음 왔는지. 숫자를 지어내지 않고 단계 수로만 계산한다. */}
      <div className="h-[3px] shrink-0" style={{ background: "var(--border)" }}>
        <div className="h-[3px] rounded-r-[3px] transition-[width] duration-300"
             style={{ width: `${Math.max(0, Math.min(100, progress))}%`,
                      background: "var(--accent)" }} />
      </div>

      {/* 넓은 화면(뼈대)은 안쪽에서 목록과 서랍이 각자 스크롤한다. 바깥이 같이
          스크롤하면 서랍이 위로 밀려 올라가 편집하다 말고 다시 찾아야 한다. */}
      <div className={wide ? "min-h-0 flex-1 overflow-hidden" : "min-h-0 flex-1 overflow-y-auto"}>
        {wide ? children : <div className="mx-auto max-w-[1040px] px-10 pt-11 pb-6">{children}</div>}
      </div>

      {footNote || footActions ? (
        <footer className="flex h-[76px] shrink-0 items-center border-t px-10"
                style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <div className="text-[13px]" style={{ color: "var(--muted)" }}>{footNote}</div>
          <div className="ml-auto flex items-center gap-2.5">{footActions}</div>
        </footer>
      ) : null}
    </div>
  );
}

/** 어느 단계에 있는지. 왼쪽 패널이 하던 일을 한 줄이 대신한다.
 *
 * 항목이 많으면 늘어놓지 않는다. 열두 개를 한 줄에 밀어 넣었더니 글자가 6px 로
 * 줄고 두 줄로 접혀서, 어디쯤인지 알려주려던 것이 오히려 못 읽는 덩어리가 됐다.
 * 위치는 이미 맨 위 막대가 말하고 있으므로, 많을 때는 지금 것만 이름으로 말한다. */
export function Steps({ items, at }: { items: string[]; at: number }) {
  if (items.length > 6) {
    return (
      <div className="mb-6 flex items-baseline gap-2">
        <span className="text-[12.5px] font-bold tabular-nums" style={{ color: "var(--accent)" }}>
          {at + 1} / {items.length}
        </span>
        <span className="truncate text-[12.5px]" style={{ color: "var(--faint)" }}>
          {items[at]}
        </span>
      </div>
    );
  }
  return (
    <ol className="mb-6 flex items-center gap-1.5">
      {items.map((s, i) => (
        <li key={s} className="flex items-center gap-1.5">
          {i ? <span className="mx-1 h-1 w-1 rounded-full"
                     style={{ background: "#d5dae2" }} aria-hidden="true" /> : null}
          <span className="text-[12.5px]"
                style={i === at
                  ? { color: "var(--accent)", fontWeight: 700 }
                  : { color: "var(--faint)" }}
                aria-current={i === at ? "step" : undefined}>
            {s}
          </span>
        </li>
      ))}
    </ol>
  );
}

/** 큰 질문 하나와 그 아래 설명. 화면마다 같은 크기로 나온다. */
export function Ask({ title, sub }: { title: string; sub?: React.ReactNode }) {
  return (
    <>
      <h1 className="t-page mb-2.5">{title}</h1>
      {sub ? (
        <p className="t-body mb-8 max-w-[56ch]" style={{ color: "var(--muted)" }}>
          {sub}
        </p>
      ) : null}
    </>
  );
}

/** 고를 것이 없는 화면 — 여는 중 · 못 읽음 · 다 됐어요. 틀은 그대로 두고
    가운데만 바뀐다. 세 화면이 서로 다른 물건처럼 보이지 않게. */
export function Mid({ art, title, children }: {
  art?: React.ReactNode; title: string; children?: React.ReactNode;
}) {
  return (
    <div className="grid h-full place-items-center px-8 text-center">
      <div className="max-w-[44ch]">
        {art}
        <h1 className="t-page mt-6 mb-2.5">{title}</h1>
        {children ? (
          <p className="t-body" style={{ color: "var(--muted)" }}>{children}</p>
        ) : null}
      </div>
    </div>
  );
}

/** 눌러 고르는 카드.

    처음엔 옅은 테두리(`--border`)에 그림자를 얹었다. 부드러워 보였지만 그
    테두리는 흰 바탕에서 **1.15:1** 이라, WCAG 1.4.11 이 조작 요소 경계선에
    요구하는 3:1 에 한참 못 미친다. 카드가 어디서 시작하고 끝나는지 저시력
    사용자에게 안 보인다는 뜻이다.

    뼈대 화면은 처음부터 `--border-strong`(3.37:1)에 그림자 없이 그리고 있었다.
    그쪽이 맞았다 — 화면마다 카드가 달라 보이던 것도 이 차이였다. 보이는
    선으로 통일하고, 그림자는 장식이 아니라 **손을 얹었을 때의 반응**으로만 쓴다.

    고른 것은 색 하나로 말하지 않는다: 테두리가 굵어지고(1→2px) 파란 테가
    함께 선다 (WCAG 1.4.1). */
export function pickStyle(on: boolean): React.CSSProperties {
  return {
    background: "var(--surface)",
    borderRadius: "var(--radius-card)",
    border: on ? "2px solid var(--accent)" : "1px solid var(--border-strong)",
    boxShadow: on ? "0 0 0 3px var(--accent-soft)" : "none",
    // 고른 카드가 1px 두꺼워지면서 안쪽이 밀리지 않게
    padding: on ? undefined : undefined,
  };
}
