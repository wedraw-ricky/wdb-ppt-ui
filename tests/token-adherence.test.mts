/* 토큰을 실제로 쓰고 있는가.
 *
 * 카드가 두 종류였고, 모서리가 8·12·20px 로 갈렸고, 경계선이 어떤 데는
 * 1.15:1 이고 어떤 데는 3.37:1 이었다. 값을 화면 코드에 직접 적으면 그렇게
 * 된다 — 고칠 때 한 곳만 고치고 나머지를 못 찾는다.
 *
 * 이 검사는 `ui/system/tokens.css` 밖에서 값을 직접 쓴 곳을 잡는다.
 *
 * Usage:
 *     node --test --experimental-strip-types tests/
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("../ui/src", import.meta.url).pathname;
const TOKENS = new URL("../ui/system/tokens.css", import.meta.url).pathname;

function sources(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...sources(p));
    else if (/\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

/** 주석은 뺀다 — 왜 이 값을 안 쓰는지 설명하는 자리라 값이 등장한다. */
function codeLines(file: string): { n: number; text: string }[] {
  const out: { n: number; text: string }[] = [];
  let inBlock = false;
  readFileSync(file, "utf8").split("\n").forEach((raw, i) => {
    let line = raw;
    if (inBlock) {
      const end = line.indexOf("*/");
      if (end < 0) return;
      line = line.slice(end + 2);
      inBlock = false;
    }
    const open = line.indexOf("/*");
    if (open >= 0) {
      const end = line.indexOf("*/", open + 2);
      if (end < 0) { inBlock = true; line = line.slice(0, open); }
      else line = line.slice(0, open) + line.slice(end + 2);
    }
    const slash = line.indexOf("//");
    if (slash >= 0) line = line.slice(0, slash);
    if (line.trim()) out.push({ n: i + 1, text: line });
  });
  return out;
}

const FILES = sources(ROOT);

describe("토큰을 쓰고 있는가", () => {
  it("화면 코드에 색을 직접 쓰지 않는다", () => {
    // 덱 팔레트 대체값은 화면 토큰이 아니라 데이터다 — 사용자가 아직 색을
    // 안 골랐을 때 미리보기가 보여줄 값이라 다른 물건이고, 한 곳에 모아
    // DECK_FALLBACK 이라 이름 붙여 두었다.
    const DATA_CONST = /DECK_FALLBACK\s*=|DECK_FALLBACK\./;
    const bad: string[] = [];
    for (const f of FILES) {
      let inFallback = false;
      for (const { n, text } of codeLines(f)) {
        if (DATA_CONST.test(text)) inFallback = true;
        if (inFallback && text.includes("} as const;")) { inFallback = false; continue; }
        if (inFallback) continue;
        if (/#[0-9a-fA-F]{3,8}\b|rgba?\(\s*\d/.test(text)) {
          bad.push(`${f.split("/ui/src/")[1]}:${n}  ${text.trim().slice(0, 60)}`);
        }
      }
    }
    assert.deepEqual(bad, [], `색을 직접 쓴 곳 — ui/system/tokens.css 에 넣고 var() 로 부른다:\n${bad.join("\n")}`);
  });

  it("토큰 파일이 여덟 갈래를 다 갖고 있다", () => {
    // 여백·선 굵기·누름 크기가 없어서 h-[50px]·px-[18px] 같은 값이 흩어졌다.
    const css = readFileSync(TOKENS, "utf8");
    for (const need of ["--brand-blue", "--ink", "--line-strong", "--accent",
                        "--warn", "--t-body1-size", "--s-4", "--r-md",
                        "--w-hair", "--shadow-hover", "--hit-min", "--measure"]) {
      assert.ok(css.includes(need), `토큰 ${need} 이 없다`);
    }
  });

  it("같은 값이 두 곳에 적혀 있지 않다", () => {
    // theme.css 가 값을 복사해 두던 시절이 있었다. 그러면 한쪽만 고치게 된다.
    const theme = readFileSync(new URL("../ui/src/theme.css", import.meta.url).pathname, "utf8");
    const declared = [...theme.matchAll(/^\s*(--[\w-]+):\s*([^;]+);/gm)]
      .filter(([, , v]) => !v.trim().startsWith("var(") && !v.includes("none"))
      .map(([, k]) => k);
    assert.deepEqual(declared, [],
      `theme.css 는 이름만 잇는 곳이다 — 값은 tokens.css 에 둔다: ${declared.join(", ")}`);
  });
});

describe("부품을 쓰고 있는가", () => {
  it("고르는 자리는 전부 Pick 을 거친다", () => {
    // 고르는 부품이 일곱 개였다 — 하는 일은 같은데 각각 따로 쓰여서 그림자·
    // 모서리·고른 표시가 제각각이었다. 화면마다 다르게 보이던 이유가 이것이다.
    const CHOOSERS = ["ThumbChoice", "RatioChoice", "DiagramChoice", "IconChoice",
                      "Choice", "ArtChoice", "ImageSourceChoice"];
    const bad: string[] = [];
    for (const f of FILES) {
      const src = readFileSync(f, "utf8");
      for (const name of CHOOSERS) {
        const i = src.indexOf(`export function ${name}(`);
        if (i < 0) continue;
        // 그 함수 안에 <Pick 이 있어야 한다
        const next = src.indexOf("\nexport ", i + 10);
        const body = src.slice(i, next < 0 ? undefined : next);
        if (!body.includes("<Pick")) bad.push(`${f.split("/ui/src/")[1]}  ${name}`);
      }
    }
    assert.deepEqual(bad, [], `Pick 을 안 쓰는 고르기 부품:\n${bad.join("\n")}`);
  });

  it("부품마다 어디 놓이는지가 적혀 있다", () => {
    // 파란 패널용으로 만든 부품을 흰 화면에 옮겼더니 배경과 같은 색이 되어
    // 사라진 적이 있다. 놓이는 면을 안 적어서 옮길 때 아무도 몰랐다.
    const pick = readFileSync(new URL("../ui/system/pick.tsx", import.meta.url).pathname, "utf8");
    assert.ok(pick.includes("놓이는 면"), "pick.tsx 에 놓이는 면이 안 적혀 있다");
  });
});

describe("패턴을 지키고 있는가", () => {
  it("네 가지 짜임이 적혀 있다", () => {
    // 토큰은 "무슨 값", 부품은 "무엇을 놓는가", 패턴은 "어떻게 짜는가".
    // 셋이 다 있어야 다음 화면을 만들 때 판단할 게 없다.
    const src = readFileSync(new URL("../ui/system/patterns.tsx", import.meta.url).pathname, "utf8");
    for (const need of ["묻는 화면", "다루는 화면", "알리는 화면", "비었을 때"]) {
      assert.ok(src.includes(need), `패턴 «${need}» 이 안 적혀 있다`);
    }
  });

  it("목록을 그리는 곳은 빈 경우를 말한다", () => {
    // 빈 격자를 그냥 두면 쓰는 사람은 고장인지 원래 그런지 모른다.
    const pick = readFileSync(new URL("../ui/system/pick.tsx", import.meta.url).pathname, "utf8");
    assert.ok(/!items\.length/.test(pick) && pick.includes("<Empty"),
      "Pick 이 빈 경우를 말하지 않는다");
    const board = readFileSync(new URL("../ui/src/outline/index.tsx", import.meta.url).pathname, "utf8");
    assert.ok(board.includes("<Empty"), "뼈대 화면이 빈 경우를 말하지 않는다");
  });
});
