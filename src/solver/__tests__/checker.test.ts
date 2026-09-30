import { describe, expect, it } from 'vitest'
import { lesson, slotId, tinySchool, validTinyTimetable } from '../../test/fixtures'
import {
  canMove, checkClashes, checkDailyCap, checkDayOff, checkDoubles, checkGroupHours, checkHardBlocks,
  checkQualification, checkRooms, checkValidSlots, checkWeeklyCap, verifyTimetable,
} from '../verify'
import { scoped } from '../../model/defaults'

const codes = (issues: { code: string }[]) => issues.map((i) => i.code)

describe('hard-constraint checker', () => {
  it('accepts a valid timetable', () => {
    const d = tinySchool()
    const r = verifyTimetable(d, validTinyTimetable(d))
    expect(r.hardViolations).toEqual([])
    expect(r.ok).toBe(true)
  })

  it('1. clashes: class, teacher and room double-booking', () => {
    const d = tinySchool()
    const { ids } = d
    const ls = validTinyTimetable(d)
    // gMath2 moved onto Sun P1 in R1: teacher T1 and room R1 clash; class C2 is fine
    ls[4] = lesson(d, ids.gMath2, 0, [1], [ids.R1])
    const c = codes(checkClashes(d, ls))
    expect(c).toContain('V_TEACHER_CLASH')
    expect(c).toContain('V_ROOM_CLASH')
    expect(c).not.toContain('V_CLASS_CLASH')
    // science double over Sun P1–2 clashes with C1's math
    const ls2 = validTinyTimetable(d)
    ls2[3] = lesson(d, ids.gSci, 0, [1, 2], [ids.LAB])
    expect(codes(checkClashes(d, ls2))).toContain('V_CLASS_CLASH')
  })

  it('1b. a multi-class, multi-teacher lesson occupies all its teachers and classes', () => {
    const d = tinySchool()
    const { ids } = d
    const joint = { ...scoped(d.school.id), subjectId: ids.math, teacherIds: [ids.T1], classIds: [ids.C1, ids.C2], weeklyHours: 1, doubles: 0 }
    d.groups.push(joint)
    const ls = [...validTinyTimetable(d), lesson(d, joint.id, 1, [3], [ids.R1, ids.R2])]
    expect(codes(checkClashes(d, ls))).toEqual([])
    ls[ls.length - 1] = lesson(d, joint.id, 1, [2], [ids.R1, ids.R2]) // C2 has gMath2 at Mon P2
    const c = codes(checkClashes(d, ls))
    expect(c).toContain('V_CLASS_CLASH')
    expect(c).toContain('V_TEACHER_CLASH')
  })

  it('2. hours: exact weekly hours and number of doubles', () => {
    const d = tinySchool()
    const { ids } = d
    const ls = validTinyTimetable(d).slice(1)
    expect(codes(checkGroupHours(d, ls))).toContain('V_GROUP_HOURS')
    const ls2 = validTinyTimetable(d)
    ls2[3] = lesson(d, ids.gSci, 0, [3], [ids.LAB])
    ls2.push(lesson(d, ids.gSci, 0, [4], [ids.LAB]))
    const c = codes(checkGroupHours(d, ls2))
    expect(c).toContain('V_GROUP_DOUBLES')
    expect(c).not.toContain('V_GROUP_HOURS')
  })

  it('3. doubles: only on joinable consecutive pairs within the max length', () => {
    const d = tinySchool()
    const { ids } = d
    const ls = validTinyTimetable(d)
    ls[3] = lesson(d, ids.gSci, 0, [2, 3], [ids.LAB]) // P2–3 spans a break, not joinable
    expect(codes(checkDoubles(d, ls))).toEqual(['V_INVALID_DOUBLE'])
    d.school.rules = { maxJoinedLessonMinutes: 60 }
    expect(codes(checkDoubles(d, validTinyTimetable(d)))).toEqual(['V_INVALID_DOUBLE'])
  })

  it('4. valid slots: teaching days, lesson slots, zero hour', () => {
    const d = tinySchool()
    const { ids } = d
    const ls = validTinyTimetable(d)
    ls[0] = { ...ls[0], day: 4 }
    expect(codes(checkValidSlots(d, ls))).toContain('V_NOT_TEACHING_DAY')
    const breakId = d.school.week.bellSchedules[0].slots.find((s) => s.type === 'break')!.id
    const ls2 = validTinyTimetable(d)
    ls2[0] = { ...ls2[0], slotIds: [breakId] }
    expect(codes(checkValidSlots(d, ls2))).toContain('V_INVALID_SLOT')
    const bs = d.school.week.bellSchedules[0]
    bs.slots.unshift({ id: 'zero', index: 0, type: 'lesson', start: '07:15', end: '08:00', joinableWithNext: false })
    const ls3 = [...validTinyTimetable(d)]
    ls3[0] = { ...ls3[0], slotIds: ['zero'] }
    expect(codes(checkValidSlots(d, ls3))).toContain('V_ZERO_HOUR')
    d.school.rules = { allowZeroHour: true }
    expect(codes(checkValidSlots(d, ls3))).toEqual([])
    void ids
  })

  it('5. qualification', () => {
    const d = tinySchool()
    d.teachers[0].subjectIds = []
    expect(codes(checkQualification(d, validTinyTimetable(d)))).toContain('V_TEACHER_NOT_QUALIFIED')
  })

  it('6. day off', () => {
    const d = tinySchool()
    const { ids } = d
    const ls = validTinyTimetable(d)
    ls[2] = lesson(d, ids.gMath1, 2, [1], [ids.R1]) // T1 is off on Tuesday
    expect(codes(checkDayOff(d, ls))).toEqual(['V_TEACHER_DAY_OFF'])
  })

  it('7. weekly cap: at most X, fewer is allowed', () => {
    const d = tinySchool()
    expect(checkWeeklyCap(d, validTinyTimetable(d))).toEqual([])
    d.teachers[0].maxWeeklyHours = 4 // T1 teaches 5
    expect(codes(checkWeeklyCap(d, validTinyTimetable(d)))).toEqual(['V_TEACHER_WEEKLY_CAP'])
    d.teachers[0].maxWeeklyHours = 20
    const r = verifyTimetable(d, validTinyTimetable(d))
    expect(r.ok).toBe(true)
    expect(codes(r.info)).toContain('I_TEACHER_UNDER_MAX')
  })

  it('8. daily cap (school rule and personal override)', () => {
    const d = tinySchool()
    d.school.rules = { maxTeacherDailyHours: 2 }
    expect(codes(checkDailyCap(d, validTinyTimetable(d)))).toContain('V_TEACHER_DAILY_CAP') // T1: 3 on Sunday
    d.school.rules = {}
    d.teachers[0].maxDailyHours = 2
    expect(codes(checkDailyCap(d, validTinyTimetable(d)))).toContain('V_TEACHER_DAILY_CAP')
    d.teachers[0].maxDailyHours = 3
    expect(checkDailyCap(d, validTinyTimetable(d))).toEqual([])
  })

  it('9. rooms: homeroom, room type, specific room, none', () => {
    const d = tinySchool()
    const { ids } = d
    const ls = validTinyTimetable(d)
    ls[0] = lesson(d, ids.gMath1, 0, [1], [ids.R2]) // not C1's homeroom
    ls[3] = lesson(d, ids.gSci, 0, [3, 4], [ids.R1]) // not a lab
    expect(codes(checkRooms(d, ls))).toEqual(['V_ROOM_REQUIREMENT', 'V_ROOM_REQUIREMENT'])
    const ls2 = validTinyTimetable(d)
    ls2[1] = { ...ls2[1], roomIds: [] }
    expect(codes(checkRooms(d, ls2))).toEqual(['V_ROOM_COUNT'])
    d.groups[2].room = { roomId: ids.R1 }
    expect(codes(checkRooms(d, validTinyTimetable(d)))).toEqual(['V_ROOM_REQUIREMENT', 'V_ROOM_REQUIREMENT'])
    d.groups[2].room = 'none'
    expect(codes(checkRooms(d, validTinyTimetable(d)))).toContain('V_ROOM_NOT_EXPECTED')
  })

  it('10. hard blocks on teacher, class, room, grade and school; soft blocks are not violations', () => {
    for (const target of ['teacher', 'class', 'room', 'grade', 'school'] as const) {
      const d = tinySchool()
      const { ids } = d
      const id = { teacher: ids.T1, class: ids.C1, room: ids.R1, grade: '7', school: undefined }[target]
      d.blocks = [{ ...scoped(d.school.id), target: { type: target, ...(id ? { id } : {}) }, when: [{ day: 0, slotIds: [slotId(d, 0, 1)] }], hardness: 'hard' }]
      expect(codes(checkHardBlocks(d, validTinyTimetable(d)))).toContain('V_HARD_BLOCK')
      d.blocks[0].hardness = 'soft'
      expect(checkHardBlocks(d, validTinyTimetable(d))).toEqual([])
    }
    const d = tinySchool()
    d.blocks = [{ ...scoped(d.school.id), target: { type: 'teacher', id: d.ids.T2 }, when: [{ day: 0 }], hardness: 'hard' }]
    expect(codes(checkHardBlocks(d, validTinyTimetable(d)))).toEqual(['V_HARD_BLOCK']) // whole day
  })

  it('canMove reports only violations the move introduces', () => {
    const d = tinySchool()
    const { ids } = d
    const ls = validTinyTimetable(d)
    expect(canMove(d, ls, ls[2], 1, [slotId(d, 1, 3)]).ok).toBe(true)
    const bad = canMove(d, ls, ls[2], 2, [slotId(d, 2, 1)])
    expect(bad.ok).toBe(false)
    expect(codes(bad.violations)).toContain('V_TEACHER_DAY_OFF')
    expect(codes(canMove(d, ls, ls[4], 0, [slotId(d, 0, 1)], [ids.R2]).violations)).toContain('V_TEACHER_CLASH')
  })
})
