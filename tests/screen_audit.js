/* 화면 점수 재는 자. 브라우저 안에 넣어 돌린다 — 눈으로 매기지 않는다.
 *
 * 왜 이게 있나: 대비를 눈으로 보고 "3.1:1 쯤" 이라고 말했다가 실제로 재보니
 * 2.52:1 이었던 적이 있다. 사람이 못 보는 것을 사람이 채점하면 안 된다.
 *
 * 네 항목은 대표가 말한 순서 그대로다 — AI 슬롭 · 가독성 · 명확한
 * 비주얼라이징 · 접근성. 셋은 잰 값이고, AI 슬롭은 CLAUDE.md 가 이미 금지한
 * 낱말표를 그대로 쓴다. 내 취향이 점수가 되지 않게.
 *
 * 쓰는 법: 이 파일 내용을 페이지에서 그대로 평가하면 결과가 나온다.
 *     {total, parts:[...], misses:[...]}
 */
(() => {
  const R = (s) => {
    const m = String(s).match(/[\d.]+/g);
    if (!m) return null;
    const [r, g, b, a] = m.map(Number);
    return { r, g, b, a: a === undefined ? 1 : a };
  };
  const lum = ({ r, g, b }) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const ratio = (a, b) => {
    const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
  };
  // 배경이 투명하면 위로 올라가며 무엇이 깔렸는지 찾는다. 안 그러면 흰 바탕
  // 위 흰 글씨를 "대비 1:1" 이 아니라 "배경 없음" 으로 놓친다.
  //
  // 그러데이션도 배경이다. backgroundColor 만 보면 그러데이션 머리띠는
  // "투명" 으로 읽혀 흰 글씨를 흰 바탕과 비교하게 되고, 잘 보이는 글씨가
  // 1.07:1 로 찍힌다. 색 정거장을 모두 꺼내 그중 **제일 불리한 것**으로 잰다.
  const stopsOf = (s) => {
    const out = [];
    const c = R(s.backgroundColor);
    if (c && c.a > 0.01) out.push(c);
    for (const m of (s.backgroundImage || "").matchAll(/rgba?\(([^)]+)\)/g)) {
      const v = R(m[0]);
      if (v && v.a > 0.01) out.push(v);
    }
    return out;
  };
  const blend = (top, under) => ({
    r: top.r * top.a + under.r * (1 - top.a),
    g: top.g * top.a + under.g * (1 - top.a),
    b: top.b * top.a + under.b * (1 - top.a),
    a: 1,
  });
  // 반투명 배경은 건너뛰면 안 된다. rgba(255,255,255,.16) 짜리 동그라미를
  // 없는 셈 치면 그 위 흰 숫자를 파랑 바탕과 재게 되어 3.56:1 이 4.62:1 로
  // 둔갑한다. 위에서 아래로 쌓인 층을 모아 실제로 겹쳐 칠한다.
  const bgOf = (el, fg) => {
    const layers = [];
    for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
      const cand = stopsOf(getComputedStyle(n));
      if (!cand.length) continue;
      layers.push(cand);
      if (cand.every((c) => c.a > 0.99)) break;
    }
    let out = { r: 255, g: 255, b: 255, a: 1 };
    for (let i = layers.length - 1; i >= 0; i--) {
      const painted = layers[i].map((c) => blend(c, out));
      out = fg ? painted.reduce((w, c) => (ratio(fg, c) < ratio(fg, w) ? c : w)) : painted[0];
    }
    return out;
  };
  // 글자에 걸린 opacity 는 대비를 실제로 깎는다. 조상까지 곱해 배경에 얹는다.
  const fade = (el) => {
    let o = 1;
    for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
      o *= +getComputedStyle(n).opacity || 1;
    }
    return o;
  };
  const over = (fg, bg, a) => ({
    r: fg.r * a + bg.r * (1 - a),
    g: fg.g * a + bg.g * (1 - a),
    b: fg.b * a + bg.b * (1 - a),
  });
  const shown = (el) => {
    const s = getComputedStyle(el), r = el.getBoundingClientRect();
    return s.display !== "none" && s.visibility !== "hidden" && +s.opacity > 0.05
      && r.width > 0 && r.height > 0;
  };
  // 대비 규칙(WCAG 1.4.3)이 스스로 빼놓은 둘. 이걸 세면 제대로 만든 화면이
  // 매번 결함으로 나와서, 진짜 안 읽히는 글자가 목록에 묻힌다.
  //   · 꺼져 있는 버튼 — "동작하지 않는 구성요소" 는 규칙 밖이다
  //   · aria-hidden 인 장식 — 읽어주지도 않는 것에 대비를 물을 수 없다
  const exempt = (el) =>
    !!el.closest('[aria-hidden="true"]')
    || !!el.closest("button:disabled, input:disabled, select:disabled, textarea:disabled")
    || !!el.closest('[aria-disabled="true"]');
  const ownText = (el) =>
    [...el.childNodes].filter((n) => n.nodeType === 3)
      .map((n) => n.textContent.trim()).join(" ").trim();

  const misses = [];
  const miss = (part, what, detail) => misses.push({ part, what, detail });

  // ── 가독성 — 잰다 ───────────────────────────────────────────────────
  let textN = 0, textBad = 0, longLine = 0;
  for (const el of document.querySelectorAll("body *")) {
    if (!shown(el) || exempt(el)) continue;
    const t = ownText(el);
    if (!t) continue;
    const s = getComputedStyle(el);
    const size = parseFloat(s.fontSize), weight = +s.fontWeight || 400;
    const big = size >= 24 || (size >= 18.66 && weight >= 700);
    const fg = R(s.color);
    if (fg && fg.a > 0.1) {
      textN++;
      const bg = bgOf(el, fg);
      const got = ratio(over(fg, bg, Math.min(1, fg.a * fade(el))), bg);
      const need = big ? 3 : 4.5;
      if (got < need) {
        textBad++;
        miss("가독성", "글자가 배경에 묻힌다",
          `«${t.slice(0, 24)}» ${got.toFixed(2)}:1 (${need}:1 필요, ${Math.round(size)}px)`);
      }
    }
    // 한 줄이 너무 길면 눈이 다음 줄 첫 글자를 못 찾는다. 한글은 45자쯤이 끝.
    if (t.length > 40 && size > 0) {
      const perLine = el.getBoundingClientRect().width / (size * 0.95);
      if (perLine > 50) {
        longLine++;
        miss("가독성", "한 줄이 너무 길다", `${Math.round(perLine)}자 «${t.slice(0, 20)}»`);
      }
    }
  }

  // ── 접근성 — 잰다 ───────────────────────────────────────────────────
  const hits = [...document.querySelectorAll(
    'button, a[href], input, select, textarea, [role="button"], [role="checkbox"], [tabindex]')]
    .filter(shown);
  let small = 0, unnamed = 0, unreachable = 0;
  for (const el of hits) {
    // 상자가 13px 라도 옆 글자를 눌러 켜진다면 실제로 누르는 곳은 그 줄
    // 전체다. 라벨이 붙어 있으면 라벨 크기로 잰다 — 안 그러면 제대로 만든
    // 체크상자를 매번 결함으로 부른다.
    const box = el.closest("label") || (el.labels && el.labels[0]) || el;
    const r = box.getBoundingClientRect();
    if (r.width < 24 || r.height < 24) {
      small++;
      const who = (el.textContent || el.getAttribute("aria-label") || el.tagName).trim();
      miss("접근성", "누를 곳이 너무 작다",
        `${Math.round(r.width)}×${Math.round(r.height)} «${who.slice(0, 16)}»`);
    }
    const name = (el.textContent || "").trim() || el.getAttribute("aria-label")
      || el.getAttribute("title") || el.querySelector("img[alt]")?.alt
      || (el.labels && el.labels[0] && el.labels[0].textContent.trim());
    if (!name) {
      unnamed++;
      miss("접근성", "이름이 없어 읽어줄 수 없다",
        `<${el.tagName.toLowerCase()}> ${el.className}`.slice(0, 60));
    }
    // 라디오 무리는 하나만 탭으로 들어가고 나머지는 화살표로 오간다. 브라우저가
    // 원래 그렇게 만든 것이라 이걸 결함으로 세면 제대로 만든 무리가 매번 걸린다.
    const inGroup = el.type === "radio" && el.name
      && [...document.getElementsByName(el.name)].some((o) => o.tabIndex >= 0);
    if (el.tabIndex < 0 && !el.disabled && !inGroup) {
      unreachable++;
      miss("접근성", "키보드로 못 간다", String(el.className).slice(0, 50));
    }
  }
  // 누를 수 있는 것의 경계선 (WCAG 1.4.11). 3:1 이 안 되면 카드가 어디서
  // 시작하고 끝나는지 저시력 사용자에게 안 보인다. 그림자로 때운 적이 있어
  // 재기로 했다 — 옅은 테두리는 예뻐 보이지만 경계를 말하지 못한다.
  let faintEdge = 0;
  for (const el of hits) {
    const s = getComputedStyle(el);
    const w = parseFloat(s.borderTopWidth) || 0;
    if (w < 0.5) continue;                     // 테두리로 경계를 말하지 않는 것은 넘어간다
    const line = R(s.borderTopColor);
    if (!line || line.a < 0.5) continue;
    const under = bgOf(el.parentElement || el, line);
    if (ratio(line, under) < 3) {
      faintEdge++;
      miss("접근성", "카드 경계선이 너무 옅다",
        `${ratio(line, under).toFixed(2)}:1 (3:1 필요) «${(el.textContent || "").trim().slice(0, 16)}»`);
    }
  }

  // 색만으로 뜻을 전하는 조각 — 글도 없고 이름도 없는데 색만 칠해진 것
  let colorOnly = 0;
  for (const el of document.querySelectorAll("body *")) {
    if (!shown(el) || el.children.length || (el.textContent || "").trim()) continue;
    const s = getComputedStyle(el), r = el.getBoundingClientRect();
    if (r.width > 40 || r.height > 40 || r.width < 4) continue;
    const bg = R(s.backgroundColor);
    // 스위치 손잡이처럼 이름 있는 조작기 안에 든 색 조각은 색만으로 말하는 게
    // 아니다 — 켜짐은 손잡이 위치와 그 조작기의 상태가 함께 알린다.
    let named = false;
    for (let n = el.parentElement, up = 0; n && up < 4; n = n.parentElement, up++) {
      if (n.querySelector("input, select, textarea, [role='switch'], [role='checkbox']")
          || (n.textContent || "").trim() || n.getAttribute("aria-label")) { named = true; break; }
    }
    if (bg && bg.a > 0.5 && !el.getAttribute("aria-label") && !el.closest("svg") && !named) {
      colorOnly++;
      miss("접근성", "색으로만 알려준다",
        `${Math.round(r.width)}×${Math.round(r.height)} ${el.className}`.slice(0, 50));
    }
  }

  // ── 명확한 비주얼라이징 — 잰다 ──────────────────────────────────────
  // 두 가지를 따로 센다. 하나로 묶으면 "고를 것을 그림으로 보여주는데 아래가
  // 비어서" 점수가 깎여도 무엇을 고쳐야 하는지 알 수 없다.
  //   ① 그림 비율 — 보이는 화면 중 도형·사진이 차지하는 몫
  //   ② 빈 곳    — 화면 아래쪽이 얼마나 놀고 있나
  const area = (el) => {
    const r = el.getBoundingClientRect();
    const w = Math.min(r.right, innerWidth) - Math.max(r.left, 0);
    const h = Math.min(r.bottom, innerHeight) - Math.max(r.top, 0);
    return Math.max(0, w) * Math.max(0, h);
  };
  // 겹쳐 세지 않는다. svg 안의 svg 를 또 더하면 화면의 94% 가 그림이라는
  // 말이 나오고, 그 숫자로는 아무것도 못 고친다.
  const drawn = [...document.querySelectorAll("svg, canvas, img")]
    .filter((el) => shown(el) && !el.parentElement.closest("svg, canvas"))
    .reduce((n, el) => n + area(el), 0);
  const view = Math.max(1, innerWidth * innerHeight);
  const drawShare = drawn / view;

  // 무게중심으로 판단한다. "위쪽 여백" 을 보던 예전 방식은 화면마다 맨 위에
  // 띠가 생기자 죽어버렸다 — 띠도 내용이라 위쪽 여백이 늘 0 이 된다.
  // 내용이 차지한 넓이를 세로 위치로 가중해 평균 낸 값이 무게중심이고,
  // 그게 가운데(0.35~0.65) 근처면 균형 잡힌 화면이다.
  let lowest = 0, mass = 0, moment = 0;
  for (const el of document.querySelectorAll("body *")) {
    if (!shown(el) || el.children.length) continue;
    const r = el.getBoundingClientRect();
    if (r.top >= innerHeight || r.bottom <= 0) continue;
    lowest = Math.max(lowest, Math.min(r.bottom, innerHeight));
    const a = area(el);
    mass += a;
    moment += a * ((Math.max(r.top, 0) + Math.min(r.bottom, innerHeight)) / 2);
  }
  const scrolls = document.documentElement.scrollHeight > innerHeight + 8;
  const below = Math.max(0, (innerHeight - lowest) / innerHeight);
  const centre = mass > 0 ? moment / mass / innerHeight : 0.5;
  const balanced = centre >= 0.35 && centre <= 0.65;
  const emptyBelow = scrolls || balanced ? 0 : below;
  if (emptyBelow > 0.18) {
    miss("비주얼라이징", "화면 아래가 논다",
      `아래 ${Math.round(emptyBelow * 100)}% 가 빈 채로 남는다`);
  }
  // 고를 것이 없는 알림 화면에 "그림으로 보여줘라" 를 똑같이 요구할 수 없다.
  // 보여줄 선택지가 없으면 받쳐주는 그림 하나로 충분하다.
  const choices = document.querySelectorAll(
    'button, a[href], input, select, textarea, [role="button"]').length;
  const drawTarget = choices >= 2 ? 0.18 : 0.05;

  // ── AI 슬롭 — 내 취향이 아니라 CLAUDE.md 의 금지 낱말표 ───────────────
  const BANNED = ["draft", "ready", "mergeable", "체크런", "워크플로", "fast-forward",
    "rebase", "squash", "gitignore", "OOXML", "blocked_on_user", "E2E",
    "다양한 기능", "효율적으로", "최적화된", "혁신적", "손쉽게", "간편하게",
    "완벽한", "강력한", "seamless", "leverage"];
  const visible = [...document.querySelectorAll("body *")].filter(shown)
    .map(ownText).filter(Boolean).join(" ");
  const slop = BANNED.filter((w) => visible.toLowerCase().includes(w.toLowerCase()));
  slop.forEach((w) => miss("AI 슬롭", "쓰지 말자고 한 말이 화면에 있다", `«${w}»`));

  // ── 점수 ────────────────────────────────────────────────────────────
  const clamp = (v, max) => Math.max(0, Math.min(max, v));
  const parts = [
    { name: "가독성", max: 30, got: clamp(30 - textBad * 6 - longLine * 2, 30),
      note: `글 ${textN}군데 중 묻힌 것 ${textBad} · 긴 줄 ${longLine}` },
    { name: "접근성", max: 30,
      got: clamp(30 - small * 4 - unnamed * 4 - unreachable * 6 - colorOnly * 3
                 - Math.min(faintEdge, 4) * 3, 30),
      note: `누를 곳 ${hits.length} · 작음 ${small} · 이름없음 ${unnamed}`
        + ` · 키보드밖 ${unreachable} · 색만 ${colorOnly} · 옅은 경계 ${faintEdge}` },
    { name: "비주얼라이징", max: 20,
      got: clamp(Math.round(Math.min(1, drawShare / drawTarget) * 12)
                 + Math.round(Math.max(0, 1 - emptyBelow / 0.35) * 8), 20),
      note: `그림 ${(drawShare * 100).toFixed(1)}% (${(drawTarget * 100).toFixed(0)}%면 만점)`
        + ` · 아래 빈 곳 ${(emptyBelow * 100).toFixed(0)}%`
        + ` · 무게중심 ${(centre * 100).toFixed(0)}%${balanced ? " (균형)" : ""}` },
    { name: "AI 슬롭", max: 20, got: clamp(20 - slop.length * 7, 20),
      note: slop.length ? slop.join(", ") : "없음" },
  ];
  return { total: parts.reduce((n, p) => n + p.got, 0), parts, misses };
})()
