// FR-13's pre-generation gate: shared pt-BR message formatting for the two
// structural warnings (an overloaded Class, an Assignment with zero
// overlapping Teacher availability) that block any generation screen from
// running — E06's Quick Generation and E13's Deep Search both gate on the
// exact same checks (`entities.overloadedClasses`/`zeroOverlapAssignments`),
// so the wording lives in one place rather than two components drifting
// apart from each other over time.

import type { useEntitiesStore } from '../stores/entities'

type Entities = ReturnType<typeof useEntitiesStore>

function classLabel(entities: Entities, classId: string): string {
  const schoolClass = entities.classById(classId)
  if (!schoolClass) return '?'
  const grade = entities.gradeById(schoolClass.gradeId)
  const segment = grade ? entities.segmentById(grade.segmentId) : undefined
  return [segment?.name, grade?.name, schoolClass.name].filter(Boolean).join(' / ')
}

export function overloadMessage(
  entities: Entities,
  classId: string,
  requiredWeekly: number,
  availableWeekly: number,
): string {
  return `${classLabel(entities, classId)}: requer ${requiredWeekly} aula(s) por semana, mas o segmento só oferece ${availableWeekly} período(s) não vagos por semana.`
}

export function zeroOverlapMessage(
  entities: Entities,
  assignmentId: string,
  teacherId: string,
  classId: string,
): string {
  const subjectId = entities.assignmentById(assignmentId)?.subjectId
  const subjectLabel = subjectId ? entities.subjectById(subjectId)?.name : undefined
  return `${entities.teacherLabel(teacherId)}: nenhum horário disponível compatível com ${classLabel(entities, classId)}${subjectLabel ? ` para a disciplina ${subjectLabel}` : ''}.`
}
