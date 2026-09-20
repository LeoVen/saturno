<script setup lang="ts">
import { computed, ref } from 'vue'
import { useEntitiesStore } from '../stores/entities'
import { useGenerationStore } from '../stores/generation'
import WeekGrid, { type WeekGridColumn, type WeekGridRow } from './WeekGrid.vue'
import { WEEKDAYS, type Weekday } from '../entities/weekday'

// E06: the first screen where Saturno actually produces a schedule
// (FR-14/FR-16). The full per-Class/per-Teacher views (FR-20/21) are E08's
// job — this is a minimal grid sufficient to spot-check the epic's Human
// Verification steps, not the final views screen.

const WEEKDAY_LABELS: Record<Weekday, string> = {
  mon: 'Segunda',
  tue: 'Terça',
  wed: 'Quarta',
  thu: 'Quinta',
  fri: 'Sexta',
}

const entities = useEntitiesStore()
const generation = useGenerationStore()

function classLabel(classId: string): string {
  const schoolClass = entities.classById(classId)
  if (!schoolClass) return '?'
  const grade = entities.gradeById(schoolClass.gradeId)
  const segment = grade ? entities.segmentById(grade.segmentId) : undefined
  return [segment?.name, grade?.name, schoolClass.name].filter(Boolean).join(' / ')
}

function overloadMessage(classId: string, requiredWeekly: number, availableWeekly: number): string {
  return `${classLabel(classId)}: requer ${requiredWeekly} aula(s) por semana, mas o segmento só oferece ${availableWeekly} período(s) não vagos por semana.`
}

function zeroOverlapMessage(assignmentId: string, teacherId: string, classId: string): string {
  const subjectId = entities.assignmentById(assignmentId)?.subjectId
  const subjectLabel = subjectId ? entities.subjectById(subjectId)?.name : undefined
  return `${entities.teacherLabel(teacherId)}: nenhum horário disponível compatível com ${classLabel(classId)}${subjectLabel ? ` para a disciplina ${subjectLabel}` : ''}.`
}

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

const allClasses = computed(() =>
  [...entities.classes]
    .map((c) => ({ id: c.id, label: classLabel(c.id) }))
    .sort((a, b) => a.label.localeCompare(b.label)),
)

const selectedClassId = ref('')

const gridColumns: WeekGridColumn[] = WEEKDAYS.map((day) => ({
  key: day,
  label: WEEKDAY_LABELS[day],
}))

const gridRows = computed<WeekGridRow[]>(() => {
  if (!selectedClassId.value) return []
  return entities.classWeeklyPeriods(selectedClassId.value).length
    ? timeSlotsFor(selectedClassId.value).map((slot) => ({
        key: slot.id,
        label: `${slot.start}–${slot.end}`,
      }))
    : []
})

function timeSlotsFor(classId: string): { id: string; start: string; end: string }[] {
  const schoolClass = entities.classById(classId)
  const grade = schoolClass ? entities.gradeById(schoolClass.gradeId) : undefined
  const segment = grade ? entities.segmentById(grade.segmentId) : undefined
  return segment?.timeSlots ?? []
}

interface CellContent {
  subject: string
  teacher: string
}

const placementsByCell = computed<Map<string, CellContent>>(() => {
  const map = new Map<string, CellContent>()
  const schedule = generation.schedule
  if (!schedule || !selectedClassId.value) return map
  for (const p of schedule.placements) {
    if (p.classId !== selectedClassId.value) continue
    map.set(`${p.weekday}:${p.timeSlotId}`, {
      subject: entities.subjectById(p.subjectId)?.name ?? '?',
      teacher: entities.teacherLabel(p.teacherId),
    })
  }
  return map
})

function cellContent(weekday: string, timeSlotId: string): CellContent | undefined {
  return placementsByCell.value.get(`${weekday}:${timeSlotId}`)
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
        {{ overloadMessage(w.classId, w.requiredWeekly, w.availableWeekly) }}
      </li>
      <li
        v-for="w in entities.zeroOverlapAssignments"
        :key="w.assignmentId"
        class="alert alert-danger"
        role="alert"
      >
        {{ zeroOverlapMessage(w.assignmentId, w.teacherId, w.classId) }}
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
  </div>

  <div v-if="generation.status === 'feasible'" class="card">
    <label class="field">
      <span class="field-label">Ver turma</span>
      <select v-model="selectedClassId" class="input">
        <option value="" disabled>Selecione…</option>
        <option v-for="c in allClasses" :key="c.id" :value="c.id">{{ c.label }}</option>
      </select>
    </label>

    <WeekGrid
      v-if="selectedClassId"
      :columns="gridColumns"
      :rows="gridRows"
      style="margin-top: var(--space-4)"
    >
      <template #cell="{ column, row }">
        <div v-if="cellContent(column.key, row.key)" class="pill">
          {{ cellContent(column.key, row.key)!.subject }}<br />
          <small>{{ cellContent(column.key, row.key)!.teacher }}</small>
        </div>
      </template>
    </WeekGrid>
  </div>
</template>
