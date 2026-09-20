<script setup lang="ts">
import { computed, ref } from 'vue'
import { useEntitiesStore } from '../stores/entities'
import WeekGrid, { type WeekGridColumn, type WeekGridRow } from './WeekGrid.vue'
import { WEEKDAYS, WEEKDAY_LABELS } from '../entities/weekday'
import type { Schedule } from '../wasm/types'

// FR-20: the Per-Class weekly grid — each occupied period shows both
// Subject and Teacher. Shared by E06's just-generated result, E07's
// Schedule Versions preview, and E08's Views screen (TeacherScheduleGrid.vue
// is FR-21's per-Teacher counterpart).

const props = defineProps<{ schedule: Schedule | null }>()

const entities = useEntitiesStore()

function classLabel(classId: string): string {
  const schoolClass = entities.classById(classId)
  if (!schoolClass) return '?'
  const grade = entities.gradeById(schoolClass.gradeId)
  const segment = grade ? entities.segmentById(grade.segmentId) : undefined
  return [segment?.name, grade?.name, schoolClass.name].filter(Boolean).join(' / ')
}

// Segment/Grade/Class order (both Grade and Class levels user-reorderable),
// not an alphabetical relabeling — see entities store's `orderedClasses`.
const allClasses = computed(() =>
  entities.orderedClasses.map((c) => ({ id: c.id, label: classLabel(c.id) })),
)

const selectedClassId = ref('')

const gridColumns: WeekGridColumn[] = WEEKDAYS.map((day) => ({
  key: day,
  label: WEEKDAY_LABELS[day],
}))

function timeSlotsFor(classId: string): { id: string; start: string; end: string }[] {
  const schoolClass = entities.classById(classId)
  const grade = schoolClass ? entities.gradeById(schoolClass.gradeId) : undefined
  const segment = grade ? entities.segmentById(grade.segmentId) : undefined
  return segment?.timeSlots ?? []
}

const gridRows = computed<WeekGridRow[]>(() => {
  if (!selectedClassId.value) return []
  return timeSlotsFor(selectedClassId.value).map((slot) => ({
    key: slot.id,
    label: `${slot.start}–${slot.end}`,
  }))
})

interface CellContent {
  subject: string
  teacher: string
}

const placementsByCell = computed<Map<string, CellContent>>(() => {
  const map = new Map<string, CellContent>()
  const schedule = props.schedule
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
</template>
