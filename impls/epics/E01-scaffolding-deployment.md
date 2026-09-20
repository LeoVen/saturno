# E01 — Project Scaffolding & Deployment Pipeline

**Status**: new

## Goal

Stand up the app skeleton — frontend, WASM toolchain, persistence plumbing,
and the GitHub Pages deploy pipeline — so every later epic has somewhere
real to land its work, and the riskiest toolchain question (Rust → WASM →
Web Worker) is proven early instead of assumed.

## Spec references

- **FR-1** — pt-BR only; establishes the convention, not a feature to build.
- **TR-1, TR-2, TR-4** — browser-only, no backend, no network calls.
- **TR-5** (skeleton only — real entities arrive with E02+) — IndexedDB via `idb`, hydrate-on-load / write-through Pinia plugin.
- **TR-11** (harness only) — test runner setup for pure solver-adjacent functions.
- **TR-14, TR-15** — browser targets, no phone layout: stated constraints, not built features.
- **TR-17, TR-18, TR-19** — GitHub Pages hosting, CI/deploy pipeline, no URL router.
- **IMPL.md §6–8** — Rust/WASM rationale and toolchain, frontend architecture.

## Human verification

1. Push to `main`; confirm the GitHub Actions workflow completes successfully.
2. Visit the published GitHub Pages URL; confirm the app shell loads.
3. Hard-refresh the page (and/or open it fresh, not via in-app navigation); confirm no broken asset/Worker/WASM paths — this validates the base-path config (TR-17).
4. Confirm the Rust→WASM→Worker spike function's result is visible (e.g. a temporary on-screen value or console log) — proves the toolchain path end-to-end before any real solver logic is written.
5. Write a trivial value through the persistence layer, reload the browser, and confirm it's still there (validates the TR-5 skeleton).

## Tasks

| ID | Task | Status |
|---|---|---|
| E01-T1 | Scaffold Vue 3 + TypeScript + Vite app | new |
| E01-T2 | Scaffold Rust crate + `wasm-pack` build; wire a minimal exported function callable from a Web Worker end-to-end (toolchain spike, de-risks IMPL.md §10's Rust/WASM concern before real solver work) | new |
| E01-T3 | Pinia store skeleton + IndexedDB wrapper (`idb`) with hydrate-on-load / write-through plumbing — no real entities yet | new |
| E01-T4 | Configure Vite `base` for the GitHub Pages project-page subpath (TR-17) | new |
| E01-T5 | GitHub Actions workflow: Node + Rust toolchains, `wasm-pack build`, Vite build, publish to GitHub Pages (TR-18) | new |
| E01-T6 | Set up a unit-test runner for solver-adjacent pure functions (TR-11) — the pattern later epics' solver work will follow | new |

## Decisions

*(none yet)*

## Notes

- **pt-BR without an i18n framework**: since v1 ships exactly one locale, the plan is to write pt-BR strings directly rather than adopt a translation framework. This is a real implementation decision (not just a default) — log it in `../DECISIONS.md` (Type: Implementation-only) once it's actually made, in case a future version needs a second locale and this needs revisiting.
