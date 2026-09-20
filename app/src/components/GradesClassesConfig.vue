<script setup lang="ts">
import { computed, ref } from 'vue'
import { useEntitiesStore } from '../stores/entities'

const props = defineProps<{ segmentId: string | null }>()

const store = useEntitiesStore()

const segment = computed(() => (props.segmentId ? store.segmentById(props.segmentId) : undefined))
const grades = computed(() => (props.segmentId ? store.gradesBySegment(props.segmentId) : []))

const newGradeName = ref('')

function createGrade(): void {
  if (!props.segmentId) return
  const name = newGradeName.value.trim()
  if (!name) return
  store.addGrade(props.segmentId, name)
  newGradeName.value = ''
}

function renameGrade(id: string, event: Event): void {
  store.renameGrade(id, (event.target as HTMLInputElement).value)
}

// Local draft state, one per Grade, for its "add Class" form.
const newClassNames = ref<Record<string, string>>({})

function createClass(gradeId: string): void {
  const name = (newClassNames.value[gradeId] ?? '').trim()
  if (!name) return
  store.addClass(gradeId, name)
  newClassNames.value[gradeId] = ''
}

function renameClass(id: string, event: Event): void {
  store.renameClass(id, (event.target as HTMLInputElement).value)
}
</script>

<template>
  <section v-if="segment">
    <h3>Séries e turmas de "{{ segment.name }}"</h3>

    <ul class="grade-list">
      <li v-for="grade in grades" :key="grade.id" class="grade-item">
        <div class="grade-header">
          <input
            class="grade-name"
            type="text"
            :value="grade.name"
            @change="renameGrade(grade.id, $event)"
          />
          <button type="button" @click="store.removeGrade(grade.id)">Excluir Série</button>
        </div>

        <ul class="class-list">
          <li v-for="schoolClass in store.classesByGrade(grade.id)" :key="schoolClass.id">
            <input
              type="text"
              :value="schoolClass.name"
              @change="renameClass(schoolClass.id, $event)"
            />
            <button type="button" @click="store.removeClass(schoolClass.id)">Excluir</button>
          </li>
        </ul>

        <form @submit.prevent="createClass(grade.id)">
          <label>
            Nova turma
            <input v-model="newClassNames[grade.id]" type="text" placeholder="ex.: 7º Ano A" />
          </label>
          <button type="submit">Adicionar Turma</button>
        </form>
      </li>
    </ul>

    <form @submit.prevent="createGrade">
      <label>
        Nova série
        <input v-model="newGradeName" type="text" placeholder="ex.: 7º Ano" />
      </label>
      <button type="submit">Adicionar Série</button>
    </form>
  </section>
</template>

<style scoped>
.grade-list {
  list-style: none;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.grade-item {
  border: 1px solid;
  padding: 12px;
}

.grade-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.grade-name {
  font-weight: bold;
  font-size: 1.05em;
}

.class-list {
  list-style: none;
  padding: 0;
  margin: 0 0 12px 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.class-list li {
  display: flex;
  align-items: center;
  gap: 8px;
}

form {
  display: flex;
  align-items: flex-end;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}

label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 0.9em;
}
</style>
