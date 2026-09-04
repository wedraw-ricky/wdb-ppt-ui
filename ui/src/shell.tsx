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

/** 어느 단계에 있는지. 왼쪽 패널이 하던 일을 한 줄이 대신한다. */
export function Steps({ items, at }: { items: string[]; at: number }) {
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
      <h1 className="mb-2 text-[26px] leading-[1.35] font-extrabold tracking-[-0.03em]">{title}</h1>
      {sub ? (
        <p className="mb-7 max-w-[56ch] text-[15px] leading-[1.65]" style={{ color: "var(--muted)" }}>
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
        <h1 className="mt-5 mb-2 text-[23px] font-extrabold tracking-[-0.02em]">{title}</h1>
        {children ? (
          <p className="text-[15px] leading-[1.7]" style={{ color: "var(--muted)" }}>{children}</p>
        ) : null}
      </div>
    </div>
  );
}

/** 눌러 고르는 카드. 테두리는 옅게, 고른 것은 파란 테와 그림자로 알린다 —
    고른 상태를 색 하나로만 말하지 않도록 테두리 굵기도 함께 바뀐다. */
export function pickStyle(on: boolean): React.CSSProperties {
  return {
    background: "var(--surface)",
    borderRadius: "var(--radius-card)",
    border: `1.5px solid ${on ? "var(--accent)" : "var(--border)"}`,
    boxShadow: on
      ? "0 0 0 3px var(--accent-soft), var(--shadow-lift)"
      : "var(--shadow-card)",
  };
}
