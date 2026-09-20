<script setup lang="ts">
import { ref } from 'vue'
import AppSidebar, { type SidebarSection } from './components/AppSidebar.vue'
import SegmentsConfig from './components/SegmentsConfig.vue'
import GradesClassesConfig from './components/GradesClassesConfig.vue'
import SubjectsConfig from './components/SubjectsConfig.vue'
import TeachersConfig from './components/TeachersConfig.vue'
import AssignmentsConfig from './components/AssignmentsConfig.vue'
import GenerateView from './components/GenerateView.vue'
import ScheduleVersionsView from './components/ScheduleVersionsView.vue'
import ViewSchedule from './components/ViewSchedule.vue'

// INTERLUDE-1-T1: sections are reachable via a persistent sidebar, not one
// long scrolling page. Each section owns whatever selection state it needs
// internally — no router (TR-19), just which section is active.
const SECTIONS: SidebarSection[] = [
  { key: 'segments', label: 'Segmentos' },
  { key: 'grades', label: 'Séries e Turmas' },
  { key: 'subjects', label: 'Disciplinas' },
  { key: 'teachers', label: 'Professores' },
  { key: 'assignments', label: 'Atribuições' },
  { key: 'generate', label: 'Gerar Horário' },
  { key: 'versions', label: 'Versões' },
  { key: 'view', label: 'Visualizar Horário' },
]

const activeSection = ref(SECTIONS[0]!.key)
</script>

<template>
  <div class="app-shell">
    <AppSidebar v-model="activeSection" :sections="SECTIONS" />
    <main class="main-content">
      <SegmentsConfig v-if="activeSection === 'segments'" />
      <GradesClassesConfig v-else-if="activeSection === 'grades'" />
      <SubjectsConfig v-else-if="activeSection === 'subjects'" />
      <TeachersConfig v-else-if="activeSection === 'teachers'" />
      <AssignmentsConfig v-else-if="activeSection === 'assignments'" />
      <GenerateView v-else-if="activeSection === 'generate'" />
      <ScheduleVersionsView v-else-if="activeSection === 'versions'" />
      <ViewSchedule v-else-if="activeSection === 'view'" />
    </main>
  </div>
</template>
