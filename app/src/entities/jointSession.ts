// FR-25-31: a Joint Session — a shared block attended simultaneously by a
// specified set of Classes, all of which must belong to the same Segment
// (FR-25, validated in the store — Segments define Time Slots per FR-5,
// so a single weekly occurrence only means one real time for every
// participating Class when they share a Segment). Tracks no
// individual-student data (FR-26) — only which Classes and Teachers are
// occupied. See impls/epics/E10-joint-sessions.md.

/** FR-27: one (Subject, Teacher) pair running inside a Joint Session, in parallel with every other Track of the same session, at the exact same slot(s). Unlike `Assignment.teacherIds` (D-12's substitute pool for FR-36/Repair), a Track has exactly one Teacher — no pool concept extends here. */
export interface Track {
  id: string
  subjectId: string
  teacherId: string
}

/** FR-28: `weeklyOccurrences` is scoped to the session as a whole (not per-Class, per-Track) — analogous to FR-8, but a Joint Session isn't "a subject a Class has." */
export interface JointSession {
  id: string
  name: string
  classIds: string[]
  tracks: Track[]
  weeklyOccurrences: number
}
