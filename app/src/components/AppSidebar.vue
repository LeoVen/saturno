<script setup lang="ts">
// INTERLUDE-1-T1: persistent left-sidebar navigation between sections, as
// plain in-app reactive state — no router (TR-19).
export interface SidebarSection {
  key: string
  label: string
}

defineProps<{ sections: SidebarSection[] }>()
const activeKey = defineModel<string>({ required: true })
</script>

<template>
  <nav class="sidebar">
    <h1>Saturno</h1>
    <button
      v-for="section in sections"
      :key="section.key"
      type="button"
      class="sidebar-link"
      :class="{ active: section.key === activeKey }"
      @click="activeKey = section.key"
    >
      {{ section.label }}
    </button>
  </nav>
</template>
