# INTERLUDE-2 — Profiles (Multi-Project Support)

**Status**: in-review

## Goal

Let the user maintain several independent **Profiles** — one per school
year, or per whatever else needs a clean break (2026, 2027, ...) — each
with its own full entity configuration and Schedule Versions, switch
between them from an always-visible header control, seed a new Profile by
copying an existing one, and tell at a glance which Profile is open via a
user-chosen color from a fixed palette.

## Spec references

None — this is new scope, not in `specs/`. It also cuts against TR-6's
current wording ("data is scoped to a single browser profile on a single
machine," meaning *one* school's dataset per browser) — see
[D-42](../DECISIONS.md) for how that's reconciled: TR-6 stays true of a
single *Profile*, "single browser profile on a single machine" becomes
"single browser Profile *store* on a single machine, with possibly several
Profiles in it."

## Human verification

1. Open the app fresh (or on existing data): confirm exactly one Profile
   exists — auto-created from whatever was already there — with a sensible
   default name and color, and the header shows it.
2. Create a second Profile via "Duplicar" from the first; rename it and
   give it a different color from the palette. Confirm the header (and
   wherever else the color is applied) updates immediately.
3. Add or change something distinctive in each Profile (e.g. a Teacher
   that only exists in the second one). Switch back and forth via the
   header dropdown; confirm each Profile's data — entities *and* Schedule
   Versions — is fully independent, and everything persists correctly
   across a reload (including which Profile was last active).
4. Confirm "Dados" (native JSON export/import, FR-23/E11) and the `.xlsx`
   export/import (E15) both operate on the active Profile only — export
   one Profile, switch to the other, and confirm nothing bled across.
5. Try deleting the only remaining Profile; confirm it's blocked with a
   clear pt-BR message rather than leaving the app with zero Profiles.

## Tasks

| ID | Task | Status |
|---|---|---|
| INTERLUDE-2-T1 | `Profile` entity (`id`, `name`, `color`, `createdAt`) + a new `profiles` store (list + `activeProfileId`), persisted but exempt from the profile-scoping in T2 (it's what says which Profile is active); first-ever load with no `profiles` record yet auto-wraps any existing single-profile data into one default Profile rather than losing it | in-review |
| INTERLUDE-2-T2 | Profile-scoped persistence: `entities`/`scheduleVersions` store state keyed by `${activeProfileId}:${storeId}` in `db.ts`/`persistencePlugin.ts` instead of bare `storeId`; switching the active Profile re-hydrates both stores from the new key | in-review |
| INTERLUDE-2-T3 | Profile management actions: create blank, duplicate (deep-copy an existing Profile's entities + Schedule Versions under a new id, mirroring E07's `duplicate`), rename, delete (blocked if it's the only Profile left), assign a color from a small fixed palette (not a free color picker) | in-review |
| INTERLUDE-2-T4 | Header UI (new — today's shell is just Sidebar + main content, no header): always-visible bar showing the active Profile's name + color swatch, with a dropdown to switch/manage Profiles; the active color is also visibly applied elsewhere (e.g. a sidebar accent) so a glance at any screen says which Profile is open | in-review |
| INTERLUDE-2-T5 | Scope "Dados" (E11 JSON export/import) and the `.xlsx` export/import (E15) to the active Profile only; audit the rest of the app for anything that reads/writes entities or Schedule Versions outside the active-Profile-scoped stores | in-review |
| INTERLUDE-2-T6 | Unit tests (TR-11-style): profile-scoped key-building, the duplicate-Profile deep-copy, and the first-load migration that wraps pre-existing single-profile data into a default Profile | in-review |

## Decisions

- See [D-42](../DECISIONS.md) — scope, naming (`INTERLUDE-N` despite being
  new capability, not a UI-only rework like INTERLUDE-1), and the TR-6
  reconciliation.

## Notes

- **Palette adjustment, user-requested (2026-09-22)**: the original 8
  colors had two that read as orange (Laranja/Âmbar) and two that read as
  red (Rosa/Vermelho) — too close to tell apart at a glance, defeating the
  point of a color-coded switcher. Rosa (`#db2777`) replaced with Amarelo
  (`#eab308`); Âmbar (`#d97706`) replaced with Preto (`#111827`) —
  `entities/profile.ts`'s `PROFILE_COLORS`. Existing color ids not in the
  new set fall back to the first color (`profileColorHex`'s existing `??`
  default) rather than erroring — not a concern in practice yet, since no
  real Profile has been colored through this feature before now.
- **Follow-up, user-requested (2026-09-22)**: the Profile name is now
  woven into both export paths, so a downloaded file is identifiable
  without opening it. `persistence/exportImport.ts`'s `buildExport` gained
  an optional third `profileName` param, stamped as a top-level
  `profileName` field on the JSON (informational only — `parseImport`
  doesn't read it; import always targets whichever Profile is active).
  Both `DataPortabilityView.vue`'s JSON filename and `ExportView.vue`'s
  `.xlsx` filename now include `filenameSafe(profileName)` (new
  `export/filename.ts` — strips characters invalid in a filename on
  Windows/macOS/Linux, collapses whitespace to hyphens; applied to the
  Schedule Version name too, for the same reason). Both screens show the
  computed filename as a `<p class="muted">` preview above the download
  button, updating live as you rename/switch Profiles or Schedule
  Versions — "assuming no naming conflict" per the user's own framing,
  i.e. this is what the browser will suggest, not a guarantee of what
  ends up on disk (the browser itself appends e.g. " (1)" on a real
  collision, outside the page's control).
- **Open questions resolved during implementation (2026-09-22)**:
  - **Color palette**: 8 fixed colors (`entities/profile.ts`'s
    `PROFILE_COLORS` — Azul, Verde, Roxo, Laranja, Rosa, Turquesa, Âmbar,
    Vermelho), each a `{id, label, hex}`; picked from `ProfilesView.vue`'s
    color-swatch row, no free picker.
  - **Native JSON export scope** (T5): active Profile only, as drafted —
    and it turned out to need *no new code*: `buildExport`
    (`persistence/exportImport.ts`) already just reads whatever's
    currently in the `entities`/`scheduleVersions` stores, which after T2
    is always exactly the active Profile's data. Same for E15's `.xlsx`
    export/import. A whole-database backup (every Profile in one file)
    stays unbuilt — not asked for.
  - **Delete-Profile guard**: `profiles.remove()` refuses when
    `items.length <= 1` ("Não é possível excluir o único Perfil
    existente."), surfaced as an inline `.alert-danger` on "Perfis"
    (`ProfilesView.vue`) rather than a dialog. Delete only lives there,
    not in the header dropdown — the dropdown (`AppHeader.vue`) is
    deliberately just switch + create + a "Gerenciar Perfis…" link, to
    keep an always-open control from being where a destructive action
    lives. Duplicate/rename/color also only live on "Perfis"; the header
    only duplicates "+ Novo Perfil" since creating one is common enough to
    want without leaving whatever screen you're on.
- **T2's actual mechanism**: `entities`/`scheduleVersions` keep their
  existing Pinia store ids and shapes untouched — no other epic's
  component code changed. What changed is *only* how they're persisted:
  `persistencePlugin.ts` now skips `profiles`/`entities`/
  `scheduleVersions` entirely (a new `PROFILE_MANAGED_STORE_IDS` set,
  alongside the existing `EPHEMERAL_STORE_IDS`), and a new
  `persistence/profilesPersistence.ts` owns them instead:
  `initProfilePersistence(pinia)` runs once before `main.ts` mounts the
  app (an `await` at module top level), does the first-load migration
  (delegating the actual decision to `profilesBootstrap.ts`'s pure
  `planProfileMigration`, so that part is unit-tested without needing a
  real IndexedDB — no `fake-indexeddb` dependency added), hydrates
  `entities`/`scheduleVersions` from the active Profile's
  `${profileId}:entities`/`${profileId}:scheduleVersions` IndexedDB keys,
  and re-hydrates + re-subscribes both on every `activeProfileId` change
  (a Vue `watch`, not Pinia's generic `$subscribe`, since only that one
  field's change matters here).
- Header background/border and the Sidebar's left accent both read a
  `--profile-color`/`--profile-color-soft` CSS custom property set once on
  `App.vue`'s root wrapper (computed from `profiles.activeProfile.color`)
  — deliberately not `color-mix()` (support is fine for a personal-use
  tool, but a plain computed `rgba()` in JS, `profileColorRgba()`, is one
  less thing to think about) and deliberately not repainting
  `--color-primary` app-wide (would recolor every `.btn-primary`
  everywhere, not just the Profile-identifying chrome).
- Agent-driven verification (Vite dev server + headless Chromium via
  Playwright, same convention as E11/E12/E15): cleared IndexedDB entirely
  and confirmed a truly fresh install creates exactly one default Profile;
  separately seeded pre-INTERLUDE-2 *unscoped* `entities`/
  `scheduleVersions` IndexedDB keys (simulating an existing pre-epic
  install) and confirmed they were wrapped into one default Profile with
  the data intact, not lost; duplicated that Profile via the header's
  "Gerenciar Perfis…" → "Duplicar" (native `prompt()` for the name),
  recolored it via a swatch click, added a Segment that exists only there;
  switched back to the original via "Perfis" and confirmed it did **not**
  have that Segment (independence); reloaded the whole page and confirmed
  the active Profile and its data survived; confirmed "Dados"'s JSON
  export contained the active Profile's data only; deleted the duplicate
  down to one Profile, then confirmed the delete guard blocked removing
  the last one with the correct pt-BR message. No console errors
  throughout. This is agent-driven verification, not the epic's own Human
  Verification steps above — those still need a person to walk them
  before this epic moves to `done`.
