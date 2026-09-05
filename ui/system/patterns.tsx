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
 * ④ 비었을 때        `Empty`
 *    있어야 할 것이 없다. **빈 격자를 그냥 두지 않는다** — 쓰는 사람은
 *    고장인지 원래 그런지 모른다. 아래를 반드시 말한다.
 *      · 무엇이 없는지
 *      · 왜 없는지
 *      · 무엇을 하면 되는지 (할 수 있는 게 있을 때만)
 *
 * ── 놓이는 면 ──────────────────────────────────────────────────────
 * 전부 흰 면(`--surface`) 위. 파란 면 위에 놓는 짜임은 이제 없다.
 */

import type React from "react";

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
