import type { SchoolSnapshot } from './types'

/** Stable FNV-1a hash of the solver-relevant input (flags a stale timetable). */
export function fingerprint(d: SchoolSnapshot): string {
  const json = JSON.stringify([
    d.school.week, d.school.rules, d.school.preferences,
    d.rooms.map((r) => [r.id, r.roomTypeId]),
    d.subjects.map((s) => [s.id, s.defaultRoom]),
    d.teachers.map((t) => [t.id, t.maxWeeklyHours, t.maxDailyHours, t.subjectIds, t.dayOff]),
    d.classes.map((c) => [c.id, c.grade, c.homeroomRoomId]),
    d.groups.map((g) => [g.id, g.subjectId, g.teacherIds, g.classIds, g.weeklyHours, g.doubles, g.room]),
    d.blocks.map((b) => [b.target, b.when, b.hardness]),
  ])
  let h = 0x811c9dc5
  for (let i = 0; i < json.length; i++) {
    h ^= json.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}
