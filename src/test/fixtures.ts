/** Small hand-made school used by the unit tests. */
import { newSchool, scoped } from '../model/defaults'
import type { Lesson, SchoolSnapshot, Weekday } from '../model/types'
import { generateBellSchedule } from '../model/week'

/**
 * 3 teaching days (Sun–Tue), 4 periods/day (P1–2 and P3–4 joinable).
 * Rooms: R1, R2 (classroom), LAB (lab). Classes C1 (homeroom R1), C2 (homeroom R2).
 * Teachers: T1 math (X 10, off Tue), T2 science (X 6, off Mon).
 * Groups: gMath1 (T1, C1, 3h), gSci (T2, C1, 2h as 1 double), gMath2 (T1, C2, 2h).
 */
export function tinySchool(): SchoolSnapshot & { ids: Record<string, string> } {
  const school = newSchool('Tiny')
  const bs = generateBellSchedule('R', { startTime: '08:00', endTime: '11:15', periodLengthMin: 45, breaks: [{ afterPeriod: 2, durationMin: 15 }] })
  school.week = { days: [0, 1, 2], bellSchedules: [bs], dayBellSchedule: { 0: bs.id, 1: bs.id, 2: bs.id } }
  const S = () => scoped(school.id)
  const classroom = { ...S(), name: 'Classroom' }
  const lab = { ...S(), name: 'Lab' }
  const R1 = { ...S(), name: 'R1', roomTypeId: classroom.id }
  const R2 = { ...S(), name: 'R2', roomTypeId: classroom.id }
  const LAB = { ...S(), name: 'LAB', roomTypeId: lab.id }
  const math = { ...S(), name: 'Math', color: 'subject-1', defaultRoom: 'homeroom' as const }
  const sci = { ...S(), name: 'Science', color: 'subject-2', defaultRoom: { roomTypeId: lab.id } }
  const T1 = { ...S(), name: 'Dana', maxWeeklyHours: 10, subjectIds: [math.id], dayOff: 2 as Weekday }
  const T2 = { ...S(), name: 'Yossi', maxWeeklyHours: 6, subjectIds: [sci.id], dayOff: 1 as Weekday }
  const C1 = { ...S(), grade: 7, parallel: 1, displayName: "ז׳1", homeroomRoomId: R1.id, homeroomTeacherId: T1.id }
  const C2 = { ...S(), grade: 7, parallel: 2, displayName: "ז׳2", homeroomRoomId: R2.id, homeroomTeacherId: null }
  const g = (subjectId: string, t: string, c: string, weeklyHours: number, doubles = 0) =>
    ({ ...S(), subjectId, teacherIds: [t], classIds: [c], weeklyHours, doubles, clusterId: null, level: null })
  const gMath1 = g(math.id, T1.id, C1.id, 3)
  const gSci = g(sci.id, T2.id, C1.id, 2, 1)
  const gMath2 = g(math.id, T1.id, C2.id, 2)
  return {
    school, roomTypes: [classroom, lab], rooms: [R1, R2, LAB], subjects: [math, sci],
    teachers: [T1, T2], classes: [C1, C2], groups: [gMath1, gSci, gMath2], blocks: [], clusters: [],
    ids: {
      classroom: classroom.id, lab: lab.id, R1: R1.id, R2: R2.id, LAB: LAB.id, math: math.id, sci: sci.id,
      T1: T1.id, T2: T2.id, C1: C1.id, C2: C2.id, gMath1: gMath1.id, gSci: gSci.id, gMath2: gMath2.id,
    },
  }
}

/** Slot id of lesson period `index` on `day`. */
export function slotId(d: SchoolSnapshot, day: Weekday, index: number): string {
  const bsId = d.school.week.dayBellSchedule[day]
  const bs = d.school.week.bellSchedules.find((b) => b.id === bsId)!
  return bs.slots.find((s) => s.type === 'lesson' && s.index === index)!.id
}

export function lesson(d: SchoolSnapshot, groupId: string, day: Weekday, periods: number[], roomIds: string[]): Lesson {
  return { studyGroupId: groupId, day, slotIds: periods.map((p) => slotId(d, day, p)), roomIds, pinned: false }
}

/** A valid complete timetable for tinySchool(). */
export function validTinyTimetable(d: ReturnType<typeof tinySchool>): Lesson[] {
  const { ids } = d
  return [
    lesson(d, ids.gMath1, 0, [1], [ids.R1]),
    lesson(d, ids.gMath1, 0, [2], [ids.R1]),
    lesson(d, ids.gMath1, 1, [1], [ids.R1]),
    lesson(d, ids.gSci, 0, [3, 4], [ids.LAB]),
    lesson(d, ids.gMath2, 0, [3], [ids.R2]),
    lesson(d, ids.gMath2, 1, [2], [ids.R2]),
  ]
}
