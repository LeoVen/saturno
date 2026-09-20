# Saturno — Technical Requirements

Status tags follow the same convention as FR.md: `[ORIGINAL]` · `[REFINED]` · `[NEW]`.

These decisions were confirmed directly with the user during this review (see "Decisions Confirmed" in PRD.md): **pure client-side SPA, no backend, browser-local persistence.**

---

## Platform & Architecture

**TR-1** `[ORIGINAL]` The system runs exclusively in a web browser — no native desktop or mobile app.

**TR-2** `[NEW]` The system is a **pure client-side single-page application**: there is no application server and no remote database. All logic, including the scheduling solver, runs in the browser.
> Why: confirmed directly by the user as the chosen architecture, over a local-backend-server alternative. This is a load-bearing decision — it rules out any design that assumes server-side computation or storage.

**TR-3** `[NEW]` The scheduling solver (FR-14/FR-15) runs inside a **Web Worker**, off the UI main thread, so the interface stays responsive while a generation run is in progress. The user can see progress/cancel a long-running generation.
> Why: constraint solving over dozens of teachers/classes can take non-trivial time; running it on the main thread would freeze the UI, which is unacceptable for a tool meant to be iterated on interactively (FR-17 manual edits imply the user will re-run or re-check frequently).

**TR-4** `[NEW]` No network calls are made by the application at runtime (no telemetry, analytics, or external API dependencies). All fonts/assets are bundled, not loaded from a CDN at runtime, so the app keeps working fully offline once loaded.
> Why: consistent with the local-only data model, and appropriate given the data involved is personal information (teacher names, schedules) that shouldn't leave the machine. Not stated in prd-v1 but follows directly from "data is saved locally."

---

## Data Persistence

**TR-5** `[REFINED]` All configuration and generated/edited schedule data is persisted in the browser's **IndexedDB**, not `localStorage` or in-memory-only state, so that data survives closing the browser, restarting the browser, and powering the computer off and on.
> Why refined from prd-v1's "saved locally": IndexedDB is specified explicitly (over localStorage) because the data model (entities, relationships, multiple schedule versions per FR-24) is structured and can grow beyond localStorage's practical size/synchronous-API limits.

**TR-6** `[NEW]` Data is scoped to a single browser profile on a single machine. There is no automatic sync between browsers, profiles, or devices — moving data between computers is exclusively via the export/import file (TR-7).
> Why: a direct consequence of TR-2 (no backend) that should be stated explicitly so it isn't assumed away — this is also why FR-23's export/import requirement exists.

**TR-7** `[ORIGINAL]` The full application state (all entities, constraints, all schedule versions, manual edits, and notes) can be exported to a single downloadable file and re-imported — on the same or a different computer — to fully restore that state.

**TR-8** `[NEW]` The export file format is **versioned** (an explicit schema-version field), so that later versions of the application can detect and migrate older export files rather than failing to load them.
> Why: not addressed in prd-v1; necessary for any tool expected to be used across multiple school years (FR-24), where the export file itself becomes a long-lived artifact.
> Migration policy: on import, if the file's `schemaVersion` is older than the app's current version, a sequential chain of pure migration functions (one per version step) transforms it forward before loading. If the file's `schemaVersion` is *newer* than the app supports, the import is rejected with a clear message (in pt-BR, per FR-1) rather than attempting a best-effort load — the app cannot know how to interpret a future schema it's never seen. See IMPL.md §7.

---

## Solver Implementation

**TR-9** `[NEW]` The hard constraints in FR-14 are modeled as a constraint-satisfaction problem; the soft objectives in FR-15 are modeled as weighted penalties optimized in a secondary pass (or interleaved, e.g. via local search) without ever relaxing a hard constraint to improve a soft one.
> Why: makes explicit, testable separation between "must hold" and "nice to have," matching the hard/soft split introduced in FR-14/FR-15.

**TR-10** `[NEW]` The solver targets practical completion within a few seconds for the scale observed in the real sample data (roughly: a few dozen teachers, 10–20 classes across 2 segments, 5-day weeks of 6–9 periods per day) — see PRD.md's "Assumptions" for where this figure comes from and where to confirm it.
> Why: without a stated target, "the solver is slow" has no bar to fail against; this gives implementation and testing a concrete, sourced number instead of an arbitrary one.

**TR-11** `[NEW]` Solver logic is implemented as pure, UI-independent functions/modules, enabling automated unit and regression tests of constraint correctness (e.g., "no output ever double-books a teacher") independent of any UI harness.
> Why: not stated in prd-v1; scheduling-correctness bugs are exactly the kind of regression that's cheap to catch with unit tests and expensive to catch by manual inspection of a grid.

**TR-16** `[NEW]` A Teacher Absence (FR-35/36) triggers a constrained **repair** search that reuses the same Verifier and hard-constraint model as full generation (TR-9), restricted to the vacated slot(s) and seeded from the current Schedule rather than built from scratch. It runs on the main thread (not a Worker pool) since it searches a single small slot set, not the full problem — expected to complete near-instantly, well under TR-10's full-generation target.
> Why: confirms the repair mode is an extension of the existing solver architecture, not a parallel system — it must never diverge from what FR-14/FR-29 consider valid, since that's the whole point of reusing the Verifier. See IMPL.md §5.6.

---

## Import / Export Formats

**TR-12** `[ORIGINAL]` The native interchange format (TR-7) is a single structured file (e.g. JSON) — not the target of manual editing by the user.

**TR-13** `[NEW]` Separately from TR-12, the system produces a **human-readable export** of a schedule (per Class and per Teacher, per FR-22) as **both** a printable document and an `.xlsx` spreadsheet, laid out as a day/period grid comparable to the school's current spreadsheet format.
> Why: this is a distinct technical concern from TR-12 — the native format optimizes for lossless round-tripping into the app; the human-readable export optimizes for being read/printed/shared with staff who don't use the app, which is what every real sample file in `sheets/` actually is.
> Mechanism (confirmed with user): the printable version is a `@media print` stylesheet on the existing grid component plus `window.print()` — no PDF-generation library, no new dependency, consistent with TR-4's "no network calls" stance and letting the user's own browser/OS handle printer selection or save-as-PDF. The `.xlsx` version is generated client-side via a styling-capable library (IMPL.md §9 names the choice) since the target layout needs cell fills, merges, and column widths to be "comparable to the school's current format," not just plain values.

---

## Browser / Runtime Support

**TR-14** `[NEW]` Target the latest two stable releases of Chrome, Edge, and Firefox. No commitment to Internet Explorer or other legacy engines.
> Why: not stated in prd-v1; stated as an assumption to confirm (see PRD.md Open Questions) rather than left implicit, since it affects which browser APIs (IndexedDB, Web Workers, File System Access API) are safe to rely on.

**TR-15** `[NEW]` The interface is usable on a standard laptop/desktop screen and browser window; phone-width responsiveness is not a design target for v1 given the data-entry-heavy, grid-based nature of the tool.
> Why: flagged as an assumption, not a hard requirement — worth confirming with the user if schedules need to be checked on a phone in practice.

---

## Hosting & Deployment (v5)

**TR-17** `[NEW]` `v5` The application is hosted as a static site on **GitHub Pages**, served from the `saturno` repository as a project page (`https://<user>.github.io/saturno/`) unless a custom domain is configured later. The build output resolves every asset, Web Worker script, and WASM module URL relative to a **configurable base path**, never to server root, since a project page is not served from domain root.
> Why: confirmed directly with the user (PRD.md §4, v5). GitHub Pages hosting was previously left unstated (TR-1/TR-2 only said "runs in a browser" / "no backend"); a hosting-agnostic build that assumes root-relative paths would break on a project-page subpath.

**TR-18** `[NEW]` `v5` A CI/CD pipeline (GitHub Actions) builds the application — the Node toolchain for the Vue/Vite frontend plus the Rust toolchain and `wasm-pack` for the WASM solver crate, per IMPL.md §8 — and publishes the static build output to GitHub Pages on pushes to the main branch.
> Why: IMPL.md §8 already named the dual Node+Rust toolchain requirement for CI but never specified what CI does with it or how the app actually reaches its hosting target. GitHub Pages requires an explicit publish step; there is no implicit deploy.

**TR-19** `[NEW]` `v5` The application uses **no URL-based client-side router in v1** — all views are reached through in-app state/tab navigation (consistent with IMPL.md §7's Pinia-only frontend architecture, which never specified a router). If a router is introduced in a future version, it must use **hash-based routing**, not history/path-based routing.
> Why: GitHub Pages serves static files with no server-side URL rewriting, so a history-mode route that doesn't exist as a literal file 404s on direct load or refresh (the common workaround is a redirecting `404.html`, which this spec avoids needing entirely by not requiring history-mode routing in the first place). Decided without a direct question — a low-ambiguity default consistent with how the frontend architecture was already scoped; flag if a router turns out to be needed (PRD.md §4, v5).
