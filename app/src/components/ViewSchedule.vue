<script setup lang="ts">
import { ref } from 'vue'
import { useScheduleVersionsStore } from '../stores/scheduleVersions'
import ScheduleGrid from './ScheduleGrid.vue'
import TeacherScheduleGrid from './TeacherScheduleGrid.vue'

// E08: browse the active Schedule Version (FR-24) both ways — Per-Class
// (FR-20) and Per-Teacher (FR-21). Switching is in-app state (TR-19), no
// router/URL change.
//
// D-39: read-only, deliberately — FR-17's move/swap and FR-19's Notes now
// live on their own "Ajustar Horário" screen, which only ever acts on an
// explicit draft copy (never the version shown here). Editing was briefly
// built directly into this screen (E09's first pass) and moved out after
// user feedback: mutating whatever happens to be the active version from
// the *viewing* screen, with no undo, was a real risk, and "view" is not
// where a user expects "edit" to live.

const scheduleVersions = useScheduleVersionsStore()

type ViewMode = 'class' | 'teacher'
const mode = ref<ViewMode>('class')
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
      <ScheduleGrid v-if="mode === 'class'" :schedule="scheduleVersions.activeVersion.schedule" />
      <TeacherScheduleGrid v-else :schedule="scheduleVersions.activeVersion.schedule" />
    </div>
  </template>
</template>
