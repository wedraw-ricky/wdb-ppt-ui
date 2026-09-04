# tools-local — 로컬 전용 (upstream 아님)

이 디렉터리는 `.git/info/exclude`로 제외되어 있어 `git pull` 시 충돌하지 않습니다.

## sync_global_stubs.py

`<repo>/.claude/skills/` 의 정본 스킬을 `~/.claude/skills/` 에
**절대경로 리다이렉트 스텁**으로 미러링합니다. 저장소 밖 어느 폴더에서든
스킬이 발견되고, `${SKILL_DIR}` · `.claude/skills/...` 상대경로가 올바르게
해석됩니다.

```bash
python3 tools-local/sync_global_stubs.py           # 생성/갱신
python3 tools-local/sync_global_stubs.py --check   # 드리프트만 확인 (쓰지 않음)
```

**`git pull` 이후에는 반드시 재실행하세요** — 스킬 이름·description이 바뀌면
스텁 frontmatter도 갱신되어야 합니다.

스텁은 자기 것이 아닌 파일은 건드리지 않습니다(`<!-- slide-master-global-stub -->`
마커가 없으면 SKIP).

## 설치 상태 (2026-09-02 기준 — preflight 경고 0)

- Python 3.12 (python.org framework), requirements 16개 전부 충족
- Pretendard 6종 → `~/Library/Fonts/`
- `playwright` 1.62.0 + Chromium 151 → Step 6 픽셀 검사 / visual-review 활성
- `@officecli/officecli@1.0.135` (npm 전역, nvm node v22.18.0) → PPTX 스키마 검증 + 렌더 대조표 활성
- Codex CLI 0.148.0, ChatGPT 계정 로그인 완료 → `codex-image` / `image_gen.py` 기본 백엔드 사용 가능 (API 키 불필요)

`preflight.py` / `preflight.py --needs-images` 둘 다 PASS.
