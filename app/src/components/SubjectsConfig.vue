<script setup lang="ts">
import { ref } from 'vue'
import { useEntitiesStore } from '../stores/entities'

const store = useEntitiesStore()

const newSubjectName = ref('')

function createSubject(): void {
  const name = newSubjectName.value.trim()
  if (!name) return
  store.addSubject(name)
  newSubjectName.value = ''
}

function renameSubject(id: string, event: Event): void {
  store.renameSubject(id, (event.target as HTMLInputElement).value)
}
</script>

<template>
  <section>
    <h2>Disciplinas</h2>

    <ul class="subject-list">
      <li v-for="subject in store.subjects" :key="subject.id">
        <input type="text" :value="subject.name" @change="renameSubject(subject.id, $event)" />
        <button type="button" @click="store.removeSubject(subject.id)">Excluir</button>
      </li>
    </ul>

    <form @submit.prevent="createSubject">
      <label>
        Nova disciplina
        <input v-model="newSubjectName" type="text" placeholder="ex.: História" />
      </label>
      <button type="submit">Adicionar Disciplina</button>
    </form>
  </section>
</template>

<style scoped>
.subject-list {
  list-style: none;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 12px;
}

.subject-list li {
  display: flex;
  align-items: center;
  gap: 8px;
}

form {
  display: flex;
  align-items: flex-end;
  gap: 12px;
  flex-wrap: wrap;
}

label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 0.9em;
}
</style>
