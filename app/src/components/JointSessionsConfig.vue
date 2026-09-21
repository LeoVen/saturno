<script setup lang="ts">
import { computed, ref } from 'vue'
import { useEntitiesStore } from '../stores/entities'

// FR-25-31: Joint Sessions — a shared block attended simultaneously by a
// set of Classes (all within one Segment, FR-25), with one or more
// parallel Tracks (FR-27, each a Subject + Teacher). Modeled after
// AssignmentsConfig.vue's shape (a picker/creator plus an inline editor
// per configured item) — see impls/epics/E10-joint-sessions.md.

const store = useEntitiesStore()

function classLabel(classId: string): string {
  const schoolClass = store.classById(classId)
  if (!schoolClass) return '?'
  const grade = schoolClass ? store.gradeById(schoolClass.gradeId) : undefined
  const segment = grade ? store.segmentById(grade.segmentId) : undefined
  return [segment?.name, grade?.name, schoolClass.name].filter(Boolean).join(' / ')
}

const newSessionName = ref('')

function createSession(): void {
  const name = newSessionName.value.trim()
  if (!name) return
  store.addJointSession(name)
  newSessionName.value = ''
}

function onRename(id: string, event: Event): void {
  store.renameJointSession(id, (event.target as HTMLInputElement).value)
}

function onWeeklyOccurrencesChange(id: string, event: Event): void {
  store.setJointSessionWeeklyOccurrences(id, Number((event.target as HTMLInputElement).value))
}

/**
 * FR-25: before any Class is added, any Class in the school is a valid
 * pick — the first pick then fixes the session's Segment, and every
 * later pick is narrowed to that same Segment (enforced again in the
 * store; this is just what the checkbox list itself offers).
 */
function eligibleClassesFor(sessionId: string) {
  const session = store.jointSessionById(sessionId)
  if (!session) return []
  const lockedSegmentId = session.classIds.length
    ? store.segmentOfClass(session.classIds[0]!)?.id
    : undefined
  return store.orderedClasses.filter((c) => {
    if (!lockedSegmentId) return true
    return store.segmentOfClass(c.id)?.id === lockedSegmentId
  })
}

function toggleClass(sessionId: string, classId: string, event: Event): void {
  if ((event.target as HTMLInputElement).checked) {
    store.addJointSessionClass(sessionId, classId)
  } else {
    store.removeJointSessionClass(sessionId, classId)
  }
}

// One (Subject, Teacher) draft per session's "add Track" form.
const newTrackSubjectId = ref<Record<string, string>>({})
const newTrackTeacherId = ref<Record<string, string>>({})

// (No "keep an already-picked-but-now-unqualified Teacher visible" case
// here, unlike AssignmentsConfig's eligibleTeachers — this form only ever
// proposes a *new* Track, it never edits an existing one's Teacher.)
function eligibleTeachersForTrack(subjectId: string) {
  if (!subjectId) return []
  const qualified = store.teachersForSubject(subjectId)
  return qualified.length > 0 ? qualified : store.teachers
}

function addTrack(sessionId: string): void {
  const subjectId = newTrackSubjectId.value[sessionId]
  const teacherId = newTrackTeacherId.value[sessionId]
  if (!subjectId || !teacherId) return
  const trackId = store.addTrack(sessionId, subjectId, teacherId)
  if (trackId) {
    newTrackSubjectId.value[sessionId] = ''
    newTrackTeacherId.value[sessionId] = ''
  }
}

const trackAddError = computed(() => (sessionId: string) => {
  const subjectId = newTrackSubjectId.value[sessionId]
  const teacherId = newTrackTeacherId.value[sessionId]
  if (!subjectId || !teacherId) return ''
  const session = store.jointSessionById(sessionId)
  if (session?.tracks.some((t) => t.teacherId === teacherId)) {
    return `${store.teacherLabel(teacherId)} já está em outra Trilha desta sessão — todas as Trilhas ocorrem ao mesmo tempo.`
  }
  return ''
})
</script>

<template>
  <h2>Sessões Conjuntas</h2>
  <p class="muted">
    Um bloco compartilhado por várias turmas ao mesmo tempo (ex.: Itinerários), com uma ou mais
    Trilhas (disciplina + professor) em paralelo — sem registrar quais alunos vão para qual Trilha.
  </p>

  <div class="card">
    <div class="row">
      <label class="field">
        <span class="field-label">Nova sessão conjunta</span>
        <input
          v-model="newSessionName"
          class="input"
          type="text"
          placeholder="ex.: Itinerários"
          @keyup.enter="createSession"
        />
      </label>
      <button type="button" class="btn btn-primary" @click="createSession">Criar</button>
    </div>
  </div>

  <p v-if="!store.jointSessions.length" class="empty">Nenhuma sessão conjunta cadastrada.</p>

  <div v-for="session in store.jointSessions" :key="session.id" class="card">
    <div class="row">
      <label class="field">
        <span class="field-label">Nome</span>
        <input
          class="input"
          type="text"
          :value="session.name"
          @change="onRename(session.id, $event)"
        />
      </label>
      <label class="field">
        <span class="field-label">Ocorrências por semana</span>
        <input
          class="input input-sm"
          type="number"
          min="1"
          :value="session.weeklyOccurrences"
          @change="onWeeklyOccurrencesChange(session.id, $event)"
        />
      </label>
      <button
        type="button"
        class="btn btn-danger btn-sm"
        @click="store.removeJointSession(session.id)"
      >
        Excluir sessão
      </button>
    </div>

    <fieldset style="margin-top: var(--space-3)">
      <legend class="field-label">Turmas participantes</legend>
      <label v-for="c in eligibleClassesFor(session.id)" :key="c.id" class="field field-inline">
        <input
          type="checkbox"
          :checked="session.classIds.includes(c.id)"
          @change="toggleClass(session.id, c.id, $event)"
        />
        <span>{{ classLabel(c.id) }}</span>
      </label>
      <p v-if="!eligibleClassesFor(session.id).length" class="empty">
        Nenhuma turma cadastrada. Configure em "Séries e Turmas".
      </p>
      <p v-else-if="session.classIds.length" class="muted">
        Restrita ao mesmo segmento da primeira turma escolhida (FR-25).
      </p>
    </fieldset>

    <fieldset style="margin-top: var(--space-3)">
      <legend class="field-label">Trilhas (disciplina + professor, em paralelo)</legend>
      <table v-if="session.tracks.length" class="table">
        <thead>
          <tr>
            <th>Disciplina</th>
            <th>Professor</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="t in session.tracks" :key="t.id">
            <td>{{ store.subjectById(t.subjectId)?.name ?? '?' }}</td>
            <td>{{ store.teacherLabel(t.teacherId) }}</td>
            <td>
              <button
                type="button"
                class="btn btn-danger btn-sm"
                @click="store.removeTrack(session.id, t.id)"
              >
                Excluir
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      <p v-else class="empty">Nenhuma Trilha ainda.</p>

      <div class="row" style="margin-top: var(--space-2)">
        <label class="field">
          <span class="field-label">Disciplina</span>
          <select v-model="newTrackSubjectId[session.id]" class="input">
            <option value="" disabled>Selecione…</option>
            <option v-for="s in store.subjects" :key="s.id" :value="s.id">{{ s.name }}</option>
          </select>
        </label>
        <label class="field">
          <span class="field-label">Professor</span>
          <select v-model="newTrackTeacherId[session.id]" class="input">
            <option value="" disabled>Selecione…</option>
            <option
              v-for="t in eligibleTeachersForTrack(newTrackSubjectId[session.id] ?? '')"
              :key="t.id"
              :value="t.id"
            >
              {{ store.teacherLabel(t.id) }}
            </option>
          </select>
        </label>
        <button
          type="button"
          class="btn"
          :disabled="
            !newTrackSubjectId[session.id] ||
            !newTrackTeacherId[session.id] ||
            !!trackAddError(session.id)
          "
          @click="addTrack(session.id)"
        >
          Adicionar Trilha
        </button>
      </div>
      <p v-if="trackAddError(session.id)" class="alert alert-danger" role="alert">
        {{ trackAddError(session.id) }}
      </p>
    </fieldset>
  </div>
</template>

<style scoped>
fieldset {
  border: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}
</style>
