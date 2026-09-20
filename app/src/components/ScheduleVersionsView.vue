<script setup lang="ts">
import { useScheduleVersionsStore } from '../stores/scheduleVersions'

// FR-24: named Schedule Versions — hold several at once, switch between
// them, duplicate one as the starting point for a new one. Versions are
// created from E06's Generate screen ("Salvar como nova versão"); this
// screen manages what's saved. Browsing a version's actual schedule is
// E08's "Visualizar Horário" screen.

const store = useScheduleVersionsStore()

function formatCreatedAt(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  })
}

function renameVersion(id: string, event: Event): void {
  store.rename(id, (event.target as HTMLInputElement).value)
}

function duplicateVersion(id: string, name: string): void {
  store.duplicate(id, `${name} (cópia)`)
}
</script>

<template>
  <h2>Versões</h2>

  <div class="card">
    <table v-if="store.versions.length" class="table">
      <thead>
        <tr>
          <th>Nome</th>
          <th>Criada em</th>
          <th>Ativa</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="v in store.versions" :key="v.id">
          <td>
            <input
              class="input"
              type="text"
              :value="v.name"
              @change="renameVersion(v.id, $event)"
            />
          </td>
          <td class="muted">{{ formatCreatedAt(v.createdAt) }}</td>
          <td>
            <span v-if="v.id === store.activeVersionId" class="pill selected">Ativa</span>
            <button v-else type="button" class="btn btn-sm" @click="store.setActive(v.id)">
              Ativar
            </button>
          </td>
          <td>
            <button type="button" class="btn btn-sm" @click="duplicateVersion(v.id, v.name)">
              Duplicar
            </button>
            <button type="button" class="btn btn-danger btn-sm" @click="store.remove(v.id)">
              Excluir
            </button>
          </td>
        </tr>
      </tbody>
    </table>
    <p v-else class="empty">
      Nenhuma versão salva ainda. Gere um horário em "Gerar Horário" e salve-o como versão.
    </p>
  </div>
</template>
