<script setup lang="ts">
import { computed, ref } from 'vue'
import { useEntitiesStore } from '../stores/entities'

const store = useEntitiesStore()

function classLabel(classId: string): string {
  const schoolClass = store.classById(classId)
  if (!schoolClass) return '?'
  const grade = store.gradeById(schoolClass.gradeId)
  const segment = grade ? store.segmentById(grade.segmentId) : undefined
  return [segment?.name, grade?.name, schoolClass.name].filter(Boolean).join(' / ')
}

function subjectLabel(subjectId: string): string {
  return store.subjectById(subjectId)?.name ?? '?'
}

const allClasses = computed(() =>
  [...store.classes]
    .map((c) => ({ id: c.id, label: classLabel(c.id) }))
    .sort((a, b) => a.label.localeCompare(b.label)),
)

const selectedClassId = ref('')
const selectedSubjectId = ref('')

const currentAssignment = computed(() =>
  selectedClassId.value && selectedSubjectId.value
    ? store.assignmentByClassSubject(selectedClassId.value, selectedSubjectId.value)
    : undefined,
)

function createAssignment(): void {
  if (!selectedClassId.value || !selectedSubjectId.value) return
  store.addAssignment(selectedClassId.value, selectedSubjectId.value)
}

function onWeeklyOccurrencesChange(id: string, event: Event): void {
  store.setWeeklyOccurrences(id, Number((event.target as HTMLInputElement).value))
}

function onConsecutivePeriodsChange(id: string, event: Event): void {
  store.setConsecutivePeriods(id, Number((event.target as HTMLSelectElement).value))
}

function onAllowSameDayChange(id: string, event: Event): void {
  store.setAllowSameDayRepetition(id, (event.target as HTMLInputElement).checked)
}

function toggleTeacher(assignmentId: string, teacherId: string, event: Event): void {
  if ((event.target as HTMLInputElement).checked) {
    store.addAssignmentTeacher(assignmentId, teacherId)
  } else {
    store.removeAssignmentTeacher(assignmentId, teacherId)
  }
}

// D-17 precedent: never show a raw value the user didn't choose in a way
// they'd have to decode — consecutivePeriods is an internal 1/2/3 encoding,
// always shown through this label.
const CONSECUTIVE_LABELS: Record<number, string> = {
  1: 'Nenhum (períodos independentes)',
  2: 'Dupla (2 períodos consecutivos)',
  3: 'Tripla (3 períodos consecutivos)',
}

function overloadMessage(classId: string, requiredWeekly: number, availableWeekly: number): string {
  return `${classLabel(classId)}: requer ${requiredWeekly} aula(s) por semana, mas o segmento só oferece ${availableWeekly} período(s) não vagos por semana.`
}

function zeroOverlapMessage(assignmentId: string, teacherId: string, classId: string): string {
  const subjectId = store.assignmentById(assignmentId)?.subjectId
  return `${store.teacherLabel(teacherId)}: nenhum horário disponível compatível com ${classLabel(classId)}${subjectId ? ` para a disciplina ${subjectLabel(subjectId)}` : ''}.`
}
</script>

<template>
  <h2>Atribuições (Turma × Disciplina)</h2>

  <div class="card">
    <div class="row">
      <label class="field">
        <span class="field-label">Turma</span>
        <select v-model="selectedClassId" class="input">
          <option value="" disabled>Selecione…</option>
          <option v-for="c in allClasses" :key="c.id" :value="c.id">{{ c.label }}</option>
        </select>
      </label>
      <label class="field">
        <span class="field-label">Disciplina</span>
        <select v-model="selectedSubjectId" class="input">
          <option value="" disabled>Selecione…</option>
          <option v-for="s in store.subjects" :key="s.id" :value="s.id">{{ s.name }}</option>
        </select>
      </label>
    </div>

    <div v-if="selectedClassId && selectedSubjectId" style="margin-top: var(--space-4)">
      <button
        v-if="!currentAssignment"
        type="button"
        class="btn btn-primary"
        @click="createAssignment"
      >
        Criar atribuição
      </button>

      <div v-else class="editor stack">
        <label class="field">
          <span class="field-label">Aulas por semana</span>
          <input
            class="input input-sm"
            type="number"
            min="1"
            :value="currentAssignment.weeklyOccurrences"
            @change="onWeeklyOccurrencesChange(currentAssignment.id, $event)"
          />
        </label>
        <label class="field">
          <span class="field-label">Períodos consecutivos</span>
          <select
            class="input"
            :value="currentAssignment.consecutivePeriods"
            @change="onConsecutivePeriodsChange(currentAssignment.id, $event)"
          >
            <option v-for="n in [1, 2, 3]" :key="n" :value="n">{{ CONSECUTIVE_LABELS[n] }}</option>
          </select>
        </label>
        <label class="field field-inline">
          <input
            type="checkbox"
            :checked="currentAssignment.allowSameDayRepetition"
            @change="onAllowSameDayChange(currentAssignment.id, $event)"
          />
          <span>Permitir repetição no mesmo dia</span>
        </label>

        <fieldset>
          <legend class="field-label">Professores</legend>
          <label v-for="t in store.teachers" :key="t.id" class="field field-inline">
            <input
              type="checkbox"
              :checked="currentAssignment.teacherIds.includes(t.id)"
              @change="toggleTeacher(currentAssignment.id, t.id, $event)"
            />
            <span>{{ store.teacherLabel(t.id) }}</span>
          </label>
          <p v-if="!store.teachers.length" class="empty">Nenhum professor cadastrado.</p>
        </fieldset>

        <button
          type="button"
          class="btn btn-danger btn-sm"
          @click="store.removeAssignment(currentAssignment.id)"
        >
          Excluir atribuição
        </button>
      </div>
    </div>
  </div>

  <div v-if="store.assignments.length" class="card">
    <h3>Atribuições cadastradas</h3>
    <table class="table">
      <thead>
        <tr>
          <th>Turma</th>
          <th>Disciplina</th>
          <th>Aulas/semana</th>
          <th>Consecutivos</th>
          <th>Professores</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="a in store.assignments" :key="a.id">
          <td>{{ classLabel(a.classId) }}</td>
          <td>{{ subjectLabel(a.subjectId) }}</td>
          <td>{{ a.weeklyOccurrences }}</td>
          <td>{{ CONSECUTIVE_LABELS[a.consecutivePeriods] }}</td>
          <td>{{ a.teacherIds.map(store.teacherLabel).join(', ') || '—' }}</td>
          <td>
            <button
              type="button"
              class="btn btn-danger btn-sm"
              @click="store.removeAssignment(a.id)"
            >
              Excluir
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>

  <div v-if="store.overloadedClasses.length || store.zeroOverlapAssignments.length" class="card">
    <h3>Avisos de validação</h3>
    <ul class="alert-list">
      <li
        v-for="w in store.overloadedClasses"
        :key="w.classId"
        class="alert alert-danger"
        role="alert"
      >
        {{ overloadMessage(w.classId, w.requiredWeekly, w.availableWeekly) }}
      </li>
      <li
        v-for="w in store.zeroOverlapAssignments"
        :key="w.assignmentId"
        class="alert alert-danger"
        role="alert"
      >
        {{ zeroOverlapMessage(w.assignmentId, w.teacherId, w.classId) }}
      </li>
    </ul>
  </div>
</template>

<style scoped>
.editor {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: var(--space-3);
  max-width: 480px;
}

fieldset {
  border: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}
</style>
