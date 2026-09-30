import { describe, expect, it } from 'vitest'
import { scoped } from '../../model/defaults'
import { sampleSchoolProject } from '../../model/sample'
import { slotId, tinySchool } from '../../test/fixtures'
import { validate } from '../validate'

const errors = (d: Parameters<typeof validate>[0]) => validate(d).filter((i) => i.severity === 'error')
const codes = (d: Parameters<typeof validate>[0]) => errors(d).map((i) => i.code)

describe('pre-solve validation', () => {
  it('the tiny school and the demo school have no blocking errors', () => {
    expect(errors(tinySchool())).toEqual([])
    expect(errors(sampleSchoolProject())).toEqual([])
  })

  it('group whose teacher is not qualified', () => {
    const d = tinySchool()
    d.teachers[0].subjectIds = [d.ids.sci]
    const e = errors(d).find((i) => i.code === 'E_GROUP_TEACHER_NOT_QUALIFIED')!
    expect(e.params.teacher).toBe('Dana')
    expect(e.params.subject).toBe('Math')
    expect(e.ref).toEqual({ kind: 'group', id: d.ids.gMath1 })
  })

  it('class hours greater than its available lesson slots', () => {
    const d = tinySchool()
    d.groups[0].weeklyHours = 11 // C1: 11 + 2 = 13 > 12 slots
    const e = errors(d).find((i) => i.code === 'E_CLASS_OVER_SLOTS')!
    expect(e.params).toMatchObject({ class: "ז׳1", hours: 13, slots: 12 })
  })

  it('teacher hours greater than X', () => {
    const d = tinySchool()
    d.teachers[0].maxWeeklyHours = 4
    expect(errors(d).find((i) => i.code === 'E_TEACHER_OVER_X')!.params).toMatchObject({ teacher: 'Dana', hours: 5, max: 4 })
  })

  it('teacher hours greater than daily cap × working days (the "Dana: 26 hours but 4 × 6 = 24" case)', () => {
    const d = tinySchool()
    d.school.rules = { maxTeacherDailyHours: 2 } // T1 works Sun+Mon: 2 × 2 = 4 < 5
    expect(errors(d).find((i) => i.code === 'E_TEACHER_DAILY_CAPACITY')!.params).toMatchObject({ teacher: 'Dana', hours: 5, days: 2, perDay: 2, capacity: 4 })
  })

  it('teacher hours greater than the unblocked slots on working days', () => {
    const d = tinySchool()
    d.blocks = [{ ...scoped(d.school.id), target: { type: 'teacher', id: d.ids.T1 }, when: [{ day: 0 }, { day: 1, slotIds: [slotId(d, 1, 1), slotId(d, 1, 2)] }], hardness: 'hard' }]
    expect(codes(d)).toContain('E_TEACHER_SLOT_CAPACITY')
  })

  it('room requirement with no matching room', () => {
    const d = tinySchool()
    d.rooms = d.rooms.filter((r) => r.id !== d.ids.LAB)
    expect(errors(d).find((i) => i.code === 'E_GROUP_NO_MATCHING_ROOM')!.params.subject).toBe('Science')
  })

  it('class missing a homeroom', () => {
    const d = tinySchool()
    d.classes[1].homeroomRoomId = null
    expect(errors(d).find((i) => i.code === 'E_CLASS_NO_HOMEROOM')!.params.class).toBe("ז׳2")
  })

  it('doubles required but no joinable pair on the teacher\'s working days', () => {
    const d = tinySchool()
    for (const s of d.school.week.bellSchedules[0].slots) s.joinableWithNext = false
    expect(codes(d)).toContain('E_GROUP_NO_JOINABLE_PAIR')
  })

  it('day off pointing to a removed day is an error; block on a removed day/slot is flagged', () => {
    const d = tinySchool()
    d.school.week.days = [0, 1] // Tuesday removed: T1's day off
    d.blocks = [{ ...scoped(d.school.id), target: { type: 'room', id: d.ids.R1 }, when: [{ day: 2 }, { day: 0, slotIds: ['gone'] }], hardness: 'hard' }]
    const all = validate(d)
    expect(all.find((i) => i.code === 'E_TEACHER_DAY_OFF_INVALID')!.params).toMatchObject({ teacher: 'Dana', day: 2 })
    expect(all.map((i) => i.code)).toEqual(expect.arrayContaining(['W_BLOCK_REMOVED_DAY', 'W_BLOCK_REMOVED_SLOT']))
  })

  it('doubles × 2 exceeding weekly hours, invalid X, teacher without subjects', () => {
    const d = tinySchool()
    d.groups[1].doubles = 2
    d.teachers[1].maxWeeklyHours = 0
    d.teachers[1].subjectIds = []
    expect(codes(d)).toEqual(expect.arrayContaining(['E_GROUP_DOUBLES_INVALID', 'E_TEACHER_HOURS_INVALID', 'E_TEACHER_NO_SUBJECTS']))
  })

  it('room-type capacity exceeded', () => {
    const d = tinySchool()
    d.groups[1].weeklyHours = 13
    d.groups[1].doubles = 0
    expect(codes(d)).toContain('E_ROOM_TYPE_CAPACITY')
  })

  it('under-X teachers are informational only', () => {
    const d = tinySchool()
    const all = validate(d)
    expect(all.filter((i) => i.code === 'I_TEACHER_UNDER_X').every((i) => i.severity === 'info')).toBe(true)
  })

  it('invalid bell schedule is reported', () => {
    const d = tinySchool()
    d.school.week.bellSchedules[0].slots[1].start = '07:00'
    expect(codes(d)).toContain('E_BELL_OVERLAP')
  })
})
