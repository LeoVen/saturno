<script setup lang="ts">
import { ref } from 'vue'
import SegmentsConfig from './components/SegmentsConfig.vue'
import GradesClassesConfig from './components/GradesClassesConfig.vue'
import SubjectsConfig from './components/SubjectsConfig.vue'
import TeachersConfig from './components/TeachersConfig.vue'
import AssignmentsConfig from './components/AssignmentsConfig.vue'

// Grades/Classes are configured nested under whichever Segment is selected
// in SegmentsConfig (FR-6, E03-T4).
const selectedSegmentId = ref<string | null>(null)
</script>

<template>
  <main>
    <h1>Saturno</h1>
    <p>Gerador de horários escolares.</p>

    <SegmentsConfig v-model="selectedSegmentId" />
    <GradesClassesConfig :segment-id="selectedSegmentId" />
    <SubjectsConfig />
    <TeachersConfig />
    <AssignmentsConfig />
  </main>
</template>
