# Bundled font — Paperlogy

`Paperlogy` (페이퍼로지체) is bundled here so this page renders in the same
typeface as the decks it configures, on any machine, with no network access
and without requiring a local install.

| | |
|---|---|
| Font | Paperlogy (페이퍼로지체) |
| License | SIL Open Font License 1.1 — see `OFL.txt` |
| Source | https://github.com/fonts-archive/Paperlogy |
| Distributor | https://freesentation.blog/paperlogyfont |

The OFL permits commercial use, modification and redistribution; it forbids
selling the font on its own and changing its license. Redistributing it inside
this repository is therefore allowed, and `OFL.txt` accompanies it as the
license requires.

Only the five weights this UI actually uses are vendored (400 / 500 / 600 /
700 / 800) in `woff2` only — about 800 KB total. Thin, ExtraLight, Light and
Black are omitted, as are the `otf` / `ttf` / `woff` formats.

`@font-face` here applies to this HTML page only. The SVG slide pipeline
forbids `@font-face` (see upstream `references/shared-standards.md` §1) and is
unaffected by this directory.
