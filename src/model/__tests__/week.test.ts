import { describe, expect, it } from 'vitest'
import { resolveRules } from '../rules'
import {
  DEFAULT_PATTERN, deriveDays, generateSlots, isValidDouble, lessonSlots, validateBellSchedule, validateWeek, weekFromTemplate, weeklyLessonSlots,
} from '../week'
import type { BellSchedule } from '../types'

describe('bell schedules', () => {
  it('default template yields exactly 8 periods ending 14:45 with 3 breaks', () => {
    const slots = generateSlots(DEFAULT_PATTERN)
    const lessons = slots.filter((s) => s.type === 'lesson')
    expect(lessons.map((s) => s.index)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    expect(lessons[0].start).toBe('08:00')
    expect(lessons[7].end).toBe('14:45')
    expect(slots.filter((s) => s.type === 'break').map((s) => [s.index, s.start, s.end])).toEqual([
      [2, '09:30', '09:50'], [4, '11:20', '11:35'], [6, '13:05', '13:15'],
    ])
  })

  it('default template marks P1–2, P3–4, P5–6, P7–8 joinable', () => {
    const joinable = generateSlots(DEFAULT_PATTERN).filter((s) => s.joinableWithNext).map((s) => s.index)
    expect(joinable).toEqual([1, 3, 5, 7])
  })

  it('Sun–Thu template: 5 days × 8 = 40 lesson slots', () => {
    const w = weekFromTemplate('sunThu')
    expect(w.days).toEqual([0, 1, 2, 3, 4])
    expect(weeklyLessonSlots(w)).toBe(40)
  })

  it('Sun–Fri template: short Friday P1–P5 ending 12:20', () => {
    const w = weekFromTemplate('sunFri')
    expect(w.days).toEqual([0, 1, 2, 3, 4, 5])
    const fri = lessonSlots(w, 5)
    expect(fri.map((s) => s.index)).toEqual([1, 2, 3, 4, 5])
    expect(fri[4].end).toBe('12:20')
    expect(weeklyLessonSlots(w)).toBe(45)
    expect(deriveDays(w).map((d) => d.lessonSlots.length)).toEqual([8, 8, 8, 8, 8, 5])
  })

  it('zero hour is only usable when allowed', () => {
    const w = weekFromTemplate('sunThu')
    w.bellSchedules[0].slots = generateSlots({ ...DEFAULT_PATTERN, zeroHour: true })
    expect(lessonSlots(w, 0).length).toBe(8)
    expect(lessonSlots(w, 0, { allowZeroHour: true }).length).toBe(9)
    expect(lessonSlots(w, 0, { allowZeroHour: true })[0].index).toBe(0)
  })

  it('validates doubles: joinable, consecutive, within max length', () => {
    const w = weekFromTemplate('sunThu')
    const ls = lessonSlots(w, 0)
    expect(isValidDouble(w, 0, ls[0].id, ls[1].id)).toBe(true) // P1–2
    expect(isValidDouble(w, 0, ls[1].id, ls[2].id)).toBe(false) // P2–3 not joinable
    expect(isValidDouble(w, 0, ls[0].id, ls[2].id)).toBe(false) // not consecutive
    expect(isValidDouble(w, 0, ls[0].id, ls[1].id, { maxJoinedLessonMinutes: 80 })).toBe(false) // 90 min > 80
  })

  it('flags overlapping, reversed and too-long joined slots', () => {
    const bs: BellSchedule = {
      id: 'b', name: 'X', slots: [
        { id: 'a', index: 1, type: 'lesson', start: '08:00', end: '08:45', joinableWithNext: true },
        { id: 'b', index: 2, type: 'lesson', start: '08:40', end: '09:25', joinableWithNext: false },
        { id: 'c', index: 3, type: 'lesson', start: '10:00', end: '09:50', joinableWithNext: false },
      ],
    }
    const codes = validateBellSchedule(bs).map((i) => i.code)
    expect(codes).toContain('E_BELL_OVERLAP')
    expect(codes).toContain('E_BELL_END_BEFORE_START')
    const bs2: BellSchedule = {
      id: 'b2', name: 'Y', slots: [
        { id: 'a', index: 1, type: 'lesson', start: '08:00', end: '08:50', joinableWithNext: true },
        { id: 'k', index: 1, type: 'break', start: '08:50', end: '09:10', joinableWithNext: false },
        { id: 'b', index: 2, type: 'lesson', start: '09:10', end: '10:00', joinableWithNext: false },
      ],
    }
    expect(validateBellSchedule(bs2).map((i) => i.code)).toContain('E_BELL_JOIN_TOO_LONG')
    expect(validateBellSchedule(bs2, { maxJoinedLessonMinutes: 120 })).toEqual([])
  })

  it('flags a teaching day without lesson slots or schedule', () => {
    const w = weekFromTemplate('sunThu')
    w.days = [0, 1, 2, 3, 4, 6]
    expect(validateWeek(w).map((i) => i.code)).toContain('E_WEEK_DAY_NO_SCHEDULE')
    const w2 = weekFromTemplate('sunThu')
    w2.bellSchedules[0].slots = w2.bellSchedules[0].slots.filter((s) => s.type === 'break')
    expect(validateWeek(w2).map((i) => i.code)).toContain('E_BELL_NO_LESSON_SLOTS')
    expect(validateWeek({ ...w2, days: [] }).map((i) => i.code)).toContain('E_WEEK_NO_DAYS')
  })

  it('rules default when keys are missing', () => {
    expect(resolveRules({})).toEqual({ maxTeacherDailyHours: 6, maxJoinedLessonMinutes: 100, allowZeroHour: false })
    expect(resolveRules({ maxTeacherDailyHours: 7 }).maxTeacherDailyHours).toBe(7)
  })
})
