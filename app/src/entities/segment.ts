// Entity types for FR-4 (Segments) and FR-5 (per-Segment Time Slots and
// Breaks). See impls/epics/E02-segments-time-slots-breaks.md.
//
// D-02: one Time Slot / Break structure per Segment, shared across every
// weekday it applies to — not modeled per (Segment, weekday).
// D-01: Time Slots carry real absolute start/end clock times.

/** 24h clock time, "HH:MM" (zero-padded), as produced by <input type="time">. */
export type ClockTime = string

export interface TimeSlot {
  id: string
  start: ClockTime
  end: ClockTime
}

export interface Break {
  id: string
  start: ClockTime
  end: ClockTime
}

export interface Segment {
  id: string
  name: string
  timeSlots: TimeSlot[]
  breaks: Break[]
}
