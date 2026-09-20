# E01 — Project Scaffolding & Deployment Pipeline

**Status**: in-progress

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
6. Push a deliberately failing test or lint error on a branch; confirm CI fails and nothing deploys; then fix it and confirm a green push does deploy.

## Tasks

| ID | Task | Status |
|---|---|---|
| E01-T1 | Scaffold Vue 3 + TypeScript + Vite app | done |
| E01-T2 | Scaffold Rust crate + `wasm-pack` build; wire a minimal exported function callable from a Web Worker end-to-end (toolchain spike, de-risks IMPL.md §10's Rust/WASM concern before real solver work) | in-review |
| E01-T3 | Pinia store skeleton + IndexedDB wrapper (`idb`) with hydrate-on-load / write-through plumbing — no real entities yet | in-review |
| E01-T4 | Configure Vite `base` for the GitHub Pages project-page subpath (TR-17) | done |
| E01-T5 | GitHub Actions workflow: Node + Rust toolchains, `wasm-pack build`, Vite build, publish to GitHub Pages (TR-18) | in-review |
| E01-T6 | Set up a unit-test runner for solver-adjacent pure functions (TR-11) — the pattern later epics' solver work will follow | done |
| E01-T7 | Linting/formatting: ESLint+Prettier (TS/Vue), rustfmt+clippy (Rust) — establishes the baseline every later epic's code follows | done |
| E01-T8 | CI: run lint + unit tests on every push, gating the deploy step so it only publishes on green (extends E01-T5) | in-review |
| E01-T9 | Enable GitHub Pages for the repo (Settings → Pages → Source: "GitHub Actions", or `gh api -X POST repos/LeoVen/saturno/pages -F build_type=workflow`) — one-time repo setting; currently **not enabled** (confirmed via `gh api repos/LeoVen/saturno/pages` → 404) | done |

## Decisions

- [D-03](../DECISIONS.md) — repo layout: `app/` (frontend) + `solver/` (Rust/WASM crate).
- [D-04](../DECISIONS.md) — package manager: npm.
- [D-05](../DECISIONS.md) — toolchain versions pinned (Node 26.7.0, Rust 1.97.1).

## Notes

- **pt-BR without an i18n framework**: App.vue's scaffolding-check text is written directly in pt-BR (no translation framework) — the same approach earlier notes here proposed. Not yet formally logged as a Decision since E01's UI text is throwaway scaffolding, not a real screen; log it for real once E02 writes the first actual pt-BR user interface.
- `wasm-pack` (v0.15.0) is installed locally via `cargo install wasm-pack --locked`, not committed to the repo (it's a global cargo tool, not a project dependency) — CI installs it the same way (see the `build-deploy` job).
- Verification performed so far is **automated only** (build/lint/format/test green locally, `vite preview` served the production build under `/saturno/` correctly, WASM/Worker assets returned 200 with the right content-type via `curl`). The epic's Human Verification steps 1, 4, 5, 6 still need a human in a real browser / a real push to `main` — no browser tool was available to actually click the on-screen buttons.
