<script setup lang="ts">
import { computed, ref } from 'vue'
import { useEntitiesStore } from '../stores/entities'
import TimeInput from './TimeInput.vue'
import WeekGrid, { type WeekGridColumn } from './WeekGrid.vue'

const store = useEntitiesStore()

const newSegmentName = ref('')
const selectedSegmentId = ref('')

const selectedSegment = computed(() =>
  selectedSegmentId.value ? store.segmentById(selectedSegmentId.value) : undefined,
)

function createSegment(): void {
  const name = newSegmentName.value.trim()
  if (!name) return
  selectedSegmentId.value = store.addSegment(name)
  newSegmentName.value = ''
}

function deleteSegment(id: string): void {
  store.removeSegment(id)
  if (selectedSegmentId.value === id) selectedSegmentId.value = ''
}

// A Segment's periods/breaks are the same every weekday (D-02), so they're
// shown as a single-column timeline rather than a real 5-day grid — the
// grid layout is reused purely for visual consistency with Teacher
// Availability's genuine weekly grid.
const DAY_COLUMN: WeekGridColumn[] = [{ key: 'all', label: 'Todos os dias' }]

type Entry = { key: string; kind: 'period' | 'break'; id: string; start: string; end: string }

const entries = computed<Entry[]>(() => {
  if (!selectedSegment.value) return []
  const periods = selectedSegment.value.timeSlots.map((t): Entry => ({
    key: `period-${t.id}`,
    kind: 'period',
    id: t.id,
    start: t.start,
    end: t.end,
  }))
  const breaks = selectedSegment.value.breaks.map((b): Entry => ({
    key: `break-${b.id}`,
    kind: 'break',
    id: b.id,
    start: b.start,
    end: b.end,
  }))
  return [...periods, ...breaks].sort((a, b) => a.start.localeCompare(b.start))
})

const rows = computed(() =>
  entries.value.map((e) => ({ key: e.key, label: `${e.start}–${e.end}` })),
)

function entryFor(rowKey: string): Entry | undefined {
  return entries.value.find((e) => e.key === rowKey)
}

function removeEntry(entry: Entry): void {
  if (!selectedSegment.value) return
  if (entry.kind === 'period') store.removeTimeSlot(selectedSegment.value.id, entry.id)
  else store.removeBreak(selectedSegment.value.id, entry.id)
}

// Draft state for the "add" forms below the timeline.
const newSlotStart = ref('')
const newSlotEnd = ref('')
const slotError = ref('')

function addTimeSlot(): void {
  if (!selectedSegment.value) return
  const id = store.addTimeSlot(selectedSegment.value.id, newSlotStart.value, newSlotEnd.value)
  slotError.value = id === undefined ? 'Horário inválido: o início deve ser antes do término.' : ''
  if (id !== undefined) {
    newSlotStart.value = ''
    newSlotEnd.value = ''
  }
}

const newBreakStart = ref('')
const newBreakEnd = ref('')
const breakError = ref('')

function addBreak(): void {
  if (!selectedSegment.value) return
  const id = store.addBreak(selectedSegment.value.id, newBreakStart.value, newBreakEnd.value)
  breakError.value = id === undefined ? 'Horário inválido: o início deve ser antes do término.' : ''
  if (id !== undefined) {
    newBreakStart.value = ''
    newBreakEnd.value = ''
  }
}
</script>

<template>
  <h2>Segmentos</h2>

  <div class="card">
    <ul class="pill-list">
      <li v-for="segment in store.segments" :key="segment.id">
        <button
          type="button"
          class="pill"
          :class="{ selected: segment.id === selectedSegmentId }"
          @click="selectedSegmentId = segment.id"
        >
          {{ segment.name }}
        </button>
        <button type="button" class="btn btn-danger btn-sm" @click="deleteSegment(segment.id)">
          Excluir
        </button>
      </li>
    </ul>
    <p v-if="!store.segments.length" class="empty">Nenhum segmento cadastrado.</p>

    <form class="row" @submit.prevent="createSegment">
      <label class="field">
        <span class="field-label">Novo segmento</span>
        <input
          v-model="newSegmentName"
          class="input"
          type="text"
          placeholder="ex.: Ensino Fundamental"
        />
      </label>
      <button type="submit" class="btn btn-primary">Adicionar Segmento</button>
    </form>
  </div>

  <div v-if="selectedSegment" class="card">
    <h3>Horários e intervalos de "{{ selectedSegment.name }}"</h3>
    <p class="muted">
      Os mesmos períodos e intervalos valem para todos os dias da semana neste Segmento.
    </p>

    <WeekGrid :columns="DAY_COLUMN" :rows="rows">
      <template #cell="{ row }">
        <div v-if="entryFor(row.key)" class="entry" :class="entryFor(row.key)!.kind">
          <span>{{ entryFor(row.key)!.kind === 'period' ? 'Período' : 'Intervalo' }}</span>
          <button type="button" class="btn btn-sm" @click="removeEntry(entryFor(row.key)!)">
            Remover
          </button>
        </div>
      </template>
    </WeekGrid>
    <p v-if="!rows.length" class="empty">Nenhum período ou intervalo cadastrado ainda.</p>

    <div class="row add-rows">
      <form class="stack" @submit.prevent="addTimeSlot">
        <span class="field-label">Adicionar Período</span>
        <div class="row">
          <TimeInput v-model="newSlotStart" allow-empty />
          <span>até</span>
          <TimeInput v-model="newSlotEnd" allow-empty />
          <button type="submit" class="btn">Adicionar</button>
        </div>
        <p v-if="slotError" class="alert alert-danger" role="alert">{{ slotError }}</p>
      </form>

      <form class="stack" @submit.prevent="addBreak">
        <span class="field-label">Adicionar Intervalo</span>
        <div class="row">
          <TimeInput v-model="newBreakStart" allow-empty />
          <span>até</span>
          <TimeInput v-model="newBreakEnd" allow-empty />
          <button type="submit" class="btn">Adicionar</button>
        </div>
        <p v-if="breakError" class="alert alert-danger" role="alert">{{ breakError }}</p>
      </form>
    </div>
  </div>
</template>

<style scoped>
.add-rows {
  margin-top: var(--space-4);
  align-items: flex-start;
}

.entry {
  height: 100%;
  border-radius: var(--radius-sm);
  padding: var(--space-1) var(--space-2);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  font-size: 0.85rem;
}

.entry.period {
  background: var(--color-selected-bg);
  color: var(--color-primary);
}

.entry.break {
  background: #fef3e2;
  color: #92620a;
}
</style>
