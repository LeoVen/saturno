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

// Segment/Grade/Class order (both Grade and Class levels user-reorderable),
// not an alphabetical relabeling — see entities store's `orderedClasses`.
const allClasses = computed(() =>
  store.orderedClasses.map((c) => ({ id: c.id, label: classLabel(c.id) })),
)

const selectedClassId = ref('')
const selectedSubjectId = ref('')

const currentAssignment = computed(() =>
  selectedClassId.value && selectedSubjectId.value
    ? store.assignmentByClassSubject(selectedClassId.value, selectedSubjectId.value)
    : undefined,
)

// D-25: narrow the Teacher picker to those qualified for this Assignment's
// Subject — but never hide a Teacher already selected on it, even if they
// were added before being marked qualified (or their qualification was
// later removed), so existing data is never silently dropped from view.
const eligibleTeachers = computed(() => {
  if (!selectedSubjectId.value) return []
  const qualified = store.teachersForSubject(selectedSubjectId.value)
  const alreadyAssigned = currentAssignment.value?.teacherIds ?? []
  const seen = new Set(qualified.map((t) => t.id))
  const extra = store.teachers.filter((t) => alreadyAssigned.includes(t.id) && !seen.has(t.id))
  return [...qualified, ...extra]
})

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
// always shown through this label. 2026-09-22: this is a *ceiling*, not a
// requirement — e.g. "Até 2" allows a double when there's room for one, it
// doesn't force every occurrence into pairs.
const CONSECUTIVE_LABELS: Record<number, string> = {
  1: 'Nenhum (nunca consecutivos)',
  2: 'Até 2 (dupla permitida)',
  3: 'Até 3 (dupla ou tripla permitida)',
}

function overloadMessage(classId: string, requiredWeekly: number, availableWeekly: number): string {
  return `${classLabel(classId)}: requer ${requiredWeekly} aula(s) por semana, mas o segmento só oferece ${availableWeekly} período(s) não vagos por semana.`
}

function zeroOverlapMessage(assignmentId: string, teacherId: string, classId: string): string {
  const subjectId = store.assignmentById(assignmentId)?.subjectId
  return `${store.teacherLabel(teacherId)}: nenhum horário disponível compatível com ${classLabel(classId)}${subjectId ? ` para a disciplina ${subjectLabel(subjectId)}` : ''}.`
}

// Bulk-copy: mirror one Class's whole Assignment config (weekly load,
// consecutive-periods block, same-day override, Teachers) onto another —
// e.g. two parallel sections of the same Grade needing the same Subjects.
const copySourceClassId = ref('')
const copyTargetClassId = ref('')
const copyResult = ref<{ copied: number; skipped: number } | null>(null)

function copyAssignments(): void {
  if (!copySourceClassId.value || !copyTargetClassId.value) return
  copyResult.value = store.copyAssignments(copySourceClassId.value, copyTargetClassId.value)
}

function copyResultMessage(result: { copied: number; skipped: number }): string {
  const parts = [`${result.copied} atribuição(ões) copiada(s)`]
  if (result.skipped > 0) {
    parts.push(`${result.skipped} ignorada(s) por já existir na turma de destino`)
  }
  return `${parts.join(', ')}.`
}

// Filters for the "Atribuições cadastradas" table — it grows with the
// school's real size, so narrowing it by Turma/Disciplina keeps it usable.
const filterClassId = ref('')
const filterSubjectId = ref('')

const filteredAssignments = computed(() =>
  store.assignments.filter(
    (a) =>
      (!filterClassId.value || a.classId === filterClassId.value) &&
      (!filterSubjectId.value || a.subjectId === filterSubjectId.value),
  ),
)

// Weekly-load summary: lets the user sanity-check total input at a glance,
// ordered the same way every other Class listing in the app is.
const classLoadRows = computed(() => {
  const loadsByClassId = new Map(store.classLoads.map((load) => [load.classId, load]))
  return store.orderedClasses.map((c) => ({
    ...loadsByClassId.get(c.id)!,
    label: classLabel(c.id),
  }))
})
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
          <span class="field-label">Períodos consecutivos permitidos</span>
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
          <label v-for="t in eligibleTeachers" :key="t.id" class="field field-inline">
            <input
              type="checkbox"
              :checked="currentAssignment.teacherIds.includes(t.id)"
              @change="toggleTeacher(currentAssignment.id, t.id, $event)"
            />
            <span>{{ store.teacherLabel(t.id) }}</span>
          </label>
          <p v-if="!store.teachers.length" class="empty">Nenhum professor cadastrado.</p>
          <p v-else-if="!eligibleTeachers.length" class="empty">
            Nenhum professor cadastrado para esta disciplina. Configure em "Professores".
          </p>
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

  <div v-if="allClasses.length > 1" class="card">
    <h3>Copiar atribuições entre turmas</h3>
    <p class="muted">
      Copia toda a configuração (aulas/semana, períodos consecutivos, repetição no mesmo dia e
      professores) de uma turma para outra. Disciplinas já configuradas na turma de destino não são
      substituídas.
    </p>
    <div class="row">
      <label class="field">
        <span class="field-label">De</span>
        <select v-model="copySourceClassId" class="input">
          <option value="" disabled>Selecione…</option>
          <option v-for="c in allClasses" :key="c.id" :value="c.id">{{ c.label }}</option>
        </select>
      </label>
      <label class="field">
        <span class="field-label">Para</span>
        <select v-model="copyTargetClassId" class="input">
          <option value="" disabled>Selecione…</option>
          <option
            v-for="c in allClasses"
            :key="c.id"
            :value="c.id"
            :disabled="c.id === copySourceClassId"
          >
            {{ c.label }}
          </option>
        </select>
      </label>
      <button
        type="button"
        class="btn btn-primary"
        :disabled="
          !copySourceClassId || !copyTargetClassId || copySourceClassId === copyTargetClassId
        "
        @click="copyAssignments"
      >
        Copiar
      </button>
    </div>
    <p v-if="copyResult" class="muted">{{ copyResultMessage(copyResult) }}</p>
  </div>

  <div v-if="classLoadRows.length" class="card">
    <h3>Total de aulas por semana</h3>
    <p class="muted">Some aqui para conferir se a carga horária de cada turma está completa.</p>
    <table class="table">
      <thead>
        <tr>
          <th>Turma</th>
          <th>Aulas/semana</th>
          <th>Períodos disponíveis</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in classLoadRows" :key="row.classId">
          <td>{{ row.label }}</td>
          <td :class="{ overloaded: row.requiredWeekly > row.availableWeekly }">
            {{ row.requiredWeekly }}
          </td>
          <td>{{ row.availableWeekly }}</td>
        </tr>
      </tbody>
    </table>
  </div>

  <div v-if="store.assignments.length" class="card">
    <h3>Atribuições cadastradas</h3>
    <div class="row" style="margin-bottom: var(--space-3)">
      <label class="field">
        <span class="field-label">Filtrar por turma</span>
        <select v-model="filterClassId" class="input">
          <option value="">Todas</option>
          <option v-for="c in allClasses" :key="c.id" :value="c.id">{{ c.label }}</option>
        </select>
      </label>
      <label class="field">
        <span class="field-label">Filtrar por disciplina</span>
        <select v-model="filterSubjectId" class="input">
          <option value="">Todas</option>
          <option v-for="s in store.subjects" :key="s.id" :value="s.id">{{ s.name }}</option>
        </select>
      </label>
    </div>
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
        <tr v-for="a in filteredAssignments" :key="a.id">
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
    <p v-if="!filteredAssignments.length" class="empty">
      Nenhuma atribuição encontrada com esses filtros.
    </p>
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

.overloaded {
  color: var(--color-danger);
  font-weight: 600;
}
</style>
