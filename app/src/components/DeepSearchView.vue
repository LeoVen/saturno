<script setup lang="ts">
import { computed, ref } from 'vue'
import { useEntitiesStore } from '../stores/entities'
import { useDeepSearchStore } from '../stores/deepSearch'
import { useScheduleVersionsStore } from '../stores/scheduleVersions'
import { overloadMessage, zeroOverlapMessage } from '../entities/validationMessages'
import ScheduleGrid from './ScheduleGrid.vue'
import type { Candidate } from '../wasm/types'

// FR-32/33/34, IMPL.md §3/§5 (E13-T7): "Busca Aprofundada" (GL.md's own
// pt-BR term) — the deep-mode counterpart to GenerateView.vue's quick
// mode. Runs a time-boxed Worker-pool search (deepSearch store ->
// solver/deepSearchCoordinator.ts), shows live progress while it's
// running, and — once done — a ranked, deduplicated candidate list the
// user can preview and adopt any number of as new Schedule Versions
// (FR-33: not just one, and not an all-or-nothing choice).

const entities = useEntitiesStore()
const deepSearch = useDeepSearchStore()
const scheduleVersions = useScheduleVersionsStore()

// FR-13's pre-generation gate — identical check to GenerateView.vue's own,
// shared via entities/validationMessages.ts.
const validationWarnings = computed(
  () => entities.overloadedClasses.length > 0 || entities.zeroOverlapAssignments.length > 0,
)

const timeBudgetMinutes = ref(2)

function onStart(): void {
  if (validationWarnings.value || deepSearch.status === 'running') return
  selectedIndex.value = null
  // `Number.isFinite` guards an empty/cleared number input (`NaN`), not
  // just a non-positive one — `Math.max(1, NaN)` is itself `NaN`, which
  // would silently send an invalid time budget into the solver.
  const minutes =
    Number.isFinite(timeBudgetMinutes.value) && timeBudgetMinutes.value > 0
      ? timeBudgetMinutes.value
      : 1
  void deepSearch.start(minutes * 60_000)
}

function onCancel(): void {
  deepSearch.cancel()
}

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

const selectedIndex = ref<number | null>(null)
const selectedCandidate = computed<Candidate | null>(() => {
  if (selectedIndex.value === null) return null
  return deepSearch.candidates[selectedIndex.value] ?? null
})

function previewCandidate(index: number): void {
  selectedIndex.value = selectedIndex.value === index ? null : index
}

// FR-33: adopting a candidate never discards the others still in the
// ranked list — the user can repeat this for as many candidates as they
// want to keep, each becoming its own independent Schedule Version
// (FR-24), same "Duplicar"-style native prompt() INTERLUDE-2 already uses
// for a one-off name entry rather than a dedicated form per row.
function adoptCandidate(candidate: Candidate, rank: number): void {
  const name = window.prompt('Nome da nova versão:', `Busca Aprofundada ${rank}`)
  const trimmed = name?.trim()
  if (!trimmed) return
  scheduleVersions.createFromSchedule(trimmed, candidate.schedule)
}
</script>

<template>
  <h2>Busca Aprofundada</h2>

  <div v-if="validationWarnings" class="card">
    <h3>Corrija antes de buscar</h3>
    <ul class="alert-list">
      <li
        v-for="w in entities.overloadedClasses"
        :key="w.classId"
        class="alert alert-danger"
        role="alert"
      >
        {{ overloadMessage(entities, w.classId, w.requiredWeekly, w.availableWeekly) }}
      </li>
      <li
        v-for="w in entities.zeroOverlapAssignments"
        :key="w.assignmentId"
        class="alert alert-danger"
        role="alert"
      >
        {{ zeroOverlapMessage(entities, w.assignmentId, w.teacherId, w.classId) }}
      </li>
    </ul>
  </div>

  <div class="card">
    <div class="row" style="align-items: flex-end">
      <label class="field">
        <span class="field-label">Tempo de busca (minutos)</span>
        <input
          v-model.number="timeBudgetMinutes"
          class="input"
          type="number"
          min="1"
          step="1"
          :disabled="deepSearch.status === 'running'"
          style="width: 8ch"
        />
      </label>
      <button
        v-if="deepSearch.status !== 'running'"
        type="button"
        class="btn btn-primary"
        :disabled="validationWarnings"
        @click="onStart"
      >
        Iniciar Busca
      </button>
      <button v-else type="button" class="btn btn-danger" @click="onCancel">Cancelar Busca</button>
    </div>

    <p v-if="deepSearch.status === 'running'" class="muted" style="margin-top: var(--space-3)">
      {{ formatElapsed(deepSearch.elapsedMs) }} decorridos · {{ deepSearch.candidatesFound }}
      candidato(s) encontrado(s)
      <template v-if="deepSearch.bestTotal !== null">
        · melhor pontuação até agora: {{ deepSearch.bestTotal.toFixed(1) }}
      </template>
    </p>

    <p v-if="deepSearch.status === 'infeasible'" class="alert alert-danger" role="alert">
      {{ deepSearch.infeasibilityReport?.message }}
    </p>
    <p v-if="deepSearch.status === 'error'" class="alert alert-danger" role="alert">
      Erro na busca: {{ deepSearch.errorMessage }}
    </p>
    <p v-if="deepSearch.status === 'done'" class="muted" style="margin-top: var(--space-3)">
      Busca concluída em {{ formatElapsed(deepSearch.elapsedMs) }} —
      {{ deepSearch.candidates.length }} candidato(s) distinto(s) encontrado(s).
    </p>
  </div>

  <div v-if="deepSearch.status === 'done' && deepSearch.candidates.length > 0" class="card">
    <h3>Candidatos (do melhor para o pior)</h3>
    <p class="muted">
      Pontuação: quanto menor, melhor — combina janelas dos professores e distribuição das
      disciplinas ao longo da semana.
    </p>
    <table class="table">
      <thead>
        <tr>
          <th>#</th>
          <th>Pontuação</th>
          <th>Janelas</th>
          <th>Distribuição</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(candidate, index) in deepSearch.candidates"
          :key="index"
          :class="{ selected: selectedIndex === index }"
        >
          <td>{{ index + 1 }}</td>
          <td>{{ candidate.score.total.toFixed(1) }}</td>
          <td>{{ candidate.score.teacherGapPenalty.toFixed(1) }}</td>
          <td>{{ candidate.score.subjectDistributionPenalty.toFixed(1) }}</td>
          <td>
            <div class="row">
              <button type="button" class="btn btn-sm" @click="previewCandidate(index)">
                {{ selectedIndex === index ? 'Ocultar' : 'Visualizar' }}
              </button>
              <button
                type="button"
                class="btn btn-primary btn-sm"
                @click="adoptCandidate(candidate, index + 1)"
              >
                Adotar como versão
              </button>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>

  <div v-if="selectedCandidate" class="card">
    <ScheduleGrid :schedule="selectedCandidate.schedule" />
  </div>
</template>

<style scoped>
.table tr.selected {
  background: var(--profile-color-soft, var(--color-surface));
}
</style>
