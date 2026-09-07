/* 패턴 — 다음 화면을 만들 때 어떤 짜임을 쓰는가.
 *
 * 토큰은 "무슨 값을 쓰는가", 부품은 "무엇을 놓는가", 패턴은 "어떻게 짜는가" 다.
 * 이 셋이 있어야 다음 화면을 만들 때 판단할 게 없다.
 *
 * ── 이 화면이 쓰는 짜임은 넷뿐이다 ──────────────────────────────────
 *
 * ① 묻는 화면        `Shell` + `Ask` + `Pick` (+ 미리보기)
 *    한 번에 한 가지를 묻는다. 인터뷰·디자인 4단계가 이것이다.
 *    아래 고정 버튼이 다음으로 넘긴다.
 *
 * ② 다루는 화면      `Shell wide` + 목록 + 오른쪽 서랍
 *    여럿을 한눈에 보며 하나를 골라 고친다. 뼈대 화면이 이것이다.
 *    안쪽이 각자 스크롤한다 — 바깥이 같이 움직이면 서랍이 밀려 올라간다.
 *
 * ③ 알리는 화면      `Shell wide` + `Mid`
 *    고를 것이 없다. 여는 중·기다리는 중·못 읽음·다 됐어요.
 *    그림 하나 + 무슨 일인지 + (무엇을 하면 되는지).
 *
 * ④ 정해진 것       `Fold`
 *    이미 정해진 것은 **접혀 있다.** 한 줄(이름 · 고른 값 · «바꾸기») 이고,
 *    누르면 펴진다. 아직 안 정한 것만 펴 둔다.
 *
 *    왜: 56개를 같은 무게로 늘어놓는 것은 고르라는 게 아니라 떠넘기는 것이다.
 *    디자이너는 «나머지는 제가 정했습니다» 라고 말하고 바꿀 길만 열어 둔다.
 *
 * ⑤ 비었을 때        `Empty`
 *    있어야 할 것이 없다. **빈 격자를 그냥 두지 않는다** — 쓰는 사람은
 *    고장인지 원래 그런지 모른다. 아래를 반드시 말한다.
 *      · 무엇이 없는지
 *      · 왜 없는지
 *      · 무엇을 하면 되는지 (할 수 있는 게 있을 때만)
 *
 * ── 놓이는 면 ──────────────────────────────────────────────────────
 * 전부 흰 면(`--surface`) 위. 파란 면 위에 놓는 짜임은 이제 없다.
 */

import React from "react";

/** 정해진 것 하나 — 접힌 한 줄. 눌러야 펴진다 (짜임 ④).
 *
 * 닫힌 모습:  ● 색      플래티넘 그레이            바꾸기 ▾
 * 열린 모습:  같은 줄 + 아래에 고르는 자리.
 *
 * 아직 안 정한 것은 `open` 을 처음부터 켜서 보낸다 — 접어 두면 «안 정했다» 는
 * 사실이 화면에서 사라진다. */
export function Fold({ name, value, children, open: openInit = false, warn = false }: {
  /** 무엇을 정하는 자리인지. 두세 글자. */
  name: string;
  /** 지금 정해져 있는 값. 접힌 줄에서 이것만 보인다. */
  value: React.ReactNode;
  children: React.ReactNode;
  open?: boolean;
  /** 아직 안 정했다 — 색만이 아니라 점으로도 말한다 (WCAG 1.4.1). */
  warn?: boolean;
}) {
  const [open, setOpen] = React.useState(openInit);
  return (
    <div className="rounded-[var(--r-md)] border"
         style={{ borderColor: warn ? "var(--warn)" : "var(--line-strong)",
                  background: "var(--surface)" }}>
      <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)}
              className="flex w-full items-center gap-[var(--s-3)] px-[var(--s-5)] text-left"
              style={{ minHeight: "var(--hit-ctl)" }}>
        {warn ? <span aria-hidden="true" style={{ color: "var(--warn)" }}>•</span> : null}
        <span className="t-sub shrink-0" style={{ color: "var(--ink-faint)", minWidth: "6em" }}>
          {name}
        </span>
        <span className="t-card truncate" style={{ color: warn ? "var(--warn)" : "var(--ink)" }}>
          {value}
        </span>
        <span className="t-label ml-auto shrink-0" style={{ color: "var(--accent-ink)" }}>
          {open ? "접기 ▴" : "바꾸기 ▾"}
        </span>
      </button>
      {open ? (
        <div className="border-t px-[var(--s-5)] pb-[var(--s-6)] pt-[var(--s-5)]"
             style={{ borderColor: "var(--line)" }}>
          {children}
        </div>
      ) : null}
    </div>
  );
}

export function Empty({
  title, children, action, compact = false,
}: {
  /** 무엇이 없는지. "아직 없습니다" 가 아니라 무엇이 없는지 이름을 댄다. */
  title: string;
  /** 왜 없는지. 한 줄. */
  children?: React.ReactNode;
  /** 무엇을 하면 되는지. 할 수 있는 게 있을 때만 넣는다. */
  action?: React.ReactNode;
  /** 목록 안에 들어가는 작은 자리면 true. 화면 전체면 false. */
  compact?: boolean;
}) {
  return (
    <div className={compact
            ? "rounded-[var(--r-md)] px-[var(--s-5)] py-[var(--s-6)] text-center"
            : "grid place-items-center rounded-[var(--r-md)] px-[var(--s-6)] py-[var(--s-12)] text-center"}
         style={{ background: "var(--sunken)" }}>
      <div style={{ maxWidth: "var(--measure)" }}>
        <div className={compact ? "t-card" : "t-sect"}>{title}</div>
        {children ? <div className="t-sub mt-2">{children}</div> : null}
        {action ? <div className="mt-[var(--s-4)]">{action}</div> : null}
      </div>
    </div>
  );
}
