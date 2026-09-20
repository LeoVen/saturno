<script setup lang="ts">
// INTERLUDE-1-T3 / D-16: a fixed 24h HH:MM control (hour + 5-minute-step
// minute <select>s), replacing native <input type="time"> everywhere —
// the native control renders in the browser/OS locale format (confirmed
// showing AM/PM in earlier epics' own verification screenshots), and
// there's no HTML attribute to force 24h display.
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    modelValue: string
    /** Show "--" placeholders instead of a real value until the user picks both fields. */
    allowEmpty?: boolean
  }>(),
  { allowEmpty: false },
)
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const HOURS = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, '0'))
const MINUTES = Array.from({ length: 12 }, (_, m) => String(m * 5).padStart(2, '0'))

const hour = computed(() => props.modelValue.split(':')[0] ?? '')
const minute = computed(() => props.modelValue.split(':')[1] ?? '')

function setHour(value: string): void {
  emit('update:modelValue', `${value}:${minute.value || '00'}`)
}

function setMinute(value: string): void {
  emit('update:modelValue', `${hour.value || '00'}:${value}`)
}
</script>

<template>
  <span class="time-input">
    <select
      class="input"
      aria-label="Hora"
      :value="hour"
      @change="setHour(($event.target as HTMLSelectElement).value)"
    >
      <option v-if="allowEmpty" value="" disabled hidden>--</option>
      <option v-for="h in HOURS" :key="h" :value="h">{{ h }}</option>
    </select>
    <span aria-hidden="true">:</span>
    <select
      class="input"
      aria-label="Minuto"
      :value="minute"
      @change="setMinute(($event.target as HTMLSelectElement).value)"
    >
      <option v-if="allowEmpty" value="" disabled hidden>--</option>
      <option v-for="m in MINUTES" :key="m" :value="m">{{ m }}</option>
    </select>
  </span>
</template>

<style scoped>
.time-input {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

.time-input select {
  padding: var(--space-1) var(--space-2);
}
</style>
