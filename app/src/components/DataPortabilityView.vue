<script setup lang="ts">
import { computed, ref } from 'vue'
import { useEntitiesStore } from '../stores/entities'
import { useScheduleVersionsStore } from '../stores/scheduleVersions'
import { buildExport, parseImport } from '../persistence/exportImport'

// FR-23, TR-7, TR-12: full-state export/import as a single JSON file.
// Import replaces every current entity/Schedule Version — TR-8's
// schemaVersion check and migration chain live in
// persistence/exportImport.ts + migrations.ts (pure, unit-tested there).

const entities = useEntitiesStore()
const scheduleVersions = useScheduleVersionsStore()

const exportJson = computed(() =>
  JSON.stringify(
    buildExport(
      {
        segments: entities.segments,
        grades: entities.grades,
        classes: entities.classes,
        subjects: entities.subjects,
        teachers: entities.teachers,
        assignments: entities.assignments,
        jointSessions: entities.jointSessions,
      },
      {
        versions: scheduleVersions.versions,
        activeVersionId: scheduleVersions.activeVersionId,
      },
    ),
    null,
    2,
  ),
)

function downloadExport(): void {
  const blob = new Blob([exportJson.value], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `saturno-${new Date().toISOString().slice(0, 10)}.json`
  anchor.click()
  URL.revokeObjectURL(url)
}

const copyMessage = ref('')

async function copyExport(): Promise<void> {
  try {
    await navigator.clipboard.writeText(exportJson.value)
    copyMessage.value = 'Copiado para a área de transferência.'
  } catch {
    copyMessage.value =
      'Não foi possível copiar automaticamente — selecione e copie o texto abaixo manualmente.'
  }
}

const importText = ref('')
const importMessage = ref('')
const importError = ref('')

function applyImport(raw: string): void {
  const result = parseImport(raw)
  if (!result.ok) {
    importError.value = result.error
    importMessage.value = ''
    return
  }
  if (
    !confirm(
      'Importar vai substituir todos os dados atuais (configuração e versões de horário salvas). Continuar?',
    )
  ) {
    return
  }
  entities.$patch(result.entities)
  scheduleVersions.$patch(result.scheduleVersions)
  importError.value = ''
  importMessage.value = 'Dados importados com sucesso.'
  importText.value = ''
}

function importFromText(): void {
  if (!importText.value.trim()) return
  applyImport(importText.value)
}

function onFileSelected(event: Event): void {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => applyImport(String(reader.result ?? ''))
  reader.readAsText(file)
  input.value = ''
}
</script>

<template>
  <h2>Dados</h2>

  <div class="card">
    <h3>Exportar</h3>
    <p class="muted">
      Exporta toda a configuração da escola, incluindo as versões de horário salvas, em um único
      arquivo JSON — útil para backup, trocar de computador, ou compartilhar para suporte.
    </p>
    <div class="row">
      <button type="button" class="btn btn-primary" @click="downloadExport">Baixar arquivo</button>
      <button type="button" class="btn" @click="copyExport">Copiar JSON</button>
    </div>
    <p v-if="copyMessage" class="muted">{{ copyMessage }}</p>
    <textarea class="input export-json" readonly rows="10" :value="exportJson"></textarea>
  </div>

  <div class="card">
    <h3>Importar</h3>
    <p class="muted">
      Importar substitui todos os dados atuais (segmentos, séries, turmas, disciplinas, professores,
      atribuições e versões de horário) pelos dados do arquivo.
    </p>
    <label class="field">
      <span class="field-label">Arquivo (.json)</span>
      <input type="file" accept=".json,application/json" @change="onFileSelected" />
    </label>

    <label class="field" style="margin-top: var(--space-4)">
      <span class="field-label">Ou cole o JSON aqui</span>
      <textarea v-model="importText" class="input export-json" rows="10"></textarea>
    </label>
    <button type="button" class="btn" style="margin-top: var(--space-2)" @click="importFromText">
      Importar deste texto
    </button>

    <p v-if="importMessage" class="muted">{{ importMessage }}</p>
    <p v-if="importError" class="alert alert-danger" role="alert">{{ importError }}</p>
  </div>
</template>

<style scoped>
.export-json {
  display: block;
  width: 100%;
  font-family: ui-monospace, monospace;
  font-size: 0.8rem;
  margin-top: var(--space-2);
}
</style>
