<script setup lang="ts">
import { ref } from 'vue'
import { useProfilesStore } from '../stores/profiles'
import { PROFILE_COLORS } from '../entities/profile'

// INTERLUDE-2 (D-42): full Profile management — mirrors
// ScheduleVersionsView.vue's rename/duplicate/activate/delete table
// pattern. The always-visible quick-switch lives in AppHeader.vue instead;
// this screen is where color, rename, duplicate, and delete happen.

const store = useProfilesStore()
const errorMessage = ref('')

function formatCreatedAt(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

function renameProfile(id: string, event: Event): void {
  store.rename(id, (event.target as HTMLInputElement).value)
}

function createProfile(): void {
  const name = prompt('Nome do novo Perfil:')
  if (name === null) return
  store.create(name)
  errorMessage.value = ''
}

function duplicateProfile(id: string, name: string): void {
  const newName = prompt('Nome do novo Perfil:', `${name} (cópia)`)
  if (newName === null) return
  void store.duplicate(id, newName)
  errorMessage.value = ''
}

async function removeProfile(id: string, name: string): Promise<void> {
  if (!confirm(`Excluir o Perfil "${name}"? Essa ação não pode ser desfeita.`)) return
  const result = await store.remove(id)
  errorMessage.value = result.ok ? '' : result.error
}
</script>

<template>
  <h2>Perfis</h2>
  <p class="muted">
    Cada Perfil guarda sua própria configuração completa (Segmentos, Séries, Turmas, Disciplinas,
    Professores, Atribuições) e suas próprias Versões de Horário — totalmente independente dos
    demais. Use um Perfil por ano letivo, por exemplo, e duplique um existente para começar o
    próximo já com a base pronta.
  </p>

  <div class="card">
    <div class="row" style="margin-bottom: var(--space-4)">
      <button type="button" class="btn btn-primary" @click="createProfile">+ Novo Perfil</button>
    </div>

    <table class="table">
      <thead>
        <tr>
          <th>Cor</th>
          <th>Nome</th>
          <th>Criado em</th>
          <th>Ativo</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="p in store.items" :key="p.id">
          <td>
            <div class="color-picker">
              <button
                v-for="c in PROFILE_COLORS"
                :key="c.id"
                type="button"
                class="color-swatch"
                :class="{ selected: c.id === p.color }"
                :style="{ background: c.hex }"
                :title="c.label"
                :aria-label="`Cor: ${c.label}`"
                @click="store.setColor(p.id, c.id)"
              ></button>
            </div>
          </td>
          <td>
            <input
              class="input"
              type="text"
              :value="p.name"
              @change="renameProfile(p.id, $event)"
            />
          </td>
          <td class="muted">{{ formatCreatedAt(p.createdAt) }}</td>
          <td>
            <span v-if="p.id === store.activeProfileId" class="pill selected">Ativo</span>
            <button v-else type="button" class="btn btn-sm" @click="store.setActive(p.id)">
              Ativar
            </button>
          </td>
          <td>
            <button type="button" class="btn btn-sm" @click="duplicateProfile(p.id, p.name)">
              Duplicar
            </button>
            <button
              type="button"
              class="btn btn-danger btn-sm"
              @click="removeProfile(p.id, p.name)"
            >
              Excluir
            </button>
          </td>
        </tr>
      </tbody>
    </table>
    <p
      v-if="errorMessage"
      class="alert alert-danger"
      role="alert"
      style="margin-top: var(--space-3)"
    >
      {{ errorMessage }}
    </p>
  </div>
</template>
