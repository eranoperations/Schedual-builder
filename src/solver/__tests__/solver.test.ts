import { describe, expect, it } from 'vitest'
import { scoped } from '../../model/defaults'
import { largeSampleSchoolProject, sampleSchoolProject } from '../../model/sample'
import type { SchoolSnapshot } from '../../model/types'
import { isValidDouble } from '../../model/week'
import { softScore } from '../quality'
import { solve, solveAsync } from '../solver'
import { slotId, tinySchool } from '../../test/fixtures'
import { verifyTimetable } from '../verify'

const FAST = { timeLimitMs: 20000, optimizeIterations: 60000 }

describe('solver', () => {
  it('solves the demo school with zero hard violations', () => {
    const d = sampleSchoolProject()
    const r = solve(d, { seed: 1, ...FAST })
    const v = verifyTimetable(d, r.lessons)
    expect(v.hardViolations).toEqual([])
    expect(r.status).toBe('complete')
    expect(r.unplaced).toEqual([])
    expect(r.stats.placedHours).toBe(r.stats.totalHours)
    expect(r.stats.totalHours).toBe(321)
  })

  it('the optimiser objective equals the independent soft score', () => {
    const d = sampleSchoolProject()
    const r = solve(d, { seed: 3, ...FAST })
    expect(softScore(d, r.lessons).total).toBeCloseTo(r.stats.finalSoftScore, 6)
    expect(r.stats.finalSoftScore).toBeLessThanOrEqual(r.stats.initialSoftScore)
  })

  it('is deterministic for a given seed', () => {
    const d = sampleSchoolProject()
    const a = solve(d, { seed: 42, ...FAST })
    const b = solve(d, { seed: 42, ...FAST })
    expect(a.lessons).toEqual(b.lessons)
  })

  it('places doubles on joinable pairs and assigns rooms in the same step', () => {
    const d = tinySchool()
    const r = solve(d, { seed: 1, ...FAST })
    expect(verifyTimetable(d, r.lessons).hardViolations).toEqual([])
    const sci = r.lessons.filter((l) => l.studyGroupId === d.ids.gSci)
    expect(sci).toHaveLength(1)
    expect(sci[0].slotIds).toHaveLength(2)
    expect(isValidDouble(d.school.week, sci[0].day, sci[0].slotIds[0], sci[0].slotIds[1])).toBe(true)
    expect(sci[0].roomIds).toEqual([d.ids.LAB])
  })

  it('handles multi-class / multi-teacher groups (arrays) and "none" rooms', () => {
    const d = tinySchool()
    const { ids } = d
    d.teachers.push({ ...scoped(d.school.id), name: 'Co', maxWeeklyHours: 5, subjectIds: [ids.math], dayOff: 1 })
    d.groups.push({ ...scoped(d.school.id), subjectId: ids.math, teacherIds: [ids.T1, d.teachers[2].id], classIds: [ids.C1, ids.C2], weeklyHours: 2, doubles: 0 })
    d.groups.push({ ...scoped(d.school.id), subjectId: ids.math, teacherIds: [d.teachers[2].id], classIds: [ids.C2], weeklyHours: 1, doubles: 0, room: 'none' })
    const r = solve(d, { seed: 2, ...FAST })
    expect(verifyTimetable(d, r.lessons).hardViolations).toEqual([])
    expect(r.status).toBe('complete')
    const joint = r.lessons.filter((l) => l.studyGroupId === d.groups[3].id)
    expect(joint.every((l) => l.roomIds.length === 2 && new Set(l.roomIds).size === 2)).toBe(true)
    expect(r.lessons.filter((l) => l.studyGroupId === d.groups[4].id).every((l) => l.roomIds.length === 0)).toBe(true)
  })

  it('respects hard blocks, day off and daily caps under pressure', () => {
    const d = tinySchool()
    d.school.rules = { maxTeacherDailyHours: 3 }
    d.blocks = [{ ...scoped(d.school.id), target: { type: 'room', id: d.ids.R1 }, when: [{ day: 0 }], hardness: 'hard' }]
    const r = solve(d, { seed: 5, ...FAST })
    expect(verifyTimetable(d, r.lessons).hardViolations).toEqual([])
    expect(r.status).toBe('complete')
    expect(r.lessons.some((l) => l.day === 0 && l.roomIds.includes(d.ids.R1))).toBe(false)
  })

  it('reports proven infeasibility with plain-language reasons and no timetable', () => {
    const d = tinySchool()
    d.school.rules = { maxTeacherDailyHours: 2 } // Dana: 5 hours, 2 working days × 2 = 4
    const r = solve(d, { seed: 1, ...FAST, timeLimitMs: 3000 })
    expect(r.status).toBe('infeasible')
    expect(r.reasons.map((i) => i.code)).toContain('E_TEACHER_DAILY_CAPACITY')
    // Blocking errors short-circuit the search: no lessons, no unplaced diagnosis.
    expect(r.lessons).toEqual([])
    expect(r.stats.placementAttempts).toBe(0)
  })

  it('distinguishes "not found in time" (incomplete) from impossible', () => {
    const d = sampleSchoolProject()
    const r = solve(d, { seed: 1, timeLimitMs: 100, optimizeIterations: 0, maxAttempts: 1 }, {})
    expect(['complete', 'incomplete']).toContain(r.status)
    expect(r.reasons).toEqual([])
    expect(verifyTimetable(d, r.lessons).hardViolations.filter((i) => i.code !== 'V_GROUP_HOURS' && i.code !== 'V_GROUP_DOUBLES')).toEqual([])
  })

  it('can be cancelled and still returns a hard-valid partial result', async () => {
    const d = sampleSchoolProject()
    let polls = 0
    const r = await solveAsync(d, { seed: 1, ...FAST }, { shouldCancel: () => ++polls > 3 }, 1)
    expect(r.status === 'cancelled' || r.status === 'complete').toBe(true)
    expect(verifyTimetable(d, r.lessons).hardViolations.filter((i) => i.code !== 'V_GROUP_HOURS' && i.code !== 'V_GROUP_DOUBLES')).toEqual([])
  })

  it('enabling a preference measurably improves its metric (avoidTeacherGaps, spreadSubjects)', () => {
    const d = sampleSchoolProject()
    const on = solve(d, { seed: 7, ...FAST })
    const off: SchoolSnapshot = { ...d, school: { ...d.school, preferences: { avoidTeacherGaps: false, spreadSubjects: false } } }
    const r2 = solve(off, { seed: 7, ...FAST })
    const m = (r: typeof on, k: string) => r.qualityReport.find((q) => q.key === k)!.count
    expect(m(on, 'avoidTeacherGaps')).toBeLessThan(m(r2, 'avoidTeacherGaps'))
    expect(m(on, 'spreadSubjects')).toBeLessThanOrEqual(m(r2, 'spreadSubjects'))
    expect(on.qualityReport.find((q) => q.key === 'avoidTeacherGaps')!.enabled).toBe(true)
    expect(r2.qualityReport.find((q) => q.key === 'avoidTeacherGaps')!.enabled).toBe(false)
  })

  it('respects soft blocks when the preference is on', () => {
    const d = tinySchool()
    d.blocks = [{ ...scoped(d.school.id), target: { type: 'teacher', id: d.ids.T1 }, when: [{ day: 0, slotIds: [slotId(d, 0, 1), slotId(d, 0, 2)] }], hardness: 'soft' }]
    const r = solve(d, { seed: 1, ...FAST })
    expect(r.qualityReport.find((q) => q.key === 'respectSoftBlocks')!.count).toBe(0)
  })

  it.each(['sunThu', 'sunFri'] as const)('solves the large demo (%s) with zero hard violations within the limit', (tpl) => {
    const d = largeSampleSchoolProject(tpl)
    expect(d.classes.length).toBe(24)
    expect(d.groups.length).toBeGreaterThanOrEqual(250)
    const r = solve(d, { seed: 1, timeLimitMs: 60000, optimizeIterations: 100000 })
    expect(verifyTimetable(d, r.lessons).hardViolations).toEqual([])
    expect(r.status).toBe('complete')
    expect(r.stats.elapsedMs).toBeLessThan(60000)
  })
})

describe('infeasible short-circuit (QA orphaned-friday)', () => {
  it('returns no lessons when a blocking validation error exists', () => {
    const d = sampleSchoolProject()
    d.teachers[0].dayOff = 5 // Friday is not a teaching day in sunThu → E_TEACHER_DAY_OFF_INVALID
    const r = solve(d, FAST)
    expect(r.status).toBe('infeasible')
    expect(r.reasons.some((i) => i.code === 'E_TEACHER_DAY_OFF_INVALID')).toBe(true)
    expect(r.lessons).toEqual([])
    expect(r.unplaced).toEqual([])
  })
})
