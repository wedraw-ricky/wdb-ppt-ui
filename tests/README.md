# tests

Contract tests for **WeDraw-authored code only** — the planning stage and the
confirm UI's file model. The vendored pipeline stays untested; see
[`../CLAUDE.md`](../CLAUDE.md) *What is whose* for the boundary and
[`../docs/rules/code-style.md`](../docs/rules/code-style.md) §11 for the rule.

## Running

Neither suite installs anything. Python uses `unittest`; the TypeScript suite
uses Node's own runner and type stripping, so `model.ts` is read as-is.

```bash
python3 -m unittest discover -s tests                       # 계약 · 30건
node --test --experimental-strip-types tests/*.test.mts     # 화면 모델 · 17건
```

> Pass the file glob, not the `tests/` directory — Node would otherwise try to
> execute `test_planning.py` as JavaScript.

## What is covered

| File | Covers |
|---|---|
| `test_planning.py` | `plan_spec.py` parsing (status · heading · 별첨), `report_form.py` body markup and inline rules, form presets and the type scale, slide titles in `outline.py`, `--format auto` |
| `outline-model.test.mts` | `ui/src/outline/model.ts` — the `outline.md` round trip, the multi-line recovery, the §8 edits, and the checks the screen shows before saving |

## Why these cases

Every test states a contract someone can read off a reference document. Two are
marked `# regression` because they are defects that reached a rendered document:

- `status:` was read with `\S+`, so `확인 필요` parsed as `확인` and every
  downstream comparison against the full string went dead
- the 각주 rule matched the first `*` of `**1안**`, so both option lines rendered
  as footnotes carrying a stray asterisk

Both were confirmed to fail when the defect is reintroduced and to pass once it
is fixed. A regression test that does not fail on its own bug is decoration.
