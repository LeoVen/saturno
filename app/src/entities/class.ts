// FR-6: a Class belongs to exactly one Grade and is the actual unit the
// schedule is built for.

export interface Class {
  id: string
  gradeId: string
  name: string
}
