# Saturno — frontend

Vue 3 + TypeScript + Vite frontend. See `../specs/` for the product design
and `../impls/` for the implementation plan/process. The Rust solver crate
lives in `../solver/` and compiles to the WASM package this app imports from
`src/wasm/pkg/` (generated, not committed — see below).

## Setup

```sh
npm install
npm run build:wasm   # builds ../solver into src/wasm/pkg (required before first dev/build)
npm run dev
```

## Scripts

- `npm run dev` — dev server
- `npm run build` — type-check + production build (`dist/`)
- `npm run preview` — serve the production build locally
- `npm run test` — Vitest
- `npm run lint` — ESLint
- `npm run format` / `npm run format:write` — Prettier check / fix
- `npm run build:wasm` — rebuild the solver crate's WASM package after changing Rust code
