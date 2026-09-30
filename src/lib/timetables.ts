import { scoped } from '../model/defaults'
import type { SchoolProject, SolveResult, Timetable } from '../model/types'

export function timetableFromResult(p: SchoolProject, r: SolveResult, name: string): Timetable {
  const { lessons, qualityReport, teacherAssignments, ...result } = r
  return { ...scoped(p.school.id), name, status: 'draft', lessons, qualityReport, teacherAssignments, result }
}

export const acceptedTimetable = (p: SchoolProject) => p.timetables.find((x) => x.status === 'accepted')
export const draftTimetable = (p: SchoolProject) => p.timetables.find((x) => x.status === 'draft')

/** Draft → accepted; the previous accepted timetable is replaced. Mutates the project clone. */
export function acceptDraft(p: SchoolProject) {
  const d = draftTimetable(p)
  if (!d) return
  p.timetables = p.timetables.filter((x) => x.status !== 'accepted')
  d.status = 'accepted'
}
