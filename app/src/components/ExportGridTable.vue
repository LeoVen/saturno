<script setup lang="ts">
import type { ClassGridExport, TeacherGridExport } from '../export/scheduleExport'

// FR-22/TR-13/IMPL.md §9: renders one Segment's (or one Teacher-in-Segment's)
// grid in the real sample sheets' two-days-per-row paper layout — shared by
// the on-screen export preview and its `@media print` rendering (D-36).
// Deliberately a plain <table> (not WeekGrid, which is the different
// continuous-5-day on-screen shape used by FR-20/21's interactive views) so
// day-header colspans and print pagination come for free.

defineProps<{
  title: string
  grid: ClassGridExport | TeacherGridExport
}>()
</script>

<template>
  <section class="export-grid">
    <h3>{{ title }}</h3>
    <table v-for="(block, bi) in grid.blocks" :key="bi" class="export-table">
      <thead>
        <tr class="day-header-row">
          <template v-for="day in block.days" :key="day.weekday">
            <th class="corner"></th>
            <th :colspan="grid.columns.length">{{ day.label }}</th>
          </template>
        </tr>
        <tr class="col-header-row">
          <template v-for="day in block.days" :key="day.weekday">
            <th class="time-header">Horário</th>
            <th v-for="col in grid.columns" :key="`${day.weekday}-${col.key}`">{{ col.label }}</th>
          </template>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(row, ri) in block.rows"
          :key="ri"
          :class="row.kind === 'break' ? 'break-row' : ''"
        >
          <template v-for="(dayCells, di) in row.cellsByDay" :key="di">
            <th class="time-label">{{ row.timeLabel }}</th>
            <td v-for="(cell, ci) in dayCells" :key="ci">
              <template v-if="cell">
                <strong v-if="cell.lines[0]" class="primary-line"
                  >{{ cell.lines[0]
                  }}<sup v-if="cell.noteNumber" class="note-marker">{{
                    cell.noteNumber
                  }}</sup></strong
                >
                <small v-if="cell.lines[1]">{{ cell.lines[1] }}</small>
                <sup v-if="cell.noteNumber && !cell.lines[0]" class="note-marker">{{
                  cell.noteNumber
                }}</sup>
              </template>
            </td>
          </template>
        </tr>
      </tbody>
    </table>

    <!-- FR-19/IMPL.md §9: numbered "Observação N" footnote list beneath the
         grid, matching the real sample sheets' convention — identical in the
         print and .xlsx paths (xlsxExport.ts's writeFootnotes). -->
    <dl v-if="grid.footnotes.length" class="footnotes">
      <template v-for="fn in grid.footnotes" :key="fn.number">
        <dt>Observação {{ fn.number }}</dt>
        <dd>{{ fn.text }}</dd>
      </template>
    </dl>
  </section>
</template>

<style scoped>
.export-grid {
  margin-bottom: var(--space-6);
}

.export-grid h3 {
  margin: 0 0 var(--space-2);
}

.export-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: var(--space-4);
  table-layout: fixed;
}

.export-table th,
.export-table td {
  border: 1px solid var(--color-border);
  padding: 4px 6px;
  text-align: center;
  font-size: 0.8rem;
  vertical-align: middle;
}

.day-header-row th {
  background: #bfdbfe;
  font-weight: 700;
  font-size: 0.9rem;
}

.col-header-row th.time-header {
  background: #93c5fd;
  font-weight: 700;
}

.col-header-row th:not(.time-header) {
  background: #dbeafe;
  font-weight: 400;
}

.time-label {
  background: #dbeafe;
  font-weight: 700;
  white-space: nowrap;
}

.break-row th,
.break-row td {
  background: #bfdbfe;
  height: 8px;
  font-size: 0.6rem;
}

.export-table td .primary-line {
  display: block;
  font-size: 0.9rem;
}

.export-table td small {
  display: block;
  font-size: 0.7rem;
  color: var(--color-text-muted);
}

.note-marker {
  font-size: 0.65rem;
  font-weight: 700;
  margin-left: 1px;
}

.footnotes {
  margin: 0 0 var(--space-4);
  font-size: 0.8rem;
}

.footnotes dt {
  font-weight: 700;
}

.footnotes dd {
  margin: 0 0 var(--space-2);
}
</style>
