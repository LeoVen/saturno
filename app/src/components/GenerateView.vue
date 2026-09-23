<script setup lang="ts">
import { computed, ref } from 'vue'
import { useEntitiesStore } from '../stores/entities'
import { useGenerationStore } from '../stores/generation'
import { useScheduleVersionsStore } from '../stores/scheduleVersions'
import { overloadMessage, zeroOverlapMessage } from '../entities/validationMessages'
import ScheduleGrid from './ScheduleGrid.vue'

// E06: the first screen where Saturno actually produces a schedule
// (FR-14/FR-16). E07-T2: a feasible result can be saved as a named
// Schedule Version from here — the Versões screen owns switching/
// duplicating/renaming from that point on.

const entities = useEntitiesStore()
const generation = useGenerationStore()
const scheduleVersions = useScheduleVersionsStore()

// FR-13 pre-generation gate: the same structural checks E05 already
// surfaces on the Assignments screen also block "Gerar" here — a bad
// configuration should never even reach the solver.
const validationWarnings = computed(
  () => entities.overloadedClasses.length > 0 || entities.zeroOverlapAssignments.length > 0,
)

async function onGenerate(): Promise<void> {
  if (validationWarnings.value) return
  await generation.generate()
}

const newVersionName = ref('')
const savedVersionId = ref('')

function saveAsVersion(): void {
  const name = newVersionName.value.trim()
  if (!name || !generation.schedule) return
  savedVersionId.value = scheduleVersions.createFromSchedule(name, generation.schedule)
  newVersionName.value = ''
}
</script>

<template>
  <h2>Gerar Horário</h2>

  <div v-if="validationWarnings" class="card">
    <h3>Corrija antes de gerar</h3>
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
    <button
      type="button"
      class="btn btn-primary"
      :disabled="validationWarnings || generation.status === 'running'"
      @click="onGenerate"
    >
      {{ generation.status === 'running' ? 'Gerando…' : 'Gerar Horário' }}
    </button>

    <p v-if="generation.status === 'infeasible'" class="alert alert-danger" role="alert">
      {{ generation.infeasibilityMessage }}
    </p>
    <p v-if="generation.status === 'error'" class="alert alert-danger" role="alert">
      Erro ao gerar o horário: {{ generation.errorMessage }}
    </p>
    <p v-if="generation.status === 'feasible'" class="muted">Horário gerado com sucesso.</p>

    <form
      v-if="generation.status === 'feasible'"
      class="row"
      style="margin-top: var(--space-3)"
      @submit.prevent="saveAsVersion"
    >
      <label class="field">
        <span class="field-label">Nome da versão</span>
        <input v-model="newVersionName" class="input" type="text" placeholder="ex.: 2026" />
      </label>
      <button type="submit" class="btn">Salvar como nova versão</button>
    </form>
    <p v-if="savedVersionId" class="muted">Versão salva. Veja e gerencie em "Versões".</p>
  </div>

  <div v-if="generation.status === 'feasible'" class="card">
    <ScheduleGrid :schedule="generation.schedule" />
  </div>
</template>
