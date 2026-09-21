<script setup lang="ts">
import { computed, ref } from 'vue'
import { useEntitiesStore } from '../stores/entities'
import WeekGrid, { type WeekGridColumn, type WeekGridRow } from './WeekGrid.vue'
import { WEEKDAYS, WEEKDAY_LABELS } from '../entities/weekday'
import { buildTeacherScheduleGrid } from '../entities/teacherSchedule'
import type { Schedule } from '../wasm/types'

// FR-21: the Per-Teacher weekly grid — that Teacher's assignments (Class +
// Subject) across every Class they teach. Most Teachers only ever teach in
// one Segment; for the minority who cross Segments with different period
// grids (D-01), this is ONE merged grid (not one per Segment, D-29's
// original approach) with any real idle time between an assignment ending
// in one Segment and the next starting in another shown as a distinct
// "gap" cell (FR-15) rather than silently blank. See teacherSchedule.ts.

const props = defineProps<{ schedule: Schedule | null }>()

const entities = useEntitiesStore()

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

const entitiesSnapshot = computed(() => ({
  segments: entities.segments,
  grades: entities.grades,
  classes: entities.classes,
  subjects: entities.subjects,
  teachers: entities.teachers,
  assignments: entities.assignments,
}))

const teacherGrid = computed(() => {
  if (!props.schedule || !selectedTeacherId.value) return null
  return buildTeacherScheduleGrid(entitiesSnapshot.value, props.schedule, selectedTeacherId.value)
})

const gridRows = computed<WeekGridRow[]>(
  () =>
    teacherGrid.value?.rows.map((r) => ({
      key: r.key,
      label: r.label,
      variant: r.kind === 'break' ? 'break-row' : undefined,
    })) ?? [],
)

function cellContent(weekday: string, rowKey: string) {
  return teacherGrid.value?.cells.get(`${weekday}:${rowKey}`)
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

  <template v-if="selectedTeacherId">
    <p v-if="!teacherGrid" class="empty" style="margin-top: var(--space-4)">
      Este professor não tem aulas na versão ativa.
    </p>
    <div v-else class="grid-group">
      <h5>{{ teacherGrid.segmentNames.join(' + ') }}</h5>
      <WeekGrid :columns="gridColumns" :rows="gridRows">
        <template #cell="{ column, row }">
          <div v-if="cellContent(column.key, row.key)?.kind === 'occupied'" class="pill">
            {{ cellContent(column.key, row.key)!.classLabel }}<br />
            <small>{{ cellContent(column.key, row.key)!.subject }}</small>
          </div>
          <div v-else-if="cellContent(column.key, row.key)?.kind === 'gap'" class="pill pill-gap">
            <small>Janela</small>
          </div>
        </template>
      </WeekGrid>
    </div>
  </template>
</template>

<style scoped>
.grid-group {
  margin-top: var(--space-4);
}

.grid-group h5 {
  margin: 0 0 var(--space-2);
  color: var(--color-text-muted);
}

.pill-gap {
  background: repeating-linear-gradient(
    45deg,
    var(--color-border),
    var(--color-border) 4px,
    transparent 4px,
    transparent 8px
  );
  color: var(--color-text-muted);
  text-align: center;
}

:deep(.week-grid-cell.break-row) {
  background: var(--color-border);
  min-height: 0.5rem;
}

:deep(.week-grid-row-header.break-row) {
  font-size: 0.7rem;
  color: var(--color-text-muted);
}
</style>
