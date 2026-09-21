<script setup lang="ts">
import { computed, ref } from 'vue'
import { useEntitiesStore } from '../stores/entities'
import WeekGrid, { type WeekGridColumn, type WeekGridRow } from './WeekGrid.vue'
import { WEEKDAYS, WEEKDAY_LABELS } from '../entities/weekday'
import type { Schedule } from '../wasm/types'

// FR-21: the Per-Teacher weekly grid — that Teacher's assignments (Class +
// Subject) across every Class they teach. A Teacher can cross Segments with
// different period grids (D-01), so this shows one grid per Segment (D-29)
// rather than merging every Segment's Time Slots into one misleadingly
// continuous list.

const props = defineProps<{ schedule: Schedule | null }>()

const entities = useEntitiesStore()

function classLabel(classId: string): string {
  const schoolClass = entities.classById(classId)
  if (!schoolClass) return '?'
  const grade = entities.gradeById(schoolClass.gradeId)
  const segment = grade ? entities.segmentById(grade.segmentId) : undefined
  return [segment?.name, grade?.name, schoolClass.name].filter(Boolean).join(' / ')
}

// Store order, not an alphabetical relabeling — Teachers are user-orderable
// (D-26) on the Professores screen, and every picker should reflect that.
const allTeachers = computed(() =>
  entities.teachers.map((t) => ({ id: t.id, label: entities.teacherLabel(t.id) })),
)

const selectedTeacherId = ref('')

const gridColumns: WeekGridColumn[] = WEEKDAYS.map((day) => ({
  key: day,
  label: WEEKDAY_LABELS[day],
}))

const gridGroups = computed(() =>
  entities.availabilityGridGroups.map((group) => ({
    ...group,
    rows: group.periods.map((p): WeekGridRow => ({
      key: `${p.start}-${p.end}`,
      label: `${p.start}–${p.end}`,
    })),
  })),
)

/** A placement's Segment id + real clock time, resolved via its Class's Segment (D-01) — needed to match it to a grid row without leaking across Segments that happen to share a clock time (e.g. two Segments both starting 07:00–07:50). */
function resolvePlacementTime(
  classId: string,
  timeSlotId: string,
): { segmentId: string; start: string; end: string } | undefined {
  const schoolClass = entities.classById(classId)
  const grade = schoolClass ? entities.gradeById(schoolClass.gradeId) : undefined
  const segment = grade ? entities.segmentById(grade.segmentId) : undefined
  const slot = segment?.timeSlots.find((t) => t.id === timeSlotId)
  if (!segment || !slot) return undefined
  return { segmentId: segment.id, start: slot.start, end: slot.end }
}

interface CellContent {
  classLabel: string
  subject: string
}

// Keyed by segmentId too, not just weekday+clock-time: two Segments can
// define Time Slots with the identical start-end (common when their grids
// mostly overlap, e.g. EF and EM both running 07:00–07:50), and each
// Segment gets its own grid-group with its own row for that time. Without
// the segmentId, a placement from one Segment's grid would also render in
// the other Segment's grid at the matching row.
const placementsByCell = computed<Map<string, CellContent>>(() => {
  const map = new Map<string, CellContent>()
  const schedule = props.schedule
  if (!schedule || !selectedTeacherId.value) return map
  for (const p of schedule.placements) {
    if (p.teacherId !== selectedTeacherId.value) continue
    const time = resolvePlacementTime(p.classId, p.timeSlotId)
    if (!time) continue
    map.set(`${time.segmentId}:${p.weekday}:${time.start}-${time.end}`, {
      classLabel: classLabel(p.classId),
      subject: entities.subjectById(p.subjectId)?.name ?? '?',
    })
  }
  return map
})

function cellContent(
  segmentId: string | null,
  weekday: string,
  rowKey: string,
): CellContent | undefined {
  return placementsByCell.value.get(`${segmentId}:${weekday}:${rowKey}`)
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

  <div
    v-for="group in selectedTeacherId ? gridGroups : []"
    :key="group.segmentId ?? 'sem-segmento'"
    class="grid-group"
  >
    <h5 v-if="group.segmentName">{{ group.segmentName }}</h5>
    <WeekGrid :columns="gridColumns" :rows="group.rows">
      <template #cell="{ column, row }">
        <div v-if="cellContent(group.segmentId, column.key, row.key)" class="pill">
          {{ cellContent(group.segmentId, column.key, row.key)!.classLabel }}<br />
          <small>{{ cellContent(group.segmentId, column.key, row.key)!.subject }}</small>
        </div>
      </template>
    </WeekGrid>
  </div>
</template>

<style scoped>
.grid-group {
  margin-top: var(--space-4);
}

.grid-group h5 {
  margin: 0 0 var(--space-2);
  color: var(--color-text-muted);
}
</style>
