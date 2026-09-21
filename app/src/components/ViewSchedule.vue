<script setup lang="ts">
import { computed, ref } from 'vue'
import { useScheduleVersionsStore } from '../stores/scheduleVersions'
import ScheduleGrid from './ScheduleGrid.vue'
import TeacherScheduleGrid from './TeacherScheduleGrid.vue'

// E08: browse the active Schedule Version (FR-24) both ways — Per-Class
// (FR-20) and Per-Teacher (FR-21). Switching is in-app state (TR-19), no
// router/URL change.
//
// E09: the one place `ScheduleGrid` is rendered `editable` — FR-17's
// move/swap and FR-19's per-slot Note both need a real, saved
// `versionId` to act on, which only exists here (not in E06's
// just-generated preview). The whole-schedule Note (also FR-19) lives on
// this screen directly, below the grid — matching the real sample
// sheets' "Observação N" footnote placement (IMPL.md §9) — since it's
// scoped to the version as a whole, not to either view mode.

const scheduleVersions = useScheduleVersionsStore()

type ViewMode = 'class' | 'teacher'
const mode = ref<ViewMode>('class')

const wholeScheduleNotes = computed(() =>
  scheduleVersions.activeVersionId
    ? scheduleVersions.notesFor(scheduleVersions.activeVersionId).filter((n) => !n.slot)
    : [],
)

const newNoteText = ref('')
const editingNoteId = ref('')
const editingNoteText = ref('')

function addWholeScheduleNote(): void {
  if (!scheduleVersions.activeVersionId || !newNoteText.value.trim()) return
  scheduleVersions.addNote(scheduleVersions.activeVersionId, newNoteText.value)
  newNoteText.value = ''
}

function startEditingNote(id: string, text: string): void {
  editingNoteId.value = id
  editingNoteText.value = text
}

function saveEditingNote(): void {
  if (!scheduleVersions.activeVersionId || !editingNoteText.value.trim()) return
  scheduleVersions.updateNote(
    scheduleVersions.activeVersionId,
    editingNoteId.value,
    editingNoteText.value,
  )
  editingNoteId.value = ''
}

function removeWholeScheduleNote(id: string): void {
  if (!scheduleVersions.activeVersionId) return
  scheduleVersions.removeNote(scheduleVersions.activeVersionId, id)
  if (editingNoteId.value === id) editingNoteId.value = ''
}
</script>

<template>
  <h2>Visualizar Horário</h2>

  <div v-if="!scheduleVersions.activeVersion" class="card">
    <p class="empty">
      Nenhuma versão ativa ainda. Gere um horário em "Gerar Horário" e salve-o, ou ative uma versão
      existente em "Versões".
    </p>
  </div>

  <template v-else>
    <div class="card">
      <p class="muted">Versão ativa: {{ scheduleVersions.activeVersion.name }}</p>
      <ul class="pill-list">
        <li>
          <button
            type="button"
            class="pill"
            :class="{ selected: mode === 'class' }"
            @click="mode = 'class'"
          >
            Por Turma
          </button>
        </li>
        <li>
          <button
            type="button"
            class="pill"
            :class="{ selected: mode === 'teacher' }"
            @click="mode = 'teacher'"
          >
            Por Professor
          </button>
        </li>
      </ul>
    </div>

    <div class="card">
      <ScheduleGrid
        v-if="mode === 'class'"
        :schedule="scheduleVersions.activeVersion.schedule"
        editable
        :version-id="scheduleVersions.activeVersionId"
      />
      <TeacherScheduleGrid v-else :schedule="scheduleVersions.activeVersion.schedule" />
    </div>

    <div class="card">
      <h3>Observações</h3>
      <p class="muted">
        Notas gerais sobre esta versão do horário — por exemplo, o motivo de uma alteração manual.
      </p>
      <ul v-if="wholeScheduleNotes.length" class="note-list">
        <li v-for="note in wholeScheduleNotes" :key="note.id">
          <template v-if="editingNoteId === note.id">
            <textarea v-model="editingNoteText" class="input" rows="2"></textarea>
            <div class="row">
              <button type="button" class="btn btn-primary btn-sm" @click="saveEditingNote">
                Salvar
              </button>
              <button type="button" class="btn btn-sm" @click="editingNoteId = ''">Cancelar</button>
            </div>
          </template>
          <template v-else>
            <p>{{ note.text }}</p>
            <div class="row">
              <button
                type="button"
                class="btn btn-sm"
                @click="startEditingNote(note.id, note.text)"
              >
                Editar
              </button>
              <button
                type="button"
                class="btn btn-danger btn-sm"
                @click="removeWholeScheduleNote(note.id)"
              >
                Remover
              </button>
            </div>
          </template>
        </li>
      </ul>
      <div class="row" style="margin-top: var(--space-2)">
        <textarea
          v-model="newNoteText"
          class="input"
          rows="2"
          placeholder="Nova observação…"
          style="flex: 1"
        ></textarea>
      </div>
      <button
        type="button"
        class="btn"
        style="margin-top: var(--space-2)"
        @click="addWholeScheduleNote"
      >
        Adicionar observação
      </button>
    </div>
  </template>
</template>

<style scoped>
.note-list {
  list-style: none;
  margin: 0 0 var(--space-3);
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.note-list li {
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
}

.note-list p {
  margin: 0 0 var(--space-2);
}
</style>
