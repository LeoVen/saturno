<script setup lang="ts">
import { computed, ref } from 'vue'
import { useEntitiesStore } from '../stores/entities'
import { useScheduleVersionsStore } from '../stores/scheduleVersions'
import { buildClassGridExports, buildTeacherGridExports } from '../export/scheduleExport'
import {
  buildClassGridWorkbook,
  buildTeacherGridWorkbook,
  downloadWorkbook,
} from '../export/xlsxExport'
import ExportGridTable from './ExportGridTable.vue'

// FR-22, TR-13, IMPL.md §9: Human-Readable Export — printable (window.print,
// @media print below) and .xlsx, both per-Class and per-Teacher, both
// reading the same shared view-model (D-36) so they can't drift apart.

const entities = useEntitiesStore()
const scheduleVersions = useScheduleVersionsStore()

type ExportMode = 'class' | 'teacher'
const mode = ref<ExportMode>('class')

const entitiesSnapshot = computed(() => ({
  segments: entities.segments,
  grades: entities.grades,
  classes: entities.classes,
  subjects: entities.subjects,
  teachers: entities.teachers,
  assignments: entities.assignments,
}))

const classGrids = computed(() => {
  const schedule = scheduleVersions.activeVersion?.schedule
  return schedule ? buildClassGridExports(entitiesSnapshot.value, schedule) : []
})

const teacherGrids = computed(() => {
  const schedule = scheduleVersions.activeVersion?.schedule
  return schedule ? buildTeacherGridExports(entitiesSnapshot.value, schedule) : []
})

function triggerPrint(): void {
  window.print()
}

async function downloadXlsx(): Promise<void> {
  const versionName = scheduleVersions.activeVersion?.name ?? 'horario'
  if (mode.value === 'class') {
    const workbook = buildClassGridWorkbook(classGrids.value)
    await downloadWorkbook(workbook, `saturno-${versionName}-por-turma.xlsx`)
  } else {
    const workbook = buildTeacherGridWorkbook(teacherGrids.value)
    await downloadWorkbook(workbook, `saturno-${versionName}-por-professor.xlsx`)
  }
}
</script>

<template>
  <h2 class="no-print">Exportar Horário</h2>

  <div v-if="!scheduleVersions.activeVersion" class="card no-print">
    <p class="empty">
      Nenhuma versão ativa ainda. Gere um horário em "Gerar Horário" e salve-o, ou ative uma versão
      existente em "Versões".
    </p>
  </div>

  <template v-else>
    <div class="card no-print">
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
      <div class="row" style="margin-top: var(--space-4)">
        <button type="button" class="btn btn-primary" @click="triggerPrint">Imprimir</button>
        <button type="button" class="btn" @click="downloadXlsx">Baixar .xlsx</button>
      </div>
    </div>

    <div class="export-sheet">
      <template v-if="mode === 'class'">
        <ExportGridTable
          v-for="grid in classGrids"
          :key="grid.segmentId"
          :title="grid.segmentName"
          :grid="grid"
        />
        <p v-if="classGrids.length === 0" class="empty no-print">
          Nenhum Segmento com Horários e Turmas configurados ainda.
        </p>
      </template>
      <template v-else>
        <ExportGridTable
          v-for="grid in teacherGrids"
          :key="`${grid.teacherId}-${grid.segmentId}`"
          :title="`${grid.teacherLabel} — ${grid.segmentName}`"
          :grid="grid"
        />
        <p v-if="teacherGrids.length === 0" class="empty no-print">
          Nenhum Professor com aulas na versão ativa ainda.
        </p>
      </template>
    </div>
  </template>
</template>

<style scoped>
.export-sheet {
  margin-top: var(--space-4);
}

@media print {
  :global(.sidebar),
  .no-print {
    display: none !important;
  }

  .export-sheet :deep(.export-grid) {
    break-inside: avoid;
    break-after: page;
  }

  .export-sheet :deep(.export-grid:last-child) {
    break-after: auto;
  }
}
</style>
