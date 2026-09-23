import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useGenerationStore } from './generation'
import { useDeepSearchStore } from './deepSearch'
import {
  confirmAndResetForProfileSwitch,
  resetEphemeralWork,
  unsavedEphemeralWorkWarning,
} from './profileSwitchGuard'
import type { Candidate } from '../wasm/types'

function candidate(): Candidate {
  return {
    schedule: { placements: [] },
    score: { teacherGapPenalty: 0, subjectDistributionPenalty: 0, total: 0 },
  }
}

describe('profileSwitchGuard', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('unsavedEphemeralWorkWarning', () => {
    it('is null when both stores are idle', () => {
      expect(unsavedEphemeralWorkWarning()).toBeNull()
    })

    it('warns about a running quick generation', () => {
      useGenerationStore().status = 'running'
      expect(unsavedEphemeralWorkWarning()).toContain('geração de horário em andamento')
    })

    it('warns about a feasible, unsaved quick-generated schedule', () => {
      useGenerationStore().status = 'feasible'
      expect(unsavedEphemeralWorkWarning()).toContain('horário gerado ainda não salvo')
    })

    it('does not warn about an infeasible/error quick-generation result — nothing save-able', () => {
      useGenerationStore().status = 'infeasible'
      expect(unsavedEphemeralWorkWarning()).toBeNull()
      useGenerationStore().status = 'error'
      expect(unsavedEphemeralWorkWarning()).toBeNull()
    })

    it('warns about a running Busca Aprofundada', () => {
      useDeepSearchStore().status = 'running'
      expect(unsavedEphemeralWorkWarning()).toContain('Busca Aprofundada em andamento')
    })

    it('warns about done-but-unsaved Busca Aprofundada candidates', () => {
      const deepSearch = useDeepSearchStore()
      deepSearch.status = 'done'
      deepSearch.candidates = [candidate()]
      expect(unsavedEphemeralWorkWarning()).toContain('candidatos de Busca Aprofundada')
    })

    it('does not warn when Busca Aprofundada is done with zero candidates', () => {
      useDeepSearchStore().status = 'done'
      expect(unsavedEphemeralWorkWarning()).toBeNull()
    })

    it('combines both warnings when both stores have unsaved work', () => {
      useGenerationStore().status = 'feasible'
      useDeepSearchStore().status = 'running'
      const warning = unsavedEphemeralWorkWarning()
      expect(warning).toContain('horário gerado')
      expect(warning).toContain('Busca Aprofundada em andamento')
    })
  })

  describe('resetEphemeralWork', () => {
    it('resets both stores back to idle, discarding any result', () => {
      const generation = useGenerationStore()
      const deepSearch = useDeepSearchStore()
      generation.status = 'feasible'
      generation.schedule = { placements: [] }
      deepSearch.status = 'done'
      deepSearch.candidates = [candidate()]
      deepSearch.bestTotal = 3

      resetEphemeralWork()

      expect(generation.status).toBe('idle')
      expect(generation.schedule).toBeNull()
      expect(deepSearch.status).toBe('idle')
      expect(deepSearch.candidates).toEqual([])
      expect(deepSearch.bestTotal).toBeNull()
    })

    it('does not throw when nothing is running (cancel() is a safe no-op)', () => {
      expect(() => resetEphemeralWork()).not.toThrow()
    })
  })

  describe('confirmAndResetForProfileSwitch', () => {
    it('resets and returns true without prompting when nothing is at risk', () => {
      const confirmSpy = vi.spyOn(window, 'confirm')
      expect(confirmAndResetForProfileSwitch()).toBe(true)
      expect(confirmSpy).not.toHaveBeenCalled()
    })

    it('prompts and proceeds (resetting) when the user confirms', () => {
      useGenerationStore().status = 'feasible'
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

      expect(confirmAndResetForProfileSwitch()).toBe(true)
      expect(confirmSpy).toHaveBeenCalledOnce()
      expect(useGenerationStore().status).toBe('idle')
    })

    it('prompts and refuses — leaving state untouched — when the user cancels', () => {
      useGenerationStore().status = 'feasible'
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)

      expect(confirmAndResetForProfileSwitch()).toBe(false)
      expect(confirmSpy).toHaveBeenCalledOnce()
      expect(useGenerationStore().status).toBe('feasible')
    })
  })
})
