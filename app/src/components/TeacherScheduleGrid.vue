<script setup lang="ts">
import { computed, ref } from 'vue'
import { useEntitiesStore } from '../stores/entities'
import WeekGrid, { type WeekGridColumn, type WeekGridRow } from './WeekGrid.vue'
import { WEEKDAYS, WEEKDAY_LABELS } from '../entities/weekday'
import type { Schedule } from '../wasm/types'

// FR-21: the Per-Teacher weekly grid — that Teacher's assignments (Class +
// Subject) across every Class they teach. A Teacher can cross Segments with
// different period grids (D-01), so rows are the same cross-Segment union
// WeekGrid uses for Teacher Availability (D-15's `availabilityGridPeriods`)
// rather than one Segment's own Time Slots.

const props = defineProps<{ schedule: Schedule | null }>()

const entities = useEntitiesStore()

function classLabel(classId: string): string {
  const schoolClass = entities.classById(classId)
  if (!schoolClass) return '?'
  const grade = entities.gradeById(schoolClass.gradeId)
  const segment = grade ? entities.segmentById(grade.segmentId) : undefined
  return [segment?.name, grade?.name, schoolClass.name].filter(Boolean).join(' / ')
}

const allTeachers = computed(() =>
  [...entities.teachers]
    .map((t) => ({ id: t.id, label: entities.teacherLabel(t.id) }))
    .sort((a, b) => a.label.localeCompare(b.label)),
)

const selectedTeacherId = ref('')

const gridColumns: WeekGridColumn[] = WEEKDAYS.map((day) => ({
  key: day,
  label: WEEKDAY_LABELS[day],
}))

const gridRows = computed<WeekGridRow[]>(() =>
  entities.availabilityGridPeriods.map((p) => ({
    key: `${p.start}-${p.end}`,
    label: `${p.start}–${p.end}`,
  })),
)

/** A placement's real clock time, resolved via its Class's Segment (D-01) — needed to match it to a grid row. */
function resolvePlacementTime(
  classId: string,
  timeSlotId: string,
): { start: string; end: string } | undefined {
  const schoolClass = entities.classById(classId)
  const grade = schoolClass ? entities.gradeById(schoolClass.gradeId) : undefined
  const segment = grade ? entities.segmentById(grade.segmentId) : undefined
  return segment?.timeSlots.find((t) => t.id === timeSlotId)
}

interface CellContent {
  classLabel: string
  subject: string
}

const placementsByCell = computed<Map<string, CellContent>>(() => {
  const map = new Map<string, CellContent>()
  const schedule = props.schedule
  if (!schedule || !selectedTeacherId.value) return map
  for (const p of schedule.placements) {
    if (p.teacherId !== selectedTeacherId.value) continue
    const time = resolvePlacementTime(p.classId, p.timeSlotId)
    if (!time) continue
    map.set(`${p.weekday}:${time.start}-${time.end}`, {
      classLabel: classLabel(p.classId),
      subject: entities.subjectById(p.subjectId)?.name ?? '?',
    })
  }
  return map
})

function cellContent(weekday: string, rowKey: string): CellContent | undefined {
  return placementsByCell.value.get(`${weekday}:${rowKey}`)
}
</script>

<template>
  <label class="field">
    <span class="field-label">Ver professor</span>
    <select v-model="selectedTeacherId" class="input">
      <option value="" disabled>Selecione…</option>
      <option v-for="t in allTeachers" :key="t.id" :value="t.id">{{ t.label }}</option>
    </select>
  </label>

  <WeekGrid
    v-if="selectedTeacherId"
    :columns="gridColumns"
    :rows="gridRows"
    style="margin-top: var(--space-4)"
  >
    <template #cell="{ column, row }">
      <div v-if="cellContent(column.key, row.key)" class="pill">
        {{ cellContent(column.key, row.key)!.classLabel }}<br />
        <small>{{ cellContent(column.key, row.key)!.subject }}</small>
      </div>
    </template>
  </WeekGrid>
</template>
