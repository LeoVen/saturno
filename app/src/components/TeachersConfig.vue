<script setup lang="ts">
import { computed, ref } from 'vue'
import { useEntitiesStore } from '../stores/entities'
import { WEEKDAYS, WEEKDAY_LABELS, type Weekday } from '../entities/weekday'
import WeekGrid, { type WeekGridColumn, type WeekGridRow } from './WeekGrid.vue'

const store = useEntitiesStore()

const newTeacherName = ref('')
const selectedTeacherId = ref('')

const selectedTeacher = computed(() =>
  selectedTeacherId.value ? store.teacherById(selectedTeacherId.value) : undefined,
)

function createTeacher(): void {
  const name = newTeacherName.value.trim()
  if (!name) return
  selectedTeacherId.value = store.addTeacher(name)
  newTeacherName.value = ''
}

function renameTeacher(id: string, event: Event): void {
  store.renameTeacher(id, (event.target as HTMLInputElement).value)
}

function deleteTeacher(id: string): void {
  store.removeTeacher(id)
  if (selectedTeacherId.value === id) selectedTeacherId.value = ''
}

// D-25: which Subjects this Teacher can teach — narrows the Teacher picker
// shown when building an Assignment (Turma x Disciplina).
function toggleSubject(teacherId: string, subjectId: string, event: Event): void {
  if ((event.target as HTMLInputElement).checked) {
    store.addTeacherSubject(teacherId, subjectId)
  } else {
    store.removeTeacherSubject(teacherId, subjectId)
  }
}

// FR-11: per-Teacher optional daily/consecutive-period limits.
type LimitField = 'maxPeriodsPerDay' | 'minConsecutivePeriods' | 'maxConsecutivePeriods'
const limitsError = ref('')

function onLimitChange(field: LimitField, event: Event): void {
  if (!selectedTeacher.value) return
  const raw = (event.target as HTMLInputElement).value
  const value = raw === '' ? undefined : Number(raw)
  const ok = store.setTeacherLimits(selectedTeacher.value.id, {
    maxPeriodsPerDay: selectedTeacher.value.maxPeriodsPerDay,
    minConsecutivePeriods: selectedTeacher.value.minConsecutivePeriods,
    maxConsecutivePeriods: selectedTeacher.value.maxConsecutivePeriods,
    [field]: value,
  })
  limitsError.value = ok
    ? ''
    : 'Valor inválido: use um número inteiro positivo, com mínimo ≤ máximo.'
}

// Availability grid (D-29): columns are the 5 weekdays; rows are shown as
// one grid per Segment (or a single ungrouped hourly grid if none has any
// Time Slot yet) rather than one merged, time-sorted list — two Segments'
// periods can interleave in real time without being the same sequence
// (D-01), which made a single flat grid look misleadingly continuous.
const columns: WeekGridColumn[] = WEEKDAYS.map((day) => ({ key: day, label: WEEKDAY_LABELS[day] }))

const availabilityGroups = computed(() =>
  store.availabilityGridGroups.map((group) => ({
    ...group,
    rows: group.periods.map((p): WeekGridRow => ({
      key: `${p.start}-${p.end}`,
      label: `${p.start}–${p.end}`,
    })),
  })),
)

function periodFromRowKey(key: string): { start: string; end: string } {
  const [start, end] = key.split('-')
  return { start: start ?? '', end: end ?? '' }
}

function isUnavailable(weekday: Weekday, rowKey: string): boolean {
  if (!selectedTeacher.value) return false
  const { start, end } = periodFromRowKey(rowKey)
  return selectedTeacher.value.unavailability.some(
    (r) => r.weekday === weekday && r.start <= start && end <= r.end,
  )
}

function toggleCell(weekday: Weekday, rowKey: string): void {
  if (!selectedTeacher.value) return
  const { start, end } = periodFromRowKey(rowKey)
  store.setAvailability(
    selectedTeacher.value.id,
    weekday,
    start,
    end,
    !isUnavailable(weekday, rowKey),
  )
}
</script>

<template>
  <h2>Professores</h2>

  <div class="card">
    <button
      v-if="store.teachers.length > 1"
      type="button"
      class="btn btn-sm"
      style="margin-bottom: var(--space-2)"
      @click="store.sortTeachersByName()"
    >
      Ordenar por nome (A-Z)
    </button>
    <ul class="pill-list">
      <li v-for="(teacher, index) in store.teachers" :key="teacher.id">
        <button
          type="button"
          class="btn btn-sm"
          :disabled="index === 0"
          aria-label="Mover para cima"
          @click="store.moveTeacher(teacher.id, 'up')"
        >
          ▲
        </button>
        <button
          type="button"
          class="btn btn-sm"
          :disabled="index === store.teachers.length - 1"
          aria-label="Mover para baixo"
          @click="store.moveTeacher(teacher.id, 'down')"
        >
          ▼
        </button>
        <button
          type="button"
          class="pill"
          :class="{ selected: teacher.id === selectedTeacherId }"
          @click="selectedTeacherId = teacher.id"
        >
          {{ store.teacherLabel(teacher.id) }}
        </button>
        <button type="button" class="btn btn-danger btn-sm" @click="deleteTeacher(teacher.id)">
          Excluir
        </button>
      </li>
    </ul>
    <p v-if="!store.teachers.length" class="empty">Nenhum professor cadastrado.</p>

    <form class="row" @submit.prevent="createTeacher">
      <label class="field">
        <span class="field-label">Novo professor</span>
        <input v-model="newTeacherName" class="input" type="text" placeholder="ex.: Guilherme" />
      </label>
      <button type="submit" class="btn btn-primary">Adicionar Professor</button>
    </form>
  </div>

  <div v-if="selectedTeacher" class="card">
    <h3>Disponibilidade semanal de "{{ store.teacherLabel(selectedTeacher.id) }}"</h3>
    <label class="field field-inline" style="margin-bottom: var(--space-4)">
      <span class="field-label">Renomear</span>
      <input
        class="input"
        type="text"
        :value="selectedTeacher.name"
        @change="renameTeacher(selectedTeacher.id, $event)"
      />
    </label>

    <h4>Disciplinas que leciona</h4>
    <p class="muted">Usado para filtrar quem aparece ao escolher professores em "Atribuições".</p>
    <fieldset class="subject-list">
      <label v-for="s in store.subjects" :key="s.id" class="field field-inline">
        <input
          type="checkbox"
          :checked="(selectedTeacher.subjectIds ?? []).includes(s.id)"
          @change="toggleSubject(selectedTeacher.id, s.id, $event)"
        />
        <span>{{ s.name }}</span>
      </label>
      <p v-if="!store.subjects.length" class="empty">Nenhuma disciplina cadastrada.</p>
    </fieldset>

    <h4 style="margin-top: var(--space-4)">Limites do professor</h4>
    <div class="row">
      <label class="field">
        <span class="field-label">Máx. de aulas por dia</span>
        <input
          class="input input-sm"
          type="number"
          min="1"
          :value="selectedTeacher.maxPeriodsPerDay ?? ''"
          @change="onLimitChange('maxPeriodsPerDay', $event)"
        />
      </label>
      <label class="field">
        <span class="field-label">Mín. de aulas consecutivas</span>
        <input
          class="input input-sm"
          type="number"
          min="1"
          :value="selectedTeacher.minConsecutivePeriods ?? ''"
          @change="onLimitChange('minConsecutivePeriods', $event)"
        />
      </label>
      <label class="field">
        <span class="field-label">Máx. de aulas consecutivas</span>
        <input
          class="input input-sm"
          type="number"
          min="1"
          :value="selectedTeacher.maxConsecutivePeriods ?? ''"
          @change="onLimitChange('maxConsecutivePeriods', $event)"
        />
      </label>
    </div>
    <p v-if="limitsError" class="alert alert-danger" role="alert">{{ limitsError }}</p>

    <h4 style="margin-top: var(--space-4)">Disponibilidade</h4>
    <p class="muted">
      Por padrão o professor está disponível em todo horário. Clique em uma célula para marcá-la
      como indisponível (ex.: apenas terça à tarde) — clique novamente para voltar a disponível.
    </p>

    <div
      v-for="group in availabilityGroups"
      :key="group.segmentId ?? 'sem-segmento'"
      class="availability-group"
    >
      <h5 v-if="group.segmentName">{{ group.segmentName }}</h5>
      <WeekGrid :columns="columns" :rows="group.rows">
        <template #cell="{ column, row }">
          <button
            type="button"
            class="avail-cell"
            :class="{ unavailable: isUnavailable(column.key as Weekday, row.key) }"
            :aria-label="`${group.segmentName ?? ''} ${column.label} ${row.label}`"
            @click="toggleCell(column.key as Weekday, row.key)"
          ></button>
        </template>
      </WeekGrid>
    </div>
  </div>
</template>

<style scoped>
.subject-list {
  border: none;
  padding: 0;
  margin: 0 0 var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.availability-group + .availability-group {
  margin-top: var(--space-4);
}

.availability-group h5 {
  margin: 0 0 var(--space-2);
  color: var(--color-text-muted);
}

.avail-cell {
  width: 100%;
  height: 100%;
  min-height: 2.25rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: #eafaf0;
  cursor: pointer;
  padding: 0;
}

.avail-cell:hover {
  filter: brightness(0.97);
}

.avail-cell.unavailable {
  background: var(--color-danger-bg);
  border-color: var(--color-danger-border);
}
</style>
