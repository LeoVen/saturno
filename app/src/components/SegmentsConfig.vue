<script setup lang="ts">
import { computed, ref } from 'vue'
import { useEntitiesStore } from '../stores/entities'

const store = useEntitiesStore()

// Which Segment is selected is shared with GradesClassesConfig (Grades/
// Classes are configured nested under a Segment, per FR-6 / E03-T4).
const selectedSegmentId = defineModel<string | null>({ default: null })

const newSegmentName = ref('')

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
  if (selectedSegmentId.value === id) selectedSegmentId.value = null
}

// Local draft state for the "add" rows (Time Slots / Breaks) — kept out of
// the store since it's not valid data until submitted.
const newSlotStart = ref('')
const newSlotEnd = ref('')
const slotError = ref('')

function addTimeSlot(): void {
  if (!selectedSegment.value) return
  const id = store.addTimeSlot(selectedSegment.value.id, newSlotStart.value, newSlotEnd.value)
  if (id === undefined) {
    slotError.value = 'Horário inválido: o início deve ser antes do término.'
    return
  }
  slotError.value = ''
  newSlotStart.value = ''
  newSlotEnd.value = ''
}

const newBreakStart = ref('')
const newBreakEnd = ref('')
const breakError = ref('')

function addBreak(): void {
  if (!selectedSegment.value) return
  const id = store.addBreak(selectedSegment.value.id, newBreakStart.value, newBreakEnd.value)
  if (id === undefined) {
    breakError.value = 'Horário inválido: o início deve ser antes do término.'
    return
  }
  breakError.value = ''
  newBreakStart.value = ''
  newBreakEnd.value = ''
}

function onTimeSlotEdit(timeSlotId: string, field: 'start' | 'end', value: string): void {
  if (!selectedSegment.value) return
  const timeSlot = selectedSegment.value.timeSlots.find((t) => t.id === timeSlotId)
  if (!timeSlot) return
  const start = field === 'start' ? value : timeSlot.start
  const end = field === 'end' ? value : timeSlot.end
  store.updateTimeSlot(selectedSegment.value.id, timeSlotId, start, end)
}

function onBreakEdit(breakId: string, field: 'start' | 'end', value: string): void {
  if (!selectedSegment.value) return
  const breakPeriod = selectedSegment.value.breaks.find((b) => b.id === breakId)
  if (!breakPeriod) return
  const start = field === 'start' ? value : breakPeriod.start
  const end = field === 'end' ? value : breakPeriod.end
  store.updateBreak(selectedSegment.value.id, breakId, start, end)
}
</script>

<template>
  <section>
    <h2>Segmentos</h2>

    <ul class="segment-list">
      <li v-for="segment in store.segments" :key="segment.id">
        <button
          type="button"
          class="segment-name"
          :class="{ selected: segment.id === selectedSegmentId }"
          @click="selectedSegmentId = segment.id"
        >
          {{ segment.name }}
        </button>
        <button type="button" @click="deleteSegment(segment.id)">Excluir</button>
      </li>
    </ul>

    <form @submit.prevent="createSegment">
      <label>
        Novo segmento
        <input v-model="newSegmentName" type="text" placeholder="ex.: Ensino Fundamental" />
      </label>
      <button type="submit">Adicionar Segmento</button>
    </form>
  </section>

  <section v-if="selectedSegment">
    <h3>Horários e intervalos de "{{ selectedSegment.name }}"</h3>

    <div>
      <h4>Períodos (Time Slots)</h4>
      <table v-if="selectedSegment.timeSlots.length">
        <thead>
          <tr>
            <th>Início</th>
            <th>Término</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="slot in selectedSegment.timeSlots" :key="slot.id">
            <td>
              <input
                type="time"
                :value="slot.start"
                @change="
                  onTimeSlotEdit(slot.id, 'start', ($event.target as HTMLInputElement).value)
                "
              />
            </td>
            <td>
              <input
                type="time"
                :value="slot.end"
                @change="onTimeSlotEdit(slot.id, 'end', ($event.target as HTMLInputElement).value)"
              />
            </td>
            <td>
              <button type="button" @click="store.removeTimeSlot(selectedSegment!.id, slot.id)">
                Remover
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      <p v-else>Nenhum período cadastrado.</p>

      <form @submit.prevent="addTimeSlot">
        <label>
          Início
          <input v-model="newSlotStart" type="time" required />
        </label>
        <label>
          Término
          <input v-model="newSlotEnd" type="time" required />
        </label>
        <button type="submit">Adicionar Período</button>
        <p v-if="slotError" role="alert">{{ slotError }}</p>
      </form>
    </div>

    <div>
      <h4>Intervalos (Breaks)</h4>
      <table v-if="selectedSegment.breaks.length">
        <thead>
          <tr>
            <th>Início</th>
            <th>Término</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="brk in selectedSegment.breaks" :key="brk.id">
            <td>
              <input
                type="time"
                :value="brk.start"
                @change="onBreakEdit(brk.id, 'start', ($event.target as HTMLInputElement).value)"
              />
            </td>
            <td>
              <input
                type="time"
                :value="brk.end"
                @change="onBreakEdit(brk.id, 'end', ($event.target as HTMLInputElement).value)"
              />
            </td>
            <td>
              <button type="button" @click="store.removeBreak(selectedSegment!.id, brk.id)">
                Remover
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      <p v-else>Nenhum intervalo cadastrado.</p>

      <form @submit.prevent="addBreak">
        <label>
          Início
          <input v-model="newBreakStart" type="time" required />
        </label>
        <label>
          Término
          <input v-model="newBreakEnd" type="time" required />
        </label>
        <button type="submit">Adicionar Intervalo</button>
        <p v-if="breakError" role="alert">{{ breakError }}</p>
      </form>
    </div>
  </section>
</template>

<style scoped>
.segment-list {
  list-style: none;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.segment-list li {
  display: flex;
  align-items: center;
  gap: 8px;
}

.segment-name {
  font: inherit;
  padding: 4px 8px;
}

.segment-name.selected {
  font-weight: bold;
}

table {
  border-collapse: collapse;
  margin-bottom: 12px;
}

th,
td {
  padding: 4px 8px;
  text-align: left;
}

form {
  display: flex;
  align-items: flex-end;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 24px;
}

label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 0.9em;
}
</style>
