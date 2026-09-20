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

function teacherLabel(teacherId: string): string {
  const teacher = store.teacherById(teacherId)
  return teacher ? `${teacher.name} #${teacherId.slice(0, 4)}` : '?'
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
  return `${teacherLabel(teacherId)}: nenhum horário disponível compatível com ${classLabel(classId)}${subjectId ? ` para a disciplina ${subjectLabel(subjectId)}` : ''}.`
}
</script>

<template>
  <section>
    <h2>Atribuições (Turma × Disciplina)</h2>

    <div class="picker">
      <label>
        Turma
        <select v-model="selectedClassId">
          <option value="" disabled>Selecione…</option>
          <option v-for="c in allClasses" :key="c.id" :value="c.id">{{ c.label }}</option>
        </select>
      </label>
      <label>
        Disciplina
        <select v-model="selectedSubjectId">
          <option value="" disabled>Selecione…</option>
          <option v-for="s in store.subjects" :key="s.id" :value="s.id">{{ s.name }}</option>
        </select>
      </label>
    </div>

    <div v-if="selectedClassId && selectedSubjectId">
      <button v-if="!currentAssignment" type="button" @click="createAssignment">
        Criar atribuição
      </button>

      <div v-else class="editor">
        <label>
          Aulas por semana
          <input
            type="number"
            min="1"
            :value="currentAssignment.weeklyOccurrences"
            @change="onWeeklyOccurrencesChange(currentAssignment.id, $event)"
          />
        </label>
        <label>
          Períodos consecutivos
          <select
            :value="currentAssignment.consecutivePeriods"
            @change="onConsecutivePeriodsChange(currentAssignment.id, $event)"
          >
            <option v-for="n in [1, 2, 3]" :key="n" :value="n">{{ CONSECUTIVE_LABELS[n] }}</option>
          </select>
        </label>
        <label class="checkbox">
          <input
            type="checkbox"
            :checked="currentAssignment.allowSameDayRepetition"
            @change="onAllowSameDayChange(currentAssignment.id, $event)"
          />
          Permitir repetição no mesmo dia
        </label>

        <fieldset>
          <legend>Professores</legend>
          <label v-for="t in store.teachers" :key="t.id" class="checkbox">
            <input
              type="checkbox"
              :checked="currentAssignment.teacherIds.includes(t.id)"
              @change="toggleTeacher(currentAssignment.id, t.id, $event)"
            />
            {{ teacherLabel(t.id) }}
          </label>
          <p v-if="!store.teachers.length" class="hint">Nenhum professor cadastrado.</p>
        </fieldset>

        <button type="button" @click="store.removeAssignment(currentAssignment.id)">
          Excluir atribuição
        </button>
      </div>
    </div>
  </section>

  <section v-if="store.assignments.length">
    <h3>Atribuições cadastradas</h3>
    <table>
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
          <td>{{ a.consecutivePeriods }}</td>
          <td>{{ a.teacherIds.map(teacherLabel).join(', ') || '—' }}</td>
          <td><button type="button" @click="store.removeAssignment(a.id)">Excluir</button></td>
        </tr>
      </tbody>
    </table>
  </section>

  <section v-if="store.overloadedClasses.length || store.zeroOverlapAssignments.length">
    <h3>Avisos de validação</h3>
    <ul class="warnings">
      <li v-for="w in store.overloadedClasses" :key="w.classId" role="alert">
        {{ overloadMessage(w.classId, w.requiredWeekly, w.availableWeekly) }}
      </li>
      <li v-for="w in store.zeroOverlapAssignments" :key="w.assignmentId" role="alert">
        {{ zeroOverlapMessage(w.assignmentId, w.teacherId, w.classId) }}
      </li>
    </ul>
  </section>
</template>

<style scoped>
.picker {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}

.editor {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: flex-start;
  border: 1px solid;
  padding: 12px;
  max-width: 480px;
}

label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 0.9em;
}

label.checkbox {
  flex-direction: row;
  align-items: center;
  gap: 6px;
}

fieldset {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.hint {
  font-size: 0.85em;
  color: gray;
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

.warnings {
  color: #a33;
}
</style>
