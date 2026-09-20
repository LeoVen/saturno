<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useEntitiesStore } from '../stores/entities'
import { WEEKDAYS, type Weekday } from '../entities/weekday'

const WEEKDAY_LABELS: Record<Weekday, string> = {
  mon: 'Segunda',
  tue: 'Terça',
  wed: 'Quarta',
  thu: 'Quinta',
  fri: 'Sexta',
}

const store = useEntitiesStore()

const newTeacherName = ref('')
const selectedTeacherId = ref<string | null>(null)

const selectedTeacher = computed(() =>
  selectedTeacherId.value ? store.teacherById(selectedTeacherId.value) : undefined,
)

// A short, stable suffix so same-name Teachers are visibly distinct in the
// list (FR-2) without exposing the full UUID.
function shortId(id: string): string {
  return id.slice(0, 4)
}

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
  if (selectedTeacherId.value === id) selectedTeacherId.value = null
}

// Draft state for each weekday's "add unavailability" mini-form.
const draftStart = reactive<Record<Weekday, string>>({
  mon: '',
  tue: '',
  wed: '',
  thu: '',
  fri: '',
})
const draftEnd = reactive<Record<Weekday, string>>({
  mon: '',
  tue: '',
  wed: '',
  thu: '',
  fri: '',
})
const dayError = reactive<Record<Weekday, string>>({ mon: '', tue: '', wed: '', thu: '', fri: '' })

function rangesForDay(weekday: Weekday) {
  return (selectedTeacher.value?.unavailability ?? []).filter((r) => r.weekday === weekday)
}

function addUnavailability(weekday: Weekday): void {
  if (!selectedTeacher.value) return
  const id = store.addUnavailability(
    selectedTeacher.value.id,
    weekday,
    draftStart[weekday],
    draftEnd[weekday],
  )
  if (id === undefined) {
    dayError[weekday] = 'Horário inválido: o início deve ser antes do término.'
    return
  }
  dayError[weekday] = ''
  draftStart[weekday] = ''
  draftEnd[weekday] = ''
}

function editUnavailability(
  rangeId: string,
  weekday: Weekday,
  field: 'start' | 'end',
  value: string,
): void {
  if (!selectedTeacher.value) return
  const range = selectedTeacher.value.unavailability.find((r) => r.id === rangeId)
  if (!range) return
  const start = field === 'start' ? value : range.start
  const end = field === 'end' ? value : range.end
  store.updateUnavailability(selectedTeacher.value.id, rangeId, weekday, start, end)
}
</script>

<template>
  <section>
    <h2>Professores</h2>

    <ul class="teacher-list">
      <li v-for="teacher in store.teachers" :key="teacher.id">
        <button
          type="button"
          class="teacher-name"
          :class="{ selected: teacher.id === selectedTeacherId }"
          @click="selectedTeacherId = teacher.id"
        >
          {{ teacher.name }} <span class="teacher-id">#{{ shortId(teacher.id) }}</span>
        </button>
        <button type="button" @click="deleteTeacher(teacher.id)">Excluir</button>
      </li>
    </ul>

    <form @submit.prevent="createTeacher">
      <label>
        Novo professor
        <input v-model="newTeacherName" type="text" placeholder="ex.: Guilherme" />
      </label>
      <button type="submit">Adicionar Professor</button>
    </form>
  </section>

  <section v-if="selectedTeacher">
    <h3>
      Disponibilidade semanal de "{{ selectedTeacher.name }}"
      <span class="teacher-id">#{{ shortId(selectedTeacher.id) }}</span>
    </h3>
    <p>
      Renomear:
      <input
        type="text"
        :value="selectedTeacher.name"
        @change="renameTeacher(selectedTeacher.id, $event)"
      />
    </p>
    <p class="hint">
      Por padrão, o professor está disponível em todos os horários. Cadastre abaixo os períodos em
      que ele fica indisponível (ex.: apenas terça à tarde).
    </p>

    <div class="day-grid">
      <div v-for="day in WEEKDAYS" :key="day" class="day-column">
        <h4>{{ WEEKDAY_LABELS[day] }}</h4>

        <ul v-if="rangesForDay(day).length" class="range-list">
          <li v-for="range in rangesForDay(day)" :key="range.id">
            <input
              type="time"
              :value="range.start"
              @change="
                editUnavailability(
                  range.id,
                  day,
                  'start',
                  ($event.target as HTMLInputElement).value,
                )
              "
            />
            <input
              type="time"
              :value="range.end"
              @change="
                editUnavailability(range.id, day, 'end', ($event.target as HTMLInputElement).value)
              "
            />
            <button
              type="button"
              @click="store.removeUnavailability(selectedTeacher!.id, range.id)"
            >
              Remover
            </button>
          </li>
        </ul>
        <p v-else class="none">Disponível o dia todo.</p>

        <form @submit.prevent="addUnavailability(day)">
          <input v-model="draftStart[day]" type="time" required />
          <input v-model="draftEnd[day]" type="time" required />
          <button type="submit">Adicionar</button>
        </form>
        <p v-if="dayError[day]" role="alert">{{ dayError[day] }}</p>
      </div>
    </div>
  </section>
</template>

<style scoped>
.teacher-list {
  list-style: none;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.teacher-list li {
  display: flex;
  align-items: center;
  gap: 8px;
}

.teacher-name {
  font: inherit;
  padding: 4px 8px;
}

.teacher-name.selected {
  font-weight: bold;
}

.teacher-id {
  color: gray;
  font-size: 0.85em;
}

.hint {
  font-size: 0.9em;
  color: gray;
}

.day-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
  gap: 12px;
}

.day-column {
  border: 1px solid;
  padding: 8px;
  min-width: 0;
}

.range-list {
  list-style: none;
  padding: 0;
  margin: 0 0 8px 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.range-list li {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}

.range-list input[type='time'] {
  min-width: 0;
  flex: 1 1 6.5em;
}

.none {
  font-size: 0.85em;
  color: gray;
}

form {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
  margin-bottom: 24px;
}

.day-column form {
  margin-bottom: 4px;
}

label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 0.9em;
}
</style>
