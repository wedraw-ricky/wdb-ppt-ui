# WDB Confirm UI

**ppt-master** 파이프라인의 "디자인 정하기" 확인 화면을 위드비 스타일로 갈아 끼운
오버레이입니다. 슬라이드를 만드는 엔진이 아니라, 만들기 직전에 **무엇을 어떻게
만들지 고르는 화면**입니다.

<p align="center">
  <em>1단계 무엇을·누구에게 → 2단계 어떻게 보이게 → 3단계 이미지</em>
</p>

## 이 저장소가 하는 일

원본(upstream)을 **한 줄도 고치지 않습니다.** `server.py`가 원본의 확인 서버를
import한 뒤 네 가지만 딴 데로 돌려놓고 제어권을 그대로 돌려줍니다. 그래서 잠금
파일, 포트 탐색, `--daemon` / `--wait` / `--shutdown` 수명주기, `/api/*` 경로,
`recommendations.json` → `result.json` 계약이 전부 원본 그대로 상속됩니다.

| 돌려놓는 것 | 이유 |
|---|---|
| `server.__file__` | 원본은 서빙용 자식 프로세스를 자기 파일로 다시 띄웁니다. 그 외의 `__file__` 사용처는 전부 import 시점 상수라, import 뒤에 바꾸면 이 자식 프로세스만 우리 쪽으로 옵니다 |
| `_CATALOGS_PATH` | 모듈 상수라 그냥 두면 `/api/catalogs`가 계속 원본 카탈로그를 내보냅니다 |
| `app.static_folder` + 정적 뷰 | 우리 파일을 먼저 주고, 우리가 안 바꾼 건 원본으로 넘깁니다 (`style_previews/` 같은 건 자동으로 최신 유지) |
| `_DECKS_DIR` | 우리 덱과 원본 덱을 `.decks-merged/`로 합쳐 템플릿 카드에 함께 띄웁니다 |

## 처음부터 설치 (실습생용)

준비물: **Python 3.10 이상**, git, Claude Code. macOS 기준입니다.
(파이프라인 스크립트가 `str | None` 문법을 쓰기 때문에 3.9에서는 동작하지 않습니다.)

```bash
# 1. 이 저장소 하나만 받으면 됩니다 (파이프라인이 안에 들어 있습니다)
git clone https://github.com/wedraw-ricky/wdb-ppt-ui.git ~/dev/wdb-ppt-ui

# 2. 파이썬 패키지
#    python-pptx / Pillow 가 없으면 PPTX 내보내기 자체가 실패합니다.
python3 -m pip install python-pptx Pillow flask numpy requests
```

경로를 연결하는 설정 단계는 없습니다. 파이프라인이 `.claude/skills/ppt-master/`
안에 함께 들어 있어서 저장소가 스스로를 찾습니다.

### 설치가 됐는지 확인

```bash
python3 ~/dev/wdb-ppt-ui/.claude/skills/ppt-master/scripts/preflight.py
```

`[preflight] PASS — environment ready` 가 나오면 정상입니다. 빠진 패키지가 있으면
`pip install <이름>` 형태로 무엇을 깔아야 하는지 그대로 알려줍니다.

### 쓰는 법

Claude Code를 이 폴더에서 열고 자료를 주면서 PPT를 만들어 달라고 하면 됩니다.
`.claude/skills/` 안의 스킬을 Claude Code가 자동으로 찾습니다.

확인 화면은 덱 작업이 시작되면 자동으로 뜹니다. 직접 띄우려면:

```bash
python3 server.py projects/<프로젝트> --daemon
```

### 선택 사항

- `playwright` — 6단계 픽셀 검사와 시각 리뷰에 쓰입니다. 없으면 그 단계만 건너뜁니다.
  `python3 -m pip install playwright && python3 -m playwright install chromium`

### 서체

UI 미리보기용 Paperlogy는 저장소에 웹폰트로 들어 있어 따로 설치할 필요가 없습니다.
다만 **덱을 PPTX로 뽑을 때는** 쓰는 서체가 PC에 설치돼 있어야 합니다 — PPTX는
서체를 파일에 품지 않기 때문입니다.

## 실행

원본과 같은 인자를 씁니다.

```bash
python3 server.py <프로젝트경로> --daemon --wait
python3 server.py <프로젝트경로> --shutdown
```

## 덱 템플릿

`decks/`에 이 오버레이가 추가하는 덱 템플릿이 있습니다. `server.py`가 원본 덱과
심볼릭 링크로 합쳐 `.decks-merged/`를 만들고 `_DECKS_DIR`을 그쪽으로 돌리기 때문에,
원본 저장소에 파일 하나 넣지 않고도 템플릿 카드에 뜹니다.

| 덱 | 쪽수 | 출처 |
|---|---|---|
| `withby-green` | 9 | `withb-green-design` 스킬에서 이식. 아키타입 A–I, 좌표는 원본 19장짜리 PPTX에서 실측 |

## 화면 설계 원칙

한 줄로 요약하면 **"고르는 대상을 그려서 보여준다. 목록으로 설명하지 않는다."**
전체 규칙과 결정 기록은 [`DESIGN.md`](DESIGN.md)에 있습니다.

| 고르는 것 | 화면에 보이는 것 |
|---|---|
| 덱 템플릿 | 그 덱의 첫 장을 실제로 렌더한 썸네일 |
| 화면 크기 | 진짜 비율로 그린 사각형 |
| 색 | **그 색으로 칠한 미니 슬라이드** |
| 글꼴 | 제목→부제목→본문→주석 **실제 급수 사다리** |
| 쪽수 | 길이 칩 + 쪽 수만큼의 눈금 |
| 이미지 출처 | 그 출처가 만들어내는 그림 샘플 |
| 설명 방식 | 논리 구조를 그린 다이어그램 |

## UI 코드

React 19 + HeroUI v3 + Tailwind v4 앱이 `ui/`에 있고, 빌드 결과가 `static/app/`에
**커밋되어 있습니다.** 서버를 띄우는 PC에서 `npm install`을 하지 않아도 오프라인으로
동작합니다.

```bash
cd ui && npm install      # UI를 고칠 때만
npx vite build            # -> static/app/confirm.js + confirm.css
```

`ui/src/api.ts`가 계약(상태 구조·단계별 payload·검증)을 컴포넌트와 분리해 들고
있습니다. 이 분리 덕분에 화면을 React로 다시 만들 때 `result.json`을 이전 화면 결과와
비교하는 것만으로 검증이 가능했습니다.

위드비 토큰은 `ui/src/theme.css`에서 HeroUI의 의미 변수(`--accent`, `--background`,
`--surface` …)에 매핑됩니다. 컴포넌트마다 색을 지정하지 않아도 브랜드가 전파됩니다.

이전 바닐라 화면도 `static/`에 남아 있습니다(`app.js`, `style.css`).
`static/index.html`을 그쪽으로 되돌리면 폴백됩니다.

## 폴더 구조

```
.claude/skills/ppt-master/   파이프라인 (원저작 Hugo He · byungjunjang)
server.py     진입점 — 확인 화면을 우리 것으로 바꿔 파이프라인 서버를 띄운다
ui/           React 소스
static/       빌드 결과 · 폰트 · 카탈로그 · 이전 바닐라 화면
decks/        오버레이 덱 템플릿
DESIGN.md     화면 설계 계약과 결정 기록
```

`static/`에 없는 파일은 원본으로 넘어가므로, 이 저장소는 **실제로 바꾼 것만** 들고
있습니다.

## 만든 사람들 · 기반이 된 작업

이 저장소는 혼자 선 물건이 아닙니다. 아래 작업들이 없으면 동작하지 않습니다.

| 무엇 | 만든 사람 | 라이선스 | 관계 |
|---|---|---|---|
| **ppt-master 파이프라인** — 문서를 SVG로 만들고 네이티브 PPTX로 내보내는 엔진 전체. `.claude/skills/` 아래 그대로 들어 있습니다 | **Hugo He** (LICENSE 표기) · 한국어 적응과 커밋 이력은 **byungjunjang** ([slide-master](https://github.com/byungjunjang/slide-master)) | MIT | 이 저장소가 **품고 있습니다**. 소스→SVG→PPTX 경로, 구조화 템플릿 계약, 3단계 확인 흐름은 전부 원저작자의 설계입니다 |
| **Paperlogy (페이퍼로지체)** | 배포 [fonts-archive](https://github.com/fonts-archive/Paperlogy) · [freesentation.blog](https://freesentation.blog/paperlogyfont) | SIL OFL 1.1 | `static/fonts/`에 woff2 5종 번들. 상세는 [`static/fonts/NOTICE.md`](static/fonts/NOTICE.md) |
| **HeroUI v3** · React · Tailwind CSS · React Aria | 각 프로젝트 | 각 프로젝트 라이선스 (`ui/package.json`) | UI 구성 요소 |
| **withby-green 덱 템플릿** | 원본 `PPT 탬플릿 예시.pptx` 19장을 해부해 이식 | MIT (이 저장소) | ⚠️ **확인 필요** — 원본 PPTX를 만든 분의 성함이 확인되면 여기에 적습니다 |
| **확인 화면 오버레이 (이 저장소)** | WeDraw (위드비) | MIT | |

> 원본 파이프라인의 설계 — 3단계 확인 흐름, `recommendations.json` → `result.json`
> 계약, 구조화 PPTX 내보내기 — 는 전부 위 원저작자의 작업입니다. 이 저장소가 바꾼
> 것은 **그 계약을 그대로 둔 채 화면만** 다시 그린 것입니다.

## 라이선스

MIT — [`LICENSE`](LICENSE) 참고. 자유롭게 고쳐 쓰고 본인 프로젝트에 가져가셔도 됩니다.

번들된 **Paperlogy** 웹폰트는 SIL Open Font License 1.1을 따릅니다
(`static/fonts/OFL.txt`). 폰트 파일에는 MIT가 아니라 OFL이 적용됩니다.
`decks/withby-green/`의 레이아웃 시안과 규격 문서도 MIT로 공개합니다.
