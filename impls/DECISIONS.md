# Decisions Log

Every entry here records a point where implementation either **deviated**
from `specs/`, **clarified** something the spec left genuinely open, or made
a standalone **implementation-only** call not covered by the spec at all
(e.g. a library choice, a folder layout). See `PROCESS.md` §5.

`specs/` is never edited to match these — this log, read together with
`specs/`, is the current source of truth. Newest entries at the top.

Template for a new entry:

```
## D-<NN> — <short title>

- **Date**: YYYY-MM-DD
- **Type**: Deviation | Clarification | Implementation-only
- **Spec refs**: FR-#, TR-#, or IMPL.md §# (omit if Implementation-only and genuinely nothing to reference)
- **What changes**: one or two sentences — what actually happens now, vs. what the spec said/left open.
- **Why**: the concrete reason (test result, user call, practical constraint).
- **Affected epics/tasks**: E##-... (so the epic file can point back here)
```

---

## D-01 — Teacher conflicts are detected by real clock time, across Segments

- **Date**: 2026-09-20
- **Type**: Clarification
- **Spec refs**: FR-3, FR-5, FR-14
- **What changes**: a Teacher can teach in more than one Segment. FR-14's "no Teacher assigned to two Classes in the same time slot" is evaluated by comparing each assignment's **actual start/end clock time** (which every Time Slot already carries per FR-5), not by matching Segment-scoped period indices — two Segments' periods can overlap in real time despite having different structures. Teacher Availability (FR-3) is likewise modeled as time ranges per day, not tied to one Segment's period grid, so a single Teacher's availability applies uniformly across every Segment they teach in.
- **Why**: FR-5 gives each Segment its own independent period structure, so "same time slot" is otherwise ambiguous the moment a Teacher crosses Segments — a real scenario in smaller schools. Confirmed directly with the user; low extra implementation cost since Time Slots already store real clock times.
- **Affected epics/tasks**: E02 (Time Slot model must expose real start/end time), E04 (Teacher Availability grid modeled as time ranges, not per-Segment periods), E06 (Verifier's double-booking check compares real time overlap, not slot-index equality).

## D-02 — Segment daily structure is fixed across weekdays

- **Date**: 2026-09-20
- **Type**: Clarification
- **Spec refs**: FR-5
- **What changes**: within one Segment, the daily period/break structure (Time Slots + Breaks) is identical for every weekday it applies to — one structure per Segment, not one per (Segment, weekday). FR-5 didn't say either way.
- **Why**: matches how the real sample sheets in `sheets/` are laid out — one shared period-row structure across all weekday columns per segment. Confirmed directly with the user.
- **Affected epics/tasks**: E02 (Time Slot / Break data model).

---

## D-03 — Repo layout: `app/` (frontend) + `solver/` (Rust/WASM crate)

- **Date**: 2026-09-20
- **Type**: Implementation-only
- **Spec refs**: none directly — PROCESS.md said code lives at repo root "organized however the tooling wants," without pinning an exact layout.
- **What changes**: the Vue/Vite frontend lives under `app/` (its own `src/`, `index.html`, `package.json`, `vite.config.ts`), and the Rust solver crate lives under `solver/` (its own `Cargo.toml`, `src/lib.rs`). Both tools default to a `src/` directory, so they can't share repo root without colliding — subfolders resolve that while keeping each tool's own conventional layout intact. Matches the existing top-level convention of thematic folders (`specs/`, `impls/`, `sheets/`).
- **Why**: a real, unavoidable naming collision, resolved the simplest way rather than renaming either tool's default output directory.
- **Affected epics/tasks**: E01 (all scaffolding tasks); every later epic's file paths follow this layout.

## D-04 — Package manager: npm

- **Date**: 2026-09-20
- **Type**: Implementation-only
- **Spec refs**: none.
- **What changes**: npm is the JS package manager, not pnpm/yarn.
- **Why**: npm was already available locally (bundled with Node); neither pnpm nor yarn was installed, and there's no stated reason in the specs to prefer either.
- **Affected epics/tasks**: E01.

---

## D-05 — Toolchain versions pinned

- **Date**: 2026-09-20
- **Type**: Implementation-only
- **Spec refs**: none.
- **What changes**: Node is pinned to `26.7.0` (`app/.nvmrc`); Rust is pinned to `1.97.1` with the `wasm32-unknown-unknown` target and `rustfmt`/`clippy` components (`solver/rust-toolchain.toml`, auto-applied by `rustup` for any command run under `solver/`, including in CI). `wasm-pack` has no version file — it's installed fresh in CI via `cargo install wasm-pack --locked`; not pinned to a specific version yet.
- **Why**: these were simply whatever was already installed locally when E01 started; pinning them stops CI and local dev from silently drifting apart. Not chosen for any specific compatibility reason — revisit if a real reason to pin differently comes up.
- **Affected epics/tasks**: E01.

---

## D-06 — Custom domain: saturno.leoven.dev

- **Date**: 2026-09-20
- **Type**: Clarification (TR-17 already anticipated this exact case: "...unless a custom domain is configured later")
- **Spec refs**: TR-17
- **What changes**: the app is served at `https://saturno.leoven.dev` (user-owned DNS, CNAME record already pointing at `leoven.github.io`, confirmed resolving) instead of the GitHub Pages project-page subpath. Concretely: Vite's `base` is now `/` (was `/saturno/`); `app/public/CNAME` (containing `saturno.leoven.dev`) is committed so it ships in every build and GitHub Pages picks it up; the repo's Pages `cname` setting was also set directly via `gh api -X PUT repos/LeoVen/saturno/pages -f cname=saturno.leoven.dev`.
- **Why**: user-requested, and the exact scenario TR-17's own wording already carved out — not a deviation from what was specified, just resolving the "unless" clause.
- **Note**: right after setting the custom domain, GitHub reported `https_enforced: false`. The certificate provisioned much faster than the ~24h estimate — within minutes it showed `https_certificate.state: "approved"`, so `https_enforced` was flipped to `true` the same session (`gh api -X PUT .../pages -F https_enforced=true` — note `-F` for a real boolean, `-f` sends a string and is rejected). Confirmed via a real push (commit `060d232`): `https://saturno.leoven.dev` serves the app correctly with all assets at root (no `/saturno/` prefix). The plain-HTTP→HTTPS redirect itself hadn't kicked in yet moments after enabling enforcement (still 200, not a redirect) — likely edge-propagation lag; worth a quick recheck later, not treated as blocking.
- **Affected epics/tasks**: E01 (E01-T4's base-path config, E01-T5's deploy pipeline — the artifact must keep including `CNAME` on every build).

---

*(entries above are the most recent)*
