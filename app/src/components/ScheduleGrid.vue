<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useEntitiesStore } from '../stores/entities'
import { useScheduleVersionsStore } from '../stores/scheduleVersions'
import WeekGrid, { type WeekGridColumn, type WeekGridRow } from './WeekGrid.vue'
import { WEEKDAYS, WEEKDAY_LABELS, type Weekday } from '../entities/weekday'
import type { Schedule, Violation } from '../wasm/types'
import { buildScheduleInput, verifySchedule } from '../solver/generationCoordinator'
import { conflictMessagesByCell } from '../entities/conflictFlags'

// FR-20: the Per-Class weekly grid — each occupied period shows both
// Subject and Teacher. Shared by E06's just-generated result, E07's
// Schedule Versions preview, and E08's Views screen (TeacherScheduleGrid.vue
// is FR-21's per-Teacher counterpart).
//
// E09: when `editable` + `versionId` are both given (only true from the
// Views screen, on a saved Schedule Version — FR-19's Notes need a real
// version id to attach to, and FR-17's edits only make sense once there's
// something saved to edit), this also supports:
// - FR-17: click a placement to pick it up, click another slot to move it
//   there (or swap, if that slot is already occupied).
// - FR-18: a live conflict flag, recomputed from `verify` (via the same
//   Worker E06 uses) whenever the Schedule changes — never persisted
//   (IMPL.md §4.1/§7), never blocking the edit that caused it.
// - FR-19: a free-text Note on any slot.

const props = defineProps<{
  schedule: Schedule | null
  editable?: boolean
  versionId?: string
}>()

const entities = useEntitiesStore()
const scheduleVersions = useScheduleVersionsStore()

const canEdit = computed(() => Boolean(props.editable && props.versionId))

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

// FR-31: a Joint Session occurrence, shown distinctly from a normal
// period (own styling below, no Subject/Teacher pill) whenever the
// selected Class participates in it.
interface JointCellContent {
  sessionName: string
}

const jointSessionByCell = computed<Map<string, JointCellContent>>(() => {
  const map = new Map<string, JointCellContent>()
  const schedule = props.schedule
  if (!schedule || !selectedClassId.value) return map
  for (const jp of schedule.jointSessionPlacements ?? []) {
    const session = entities.jointSessionById(jp.jointSessionId)
    if (!session || !session.classIds.includes(selectedClassId.value)) continue
    map.set(`${jp.weekday}:${jp.timeSlotId}`, { sessionName: session.name })
  }
  return map
})

function jointSessionContent(weekday: string, timeSlotId: string): JointCellContent | undefined {
  return jointSessionByCell.value.get(`${weekday}:${timeSlotId}`)
}

// FR-17: click-to-pick-up, click-to-place (move, or swap if the target is occupied).
const pickedUp = ref<{ weekday: string; timeSlotId: string } | null>(null)

function isPickedUp(weekday: string, timeSlotId: string): boolean {
  return pickedUp.value?.weekday === weekday && pickedUp.value.timeSlotId === timeSlotId
}

function onCellClick(weekday: string, timeSlotId: string): void {
  if (!canEdit.value) return
  // A Joint Session occurrence isn't an Assignment placement — nothing to
  // pick up, and never a valid move target (that would silently create a
  // real, but invisible-until-verified, FR-29 conflict).
  if (jointSessionContent(weekday, timeSlotId)) return
  if (pickedUp.value) {
    const from = pickedUp.value
    pickedUp.value = null
    if (from.weekday === weekday && from.timeSlotId === timeSlotId) return
    scheduleVersions.movePlacement(
      props.versionId!,
      {
        classId: selectedClassId.value,
        weekday: from.weekday as Weekday,
        timeSlotId: from.timeSlotId,
      },
      { classId: selectedClassId.value, weekday: weekday as Weekday, timeSlotId },
    )
    return
  }
  if (cellContent(weekday, timeSlotId)) {
    pickedUp.value = { weekday, timeSlotId }
  }
}

// FR-18: live conflict flags — recomputed from `verify` whenever the
// Schedule changes, never persisted, never blocking a save.
const violations = ref<Violation[]>([])

watch(
  () => props.schedule,
  async (schedule) => {
    if (!schedule) {
      violations.value = []
      return
    }
    try {
      violations.value = await verifySchedule(buildScheduleInput(entities), schedule)
    } catch {
      violations.value = []
    }
  },
  { immediate: true },
)

const conflictsByCell = computed(() => {
  if (!props.schedule || !selectedClassId.value) return new Map<string, string[]>()
  const classPlacements = props.schedule.placements.filter(
    (p) => p.classId === selectedClassId.value,
  )
  return conflictMessagesByCell(violations.value, classPlacements)
})

function conflictMessages(weekday: string, timeSlotId: string): string[] | undefined {
  return conflictsByCell.value.get(`${weekday}:${timeSlotId}`)
}

// FR-19: a slot-level Note, one editor open at a time.
const noteEditorSlot = ref<{ weekday: string; timeSlotId: string } | null>(null)
const noteDraft = ref('')

function noteForCell(weekday: string, timeSlotId: string) {
  if (!props.versionId || !selectedClassId.value) return undefined
  return scheduleVersions.noteForSlot(props.versionId, {
    classId: selectedClassId.value,
    weekday: weekday as Weekday,
    timeSlotId,
  })
}

function isNoteEditorOpen(weekday: string, timeSlotId: string): boolean {
  return noteEditorSlot.value?.weekday === weekday && noteEditorSlot.value.timeSlotId === timeSlotId
}

function toggleNoteEditor(weekday: string, timeSlotId: string): void {
  if (isNoteEditorOpen(weekday, timeSlotId)) {
    noteEditorSlot.value = null
    return
  }
  noteEditorSlot.value = { weekday, timeSlotId }
  noteDraft.value = noteForCell(weekday, timeSlotId)?.text ?? ''
}

function saveNote(weekday: string, timeSlotId: string): void {
  if (!props.versionId || !selectedClassId.value || !noteDraft.value.trim()) return
  const slot = { classId: selectedClassId.value, weekday: weekday as Weekday, timeSlotId }
  const existing = scheduleVersions.noteForSlot(props.versionId, slot)
  if (existing) {
    scheduleVersions.updateNote(props.versionId, existing.id, noteDraft.value)
  } else {
    scheduleVersions.addNote(props.versionId, noteDraft.value, slot)
  }
  noteEditorSlot.value = null
}

function deleteNote(weekday: string, timeSlotId: string): void {
  if (!props.versionId) return
  const existing = noteForCell(weekday, timeSlotId)
  if (existing) scheduleVersions.removeNote(props.versionId, existing.id)
  noteEditorSlot.value = null
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
      <div class="cell-stack">
        <div
          class="cell-target"
          :class="{ editable: canEdit && !jointSessionContent(column.key, row.key) }"
          @click="onCellClick(column.key, row.key)"
        >
          <div v-if="jointSessionContent(column.key, row.key)" class="pill joint-session">
            {{ jointSessionContent(column.key, row.key)!.sessionName }}
          </div>
          <div
            v-else-if="cellContent(column.key, row.key)"
            class="pill"
            :class="{
              selected: isPickedUp(column.key, row.key),
              conflict: conflictMessages(column.key, row.key),
            }"
            :title="conflictMessages(column.key, row.key)?.join(' ')"
          >
            {{ cellContent(column.key, row.key)!.subject }}<br />
            <small>{{ cellContent(column.key, row.key)!.teacher }}</small>
          </div>
        </div>

        <button
          v-if="canEdit"
          type="button"
          class="note-toggle"
          :class="{ 'has-note': noteForCell(column.key, row.key) }"
          @click.stop="toggleNoteEditor(column.key, row.key)"
        >
          Nota
        </button>

        <div v-if="isNoteEditorOpen(column.key, row.key)" class="note-editor" @click.stop>
          <textarea
            v-model="noteDraft"
            class="input"
            rows="2"
            placeholder="Motivo da alteração…"
          ></textarea>
          <div class="row">
            <button
              type="button"
              class="btn btn-primary btn-sm"
              @click="saveNote(column.key, row.key)"
            >
              Salvar
            </button>
            <button
              v-if="noteForCell(column.key, row.key)"
              type="button"
              class="btn btn-danger btn-sm"
              @click="deleteNote(column.key, row.key)"
            >
              Remover
            </button>
            <button type="button" class="btn btn-sm" @click="noteEditorSlot = null">
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </template>
  </WeekGrid>
</template>

<style scoped>
.cell-stack {
  display: flex;
  flex-direction: column;
  gap: 2px;
  position: relative;
}

.cell-target.editable {
  cursor: pointer;
  min-height: 1.5rem;
}

.pill.conflict {
  border-color: var(--color-danger-border);
  background: var(--color-danger-bg);
}

/** FR-31: a Joint Session occurrence reads as visually distinct from an ordinary Subject/Teacher period. */
.pill.joint-session {
  background: #ede9fe;
  border-color: #c4b5fd;
  color: #5b21b6;
  font-weight: 600;
  cursor: default;
}

.note-toggle {
  font: inherit;
  font-size: 0.7rem;
  padding: 1px 4px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  background: none;
  color: var(--color-text-muted);
  cursor: pointer;
  align-self: flex-start;
}

.note-toggle.has-note {
  border-color: var(--color-primary);
  color: var(--color-primary);
  font-weight: 600;
}

.note-editor {
  position: absolute;
  z-index: 5;
  top: 100%;
  left: 0;
  width: 14rem;
  padding: var(--space-2);
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border-strong);
  background: var(--color-surface);
  box-shadow: 0 2px 8px rgb(0 0 0 / 15%);
}

.note-editor textarea {
  width: 100%;
  margin-bottom: var(--space-2);
}
</style>
