<script setup lang="ts">
import { computed, ref } from 'vue'
import { useEntitiesStore } from '../stores/entities'

const store = useEntitiesStore()

// Owns its own Segment selection — each nav section is self-contained
// (INTERLUDE-1-T1) rather than depending on whatever was last selected on
// the Segmentos page.
const selectedSegmentId = ref('')
const segment = computed(() =>
  selectedSegmentId.value ? store.segmentById(selectedSegmentId.value) : undefined,
)
const grades = computed(() =>
  selectedSegmentId.value ? store.gradesBySegment(selectedSegmentId.value) : [],
)

const newGradeName = ref('')

function createGrade(): void {
  if (!selectedSegmentId.value) return
  const name = newGradeName.value.trim()
  if (!name) return
  store.addGrade(selectedSegmentId.value, name)
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
  <h2>Séries e Turmas</h2>

  <div class="card">
    <label class="field">
      <span class="field-label">Segmento</span>
      <select v-model="selectedSegmentId" class="input">
        <option value="" disabled>Selecione…</option>
        <option v-for="s in store.segments" :key="s.id" :value="s.id">{{ s.name }}</option>
      </select>
    </label>
    <p v-if="!store.segments.length" class="empty">
      Cadastre um Segmento primeiro, na página "Segmentos".
    </p>
  </div>

  <div v-if="segment" class="card">
    <h3>Séries de "{{ segment.name }}"</h3>

    <ul class="grade-list">
      <li v-for="grade in grades" :key="grade.id" class="grade-item">
        <div class="grade-header">
          <input
            class="input grade-name"
            type="text"
            :value="grade.name"
            @change="renameGrade(grade.id, $event)"
          />
          <button type="button" class="btn btn-danger btn-sm" @click="store.removeGrade(grade.id)">
            Excluir Série
          </button>
        </div>

        <ul class="pill-list class-list">
          <li v-for="schoolClass in store.classesByGrade(grade.id)" :key="schoolClass.id">
            <input
              class="input"
              type="text"
              :value="schoolClass.name"
              @change="renameClass(schoolClass.id, $event)"
            />
            <button
              type="button"
              class="btn btn-danger btn-sm"
              @click="store.removeClass(schoolClass.id)"
            >
              Excluir
            </button>
          </li>
        </ul>
        <p v-if="!store.classesByGrade(grade.id).length" class="empty">Nenhuma turma cadastrada.</p>

        <form class="row" @submit.prevent="createClass(grade.id)">
          <label class="field">
            <span class="field-label">Nova turma</span>
            <input
              v-model="newClassNames[grade.id]"
              class="input"
              type="text"
              placeholder="ex.: 7º Ano A"
            />
          </label>
          <button type="submit" class="btn">Adicionar Turma</button>
        </form>
      </li>
    </ul>
    <p v-if="!grades.length" class="empty">Nenhuma série cadastrada.</p>

    <form class="row" @submit.prevent="createGrade">
      <label class="field">
        <span class="field-label">Nova série</span>
        <input v-model="newGradeName" class="input" type="text" placeholder="ex.: 7º Ano" />
      </label>
      <button type="submit" class="btn btn-primary">Adicionar Série</button>
    </form>
  </div>
</template>

<style scoped>
.grade-list {
  list-style: none;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  margin: 0 0 var(--space-4);
}

.grade-item {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: var(--space-3);
}

.grade-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-2);
}

.grade-name {
  font-weight: 600;
}

.class-list {
  margin-bottom: var(--space-3);
}
</style>
