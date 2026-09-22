# INTERLUDE-2 — Profiles (Multi-Project Support)

**Status**: new

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
| INTERLUDE-2-T1 | `Profile` entity (`id`, `name`, `color`, `createdAt`) + a new `profiles` store (list + `activeProfileId`), persisted but exempt from the profile-scoping in T2 (it's what says which Profile is active); first-ever load with no `profiles` record yet auto-wraps any existing single-profile data into one default Profile rather than losing it | new |
| INTERLUDE-2-T2 | Profile-scoped persistence: `entities`/`scheduleVersions` store state keyed by `${activeProfileId}:${storeId}` in `db.ts`/`persistencePlugin.ts` instead of bare `storeId`; switching the active Profile re-hydrates both stores from the new key | new |
| INTERLUDE-2-T3 | Profile management actions: create blank, duplicate (deep-copy an existing Profile's entities + Schedule Versions under a new id, mirroring E07's `duplicate`), rename, delete (blocked if it's the only Profile left), assign a color from a small fixed palette (not a free color picker) | new |
| INTERLUDE-2-T4 | Header UI (new — today's shell is just Sidebar + main content, no header): always-visible bar showing the active Profile's name + color swatch, with a dropdown to switch/manage Profiles; the active color is also visibly applied elsewhere (e.g. a sidebar accent) so a glance at any screen says which Profile is open | new |
| INTERLUDE-2-T5 | Scope "Dados" (E11 JSON export/import) and the `.xlsx` export/import (E15) to the active Profile only; audit the rest of the app for anything that reads/writes entities or Schedule Versions outside the active-Profile-scoped stores | new |
| INTERLUDE-2-T6 | Unit tests (TR-11-style): profile-scoped key-building, the duplicate-Profile deep-copy, and the first-load migration that wraps pre-existing single-profile data into a default Profile | new |

## Decisions

- See [D-42](../DECISIONS.md) — scope, naming (`INTERLUDE-N` despite being
  new capability, not a UI-only rework like INTERLUDE-1), and the TR-6
  reconciliation.

## Notes

- Open questions to settle while working the tasks, not blocking epic
  creation:
  - **Color palette**: a small fixed set (user's own words: "assign
    different colors... from a select few ones"), not a free picker —
    exact swatches TBD when T3/T4 are actually built.
  - **Native JSON export scope** (T5): the draft assumes "Dados" exports
    only the *active* Profile (keeps FR-23/TR-7's existing single-dataset
    file shape unchanged) rather than growing a new "export every Profile"
    format. A whole-database backup (all Profiles in one file) is a
    plausible future ask but not assumed in scope here unless the user
    asks for it.
  - **Delete-Profile guard's exact wording**, and whether deleting a
    Profile is reachable at all from the same dropdown as switching, or
    needs its own confirmation step (mirrors E11's `confirm()` gate on
    destructive import).
- This epic touches nearly every screen indirectly (anything reading the
  `entities`/`scheduleVersions` stores) purely through the persistence-key
  change in T2 — the stores' own shapes and every other epic's UI code
  shouldn't need to change, only *which* saved state they're hydrated
  from/written to.
