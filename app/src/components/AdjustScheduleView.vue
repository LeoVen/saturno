<script setup lang="ts">
import { computed, ref } from 'vue'
import { useScheduleVersionsStore } from '../stores/scheduleVersions'
import ScheduleGrid from './ScheduleGrid.vue'

// FR-17/18/19 (E09), D-39: manual editing lives here, not on "Visualizar
// Horário" — and only ever acts on an explicit draft copy, never directly
// on a version the school relies on. Every version in the list gets
// "Editar uma cópia" (always creates a fresh `isDraft` copy via
// `startDraft`, FR-24's existing duplicate machinery underneath); a
// version already marked `isDraft` additionally gets "Continuar editando"
// (no further copy — you're already on a disposable one). The editable
// grid below only ever renders for `scheduleVersions.activeVersion` when
// that version is `isDraft: true` — structurally, not just by convention,
// so this screen can never edit the original by accident.
//
// This screen is expected to grow a second section once E14 (Teacher
// Absence & Repair) exists — see that epic's "Future consideration" notes
// — since both are "modify a saved schedule and reconcile the
// consequences" operations that belong in one place.

const scheduleVersions = useScheduleVersionsStore()

const editingVersion = computed(() =>
  scheduleVersions.activeVersion?.isDraft ? scheduleVersions.activeVersion : undefined,
)

function startDraftFrom(id: string): void {
  scheduleVersions.startDraft(id)
}

function continueDraft(id: string): void {
  scheduleVersions.setActive(id)
}

function discardDraft(): void {
  if (!editingVersion.value) return
  if (
    !confirm(
      `Descartar o rascunho "${editingVersion.value.name}"? Esta ação não pode ser desfeita.`,
    )
  )
    return
  scheduleVersions.remove(editingVersion.value.id)
}

const wholeScheduleNotes = computed(() =>
  editingVersion.value
    ? scheduleVersions.notesFor(editingVersion.value.id).filter((n) => !n.slot)
    : [],
)

const newNoteText = ref('')
const editingNoteId = ref('')
const editingNoteText = ref('')

function addWholeScheduleNote(): void {
  if (!editingVersion.value || !newNoteText.value.trim()) return
  scheduleVersions.addNote(editingVersion.value.id, newNoteText.value)
  newNoteText.value = ''
}

function startEditingNote(id: string, text: string): void {
  editingNoteId.value = id
  editingNoteText.value = text
}

function saveEditingNote(): void {
  if (!editingVersion.value || !editingNoteText.value.trim()) return
  scheduleVersions.updateNote(editingVersion.value.id, editingNoteId.value, editingNoteText.value)
  editingNoteId.value = ''
}

function removeWholeScheduleNote(id: string): void {
  if (!editingVersion.value) return
  scheduleVersions.removeNote(editingVersion.value.id, id)
  if (editingNoteId.value === id) editingNoteId.value = ''
}
</script>

<template>
  <h2>Ajustar Horário</h2>

  <div v-if="scheduleVersions.versions.length === 0" class="card">
    <p class="empty">
      Nenhuma versão salva ainda. Gere um horário em "Gerar Horário" e salve-o em "Versões"
      primeiro.
    </p>
  </div>

  <template v-else>
    <div class="card">
      <p class="muted">
        Ajustar sempre cria (ou continua) uma cópia — a versão original nunca é alterada aqui.
      </p>
      <table class="table">
        <thead>
          <tr>
            <th>Versão</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="v in scheduleVersions.versions" :key="v.id">
            <td>
              {{ v.name }}
              <span v-if="v.isDraft" class="muted">(rascunho)</span>
            </td>
            <td>
              <button
                v-if="v.isDraft"
                type="button"
                class="btn btn-sm"
                :disabled="editingVersion?.id === v.id"
                @click="continueDraft(v.id)"
              >
                {{ editingVersion?.id === v.id ? 'Editando agora' : 'Continuar editando' }}
              </button>
              <button v-else type="button" class="btn btn-sm" @click="startDraftFrom(v.id)">
                Editar uma cópia
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <template v-if="editingVersion">
      <div class="card">
        <div class="row" style="justify-content: space-between; align-items: center">
          <p class="muted">Editando: {{ editingVersion.name }}</p>
          <button type="button" class="btn btn-danger btn-sm" @click="discardDraft">
            Descartar rascunho
          </button>
        </div>
        <ScheduleGrid
          :schedule="editingVersion.schedule"
          editable
          :version-id="editingVersion.id"
        />
      </div>

      <div class="card">
        <h3>Observações</h3>
        <p class="muted">
          Notas gerais sobre este rascunho — por exemplo, o motivo de uma alteração manual.
        </p>
        <ul v-if="wholeScheduleNotes.length" class="note-list">
          <li v-for="note in wholeScheduleNotes" :key="note.id">
            <template v-if="editingNoteId === note.id">
              <textarea v-model="editingNoteText" class="input" rows="2"></textarea>
              <div class="row">
                <button type="button" class="btn btn-primary btn-sm" @click="saveEditingNote">
                  Salvar
                </button>
                <button type="button" class="btn btn-sm" @click="editingNoteId = ''">
                  Cancelar
                </button>
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

    <div v-else class="card">
      <p class="empty">
        Escolha "Editar uma cópia" em uma versão acima para começar — isso cria um rascunho
        independente e abre a edição aqui.
      </p>
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
