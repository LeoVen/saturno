# Saturno

Saturno is used to simplify and speed up the complex task of creating school
schedules — automatically generating timetables for teachers and classes
from configured entities and constraints.

- **`specs/`** — the frozen v1 product/technical design (PRD, functional and
  technical requirements, implementation notes, glossary).
- **`impls/`** — the living implementation plan: epics, tasks, and decisions
  made along the way. Start with `impls/PROCESS.md`.
- **`app/`** — the Vue 3 + TypeScript frontend (see `app/README.md` for dev
  setup).
- **`solver/`** — the Rust crate compiled to WASM that implements the
  scheduling engine.
- **`sheets/`** — real sample timetables used as ground truth while writing
  the spec.

Deployed via GitHub Pages: https://saturno.leoven.dev
