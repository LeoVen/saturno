<script setup lang="ts">
// INTERLUDE-1-T4: a reusable weekday x time-row grid layout, calendar-like.
// This is a pure layout primitive — it renders columns/rows and exposes one
// cell per (column, row) via a scoped slot, but knows nothing about what a
// cell means (available/unavailable, a Time Slot, a Break, ...). Each
// consumer owns cell content and click behavior, since Segments (D-02: one
// shared structure, not per-weekday) and Teacher Availability (D-01: real
// per-weekday ranges) have genuinely different semantics — only the visual
// skeleton is shared.

export interface WeekGridColumn {
  key: string
  label: string
}

export interface WeekGridRow {
  key: string
  label: string
}

defineProps<{
  columns: WeekGridColumn[]
  rows: WeekGridRow[]
}>()
</script>

<template>
  <div
    class="week-grid"
    :style="{
      gridTemplateColumns: `minmax(90px, auto) repeat(${columns.length}, minmax(64px, 1fr))`,
    }"
  >
    <div class="week-grid-corner"></div>
    <div v-for="col in columns" :key="col.key" class="week-grid-col-header">
      <slot name="col-header" :column="col">{{ col.label }}</slot>
    </div>

    <template v-for="row in rows" :key="row.key">
      <div class="week-grid-row-header">{{ row.label }}</div>
      <div v-for="col in columns" :key="col.key" class="week-grid-cell">
        <slot name="cell" :column="col" :row="row" />
      </div>
    </template>

    <p v-if="!rows.length" class="week-grid-empty">Nada para exibir ainda.</p>
  </div>
</template>

<style scoped>
.week-grid {
  display: grid;
  gap: 3px;
  overflow-x: auto;
}

.week-grid-corner {
  position: sticky;
  left: 0;
}

.week-grid-col-header {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--color-text-muted);
  padding: var(--space-1) var(--space-2);
  text-align: center;
}

.week-grid-row-header {
  font-size: 0.8rem;
  color: var(--color-text-muted);
  padding: var(--space-1) var(--space-2);
  display: flex;
  align-items: center;
  white-space: nowrap;
  position: sticky;
  left: 0;
  background: var(--color-surface);
}

.week-grid-cell {
  min-height: 2.25rem;
}

.week-grid-empty {
  grid-column: 1 / -1;
}
</style>
