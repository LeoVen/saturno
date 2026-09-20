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
  <h2>Disciplinas</h2>

  <div class="card">
    <ul class="pill-list">
      <li v-for="subject in store.subjects" :key="subject.id">
        <input
          class="input"
          type="text"
          :value="subject.name"
          @change="renameSubject(subject.id, $event)"
        />
        <button
          type="button"
          class="btn btn-danger btn-sm"
          @click="store.removeSubject(subject.id)"
        >
          Excluir
        </button>
      </li>
    </ul>
    <p v-if="!store.subjects.length" class="empty">Nenhuma disciplina cadastrada.</p>

    <form class="row" @submit.prevent="createSubject">
      <label class="field">
        <span class="field-label">Nova disciplina</span>
        <input v-model="newSubjectName" class="input" type="text" placeholder="ex.: História" />
      </label>
      <button type="submit" class="btn btn-primary">Adicionar Disciplina</button>
    </form>
  </div>
</template>
