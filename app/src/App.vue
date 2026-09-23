<script setup lang="ts">
import { computed, ref } from 'vue'
import AppHeader from './components/AppHeader.vue'
import AppSidebar, { type SidebarSection } from './components/AppSidebar.vue'
import SegmentsConfig from './components/SegmentsConfig.vue'
import GradesClassesConfig from './components/GradesClassesConfig.vue'
import SubjectsConfig from './components/SubjectsConfig.vue'
import TeachersConfig from './components/TeachersConfig.vue'
import AssignmentsConfig from './components/AssignmentsConfig.vue'
import JointSessionsConfig from './components/JointSessionsConfig.vue'
import GenerateView from './components/GenerateView.vue'
import DeepSearchView from './components/DeepSearchView.vue'
import ScheduleVersionsView from './components/ScheduleVersionsView.vue'
import AdjustScheduleView from './components/AdjustScheduleView.vue'
import ViewSchedule from './components/ViewSchedule.vue'
import ExportView from './components/ExportView.vue'
import DataPortabilityView from './components/DataPortabilityView.vue'
import ProfilesView from './components/ProfilesView.vue'
import { useProfilesStore } from './stores/profiles'
import { profileColorHex, profileColorRgba } from './entities/profile'

// INTERLUDE-1-T1: sections are reachable via a persistent sidebar, not one
// long scrolling page. Each section owns whatever selection state it needs
// internally — no router (TR-19), just which section is active.
const SECTIONS: SidebarSection[] = [
  { key: 'segments', label: 'Segmentos' },
  { key: 'grades', label: 'Séries e Turmas' },
  { key: 'subjects', label: 'Disciplinas' },
  { key: 'teachers', label: 'Professores' },
  { key: 'assignments', label: 'Atribuições' },
  { key: 'jointSessions', label: 'Sessões Conjuntas' },
  { key: 'generate', label: 'Gerar Horário' },
  { key: 'deepSearch', label: 'Busca Aprofundada' },
  { key: 'versions', label: 'Versões' },
  { key: 'adjust', label: 'Ajustar Horário' },
  { key: 'view', label: 'Visualizar Horário' },
  { key: 'export', label: 'Exportar' },
  { key: 'data', label: 'Dados' },
  { key: 'profiles', label: 'Perfis' },
]

const activeSection = ref(SECTIONS[0]!.key)

// INTERLUDE-2 (D-42): the active Profile's color, exposed as CSS custom
// properties on the outermost wrapper so both AppHeader and the Sidebar
// accent (style.css) can read it without threading a prop through.
const profiles = useProfilesStore()
const profileColorVars = computed(() => {
  const color = profiles.activeProfile?.color ?? 'azul'
  return {
    '--profile-color': profileColorHex(color),
    '--profile-color-soft': profileColorRgba(color, 0.08),
  }
})
</script>

<template>
  <div class="app-root" :style="profileColorVars">
    <AppHeader @manage="activeSection = 'profiles'" />
    <div class="app-shell">
      <AppSidebar v-model="activeSection" :sections="SECTIONS" />
      <main class="main-content">
        <SegmentsConfig v-if="activeSection === 'segments'" />
        <GradesClassesConfig v-else-if="activeSection === 'grades'" />
        <SubjectsConfig v-else-if="activeSection === 'subjects'" />
        <TeachersConfig v-else-if="activeSection === 'teachers'" />
        <AssignmentsConfig v-else-if="activeSection === 'assignments'" />
        <JointSessionsConfig v-else-if="activeSection === 'jointSessions'" />
        <GenerateView v-else-if="activeSection === 'generate'" />
        <DeepSearchView v-else-if="activeSection === 'deepSearch'" />
        <ScheduleVersionsView v-else-if="activeSection === 'versions'" />
        <AdjustScheduleView v-else-if="activeSection === 'adjust'" />
        <ViewSchedule v-else-if="activeSection === 'view'" />
        <ExportView v-else-if="activeSection === 'export'" />
        <DataPortabilityView v-else-if="activeSection === 'data'" />
        <ProfilesView v-else-if="activeSection === 'profiles'" />
      </main>
    </div>
  </div>
</template>
