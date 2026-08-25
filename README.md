# Anthem

A desktop music player with gmusicbrowser's data model and power, a web-technology UI that users can
re-layout and re-skin, and [Halon](https://github.com/BeatLink/Halon) as its reference theme.

The design is specified in full in [DESIGN-SPEC.md](DESIGN-SPEC.md). This README covers only how to
run what exists.

## Status

Early. The library core, query engine and testing harness are real; playback and tag I/O are not
implemented yet. See the roadmap in DESIGN-SPEC §15.

| Area | State |
|---|---|
| SQLite schema, migrations, entity model | working |
| Filter AST → SQL and → native predicate | working, agreement property-tested |
| Audio content hashing (move/rename detection) | working |
| Field descriptor system | working |
| Format-string engine | working |
| Framework-free view state (selection, sort, virtualization) | working |
| Halon theming | working |
| Renderer shell | placeholder widgets |
| Playback (mpv) | not started |
| Tag reading/writing | not started |
| Scanner | not started |

## The one idea worth knowing

**A track is a piece of music, not a file.** It survives renames, moves, format changes, retagging,
and having no file at all. Anything that can render it — a local file, a second copy in another
format, a CUE range inside a larger file, a streaming URI — is a `media` row hanging off it.

Files are identified by an **audio content hash** computed over the audio stream with metadata
excluded, so retagging never changes a file's identity and a moved file is still recognisably the
same file. AcoustID answers a different question (*is this the same recording?*) and is a hint on
the track, never a key.

## Development

The Nix flake pins everything, including the Electron the native module is built against.

```sh
direnv allow        # or: nix develop
npm install
npm run dev
```

The shell hook clears `ELECTRON_RUN_AS_NODE`, which VSCode's integrated terminal exports and which
otherwise makes Electron run as bare node and die on the ESM entry point.

### Commands

| Command | Does |
|---|---|
| `npm run dev` | Run with hot reload |
| `npm run build` | Typecheck and build to `out/` |
| `npm test` | Full suite |
| `npm run test:watch` | Watch mode |
| `npm run bench` | Performance budget benchmarks |
| `npm run typecheck` | `tsc` for main/preload, `svelte-check` for the renderer |
| `npm run theme` | Regenerate `themes/halon/halon.css` from `tokens.json` |
| `npm run rebuild:electron` | Rebuild `better-sqlite3` against Electron's ABI |

Benchmarks default to 50k synthetic tracks (the §12 target); `ANTHEM_BENCH_SIZE=20000 npm run bench` for a quicker
pass. Point the app at a scratch database with `ANTHEM_DB=/tmp/anthem.db`.

## Testing

The suite is described in DESIGN-SPEC §13. The load-bearing one:

**`test/property/ast-agreement.test.ts`** asserts that for any generated filter over any generated
library, the SQL compiler and the native predicate return identical id sets. The fast path exists
only because this test keeps it honest — it has already caught a three-valued-logic divergence where
SQL silently dropped tracks with a NULL value from negated filters.

Tests reach SQLite through Node's built-in `node:sqlite` rather than `better-sqlite3`, so the suite
never depends on which ABI the native module was last rebuilt for.

## Layout

```
src/
├── main/        Electron main: db, query engine, library, (later) tags, playback, services
├── preload/     The typed IPC bridge, exposing only the declared contract
├── renderer/    UI. Deliberately thin — see below.
├── shared/      Imported by BOTH sides: field descriptors, filter AST, format strings, view state
└── workers/     (planned) scan, hash, index-build, replaygain
```

`shared/` is where the leverage is. The filter AST, field descriptors, format-string engine and view
state (selection, sort, filter stack, virtualization maths) are plain TypeScript with no framework
primitives and no DOM access. Replacing the UI framework touches `renderer/` only.
