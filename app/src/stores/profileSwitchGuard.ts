// Bug fix (2026-09-23, user-reported): switching the active Profile
// (INTERLUDE-2) only ever re-hydrates `entities`/`scheduleVersions`
// (`persistence/profilesPersistence.ts`'s watcher) — the two *ephemeral*,
// never-persisted generation-run stores (`generation.ts`'s quick mode,
// `deepSearch.ts`'s E13 deep mode) were never reset, so a just-generated
// schedule or a Busca Aprofundada's ranked candidates from the *previous*
// Profile stayed visible (and, worse, save-able — "Salvar como nova
// versão"/"Adotar como versão" would attach the old Profile's result to
// the new one) after switching.
//
// Every UI action that changes `profiles.activeProfileId` (the header
// switcher, "Perfis"'s Ativar/Duplicar/+Novo Perfil, and removing the
// active Profile) must go through `confirmAndResetForProfileSwitch()`
// first — not a store-layer guard on `profiles.ts` itself, since that
// would change `create`/`duplicate`'s return type to possibly-`undefined`
// (a real signature break against their existing, tested contract) for a
// concern that's fundamentally about the UI's own confirm-and-proceed
// flow, not the Profile data model.

import { useGenerationStore } from './generation'
import { useDeepSearchStore } from './deepSearch'

/**
 * A human-readable pt-BR warning if switching Profiles right now would
 * discard unsaved ephemeral work — or `null` if there's nothing at risk.
 */
export function unsavedEphemeralWorkWarning(): string | null {
  const generation = useGenerationStore()
  const deepSearch = useDeepSearchStore()

  const parts: string[] = []
  if (generation.status === 'running') parts.push('uma geração de horário em andamento')
  else if (generation.status === 'feasible')
    parts.push('um horário gerado ainda não salvo como Versão')

  if (deepSearch.status === 'running') parts.push('uma Busca Aprofundada em andamento')
  else if (deepSearch.status === 'done' && deepSearch.candidates.length > 0)
    parts.push('candidatos de Busca Aprofundada ainda não salvos como Versão')

  if (parts.length === 0) return null
  return `Há ${parts.join(' e ')}. Trocar de Perfil descarta esse resultado. Deseja continuar?`
}

/**
 * Clears both ephemeral generation-run stores (cancelling an in-progress
 * Busca Aprofundada first, so its Worker pool doesn't keep computing for a
 * Profile that's no longer active) — call right before actually switching,
 * so no screen ever shows a previous Profile's temporary, unsaved result.
 */
export function resetEphemeralWork(): void {
  useDeepSearchStore().cancel()
  useGenerationStore().$reset()
  useDeepSearchStore().$reset()
}

/**
 * The one gate every Profile-switching action goes through: warns (native
 * `confirm()`) if there's unsaved ephemeral work and lets the user back
 * out, otherwise resets it and returns `true`. Always resets before
 * returning `true` — even with nothing to warn about, a stale
 * infeasible/error message from the previous Profile shouldn't linger.
 */
export function confirmAndResetForProfileSwitch(): boolean {
  const warning = unsavedEphemeralWorkWarning()
  if (warning && !confirm(warning)) return false
  resetEphemeralWork()
  return true
}
