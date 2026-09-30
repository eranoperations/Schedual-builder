import { describe, expect, it } from 'vitest'
import { scoped } from '../../model/defaults'
import { sampleSchoolProject } from '../../model/sample'
import { tinySchool } from '../../test/fixtures'
import { solve, validate, verifyTimetable } from '..'

const FAST = { optimizeIterations: 2000, timeLimitMs: 20000 }

describe('auto teacher assignment (v0.5.1)', () => {
  it('assigns one qualified teacher per auto group and the checker accepts it', () => {
    const d = tinySchool()
    const T3 = { ...scoped(d.school.id), name: 'Rina', maxWeeklyHours: 4, subjectIds: [d.ids.math], dayOff: 1 as const }
    d.teachers.push(T3)
    d.groups.find((g) => g.id === d.ids.gMath2)!.teacherIds = []
    const r = solve(d, { seed: 1, ...FAST })
    expect(r.status).toBe('complete')
    const assigned = r.teacherAssignments[d.ids.gMath2]
    expect(assigned).toHaveLength(1)
    expect([d.ids.T1, T3.id]).toContain(assigned[0])
    expect(r.teacherAssignments[d.ids.gMath1]).toEqual([d.ids.T1]) // fixed never changes
    const ls = r.lessons.filter((l) => l.studyGroupId === d.ids.gMath2)
    expect(ls.every((l) => l.teacherIds?.[0] === assigned[0])).toBe(true)
    expect(verifyTimetable(d, r.lessons).hardViolations).toEqual([])
  })

  it('respects X of the candidate: picks the teacher with capacity', () => {
    const d = tinySchool()
    d.teachers.find((t) => t.id === d.ids.T1)!.maxWeeklyHours = 3 // T1 is full with gMath1
    const T3 = { ...scoped(d.school.id), name: 'Rina', maxWeeklyHours: 4, subjectIds: [d.ids.math], dayOff: 1 as const }
    d.teachers.push(T3)
    d.groups.find((g) => g.id === d.ids.gMath2)!.teacherIds = []
    const r = solve(d, { seed: 1, ...FAST })
    expect(r.status).toBe('complete')
    expect(r.teacherAssignments[d.ids.gMath2]).toEqual([T3.id])
  })

  it('validator: auto group with no qualified teacher', () => {
    const d = tinySchool()
    const art = { ...scoped(d.school.id), name: 'Art', color: 'subject-3', defaultRoom: 'homeroom' as const }
    d.subjects.push(art)
    d.groups.push({ ...scoped(d.school.id), subjectId: art.id, teacherIds: [], classIds: [d.ids.C2], weeklyHours: 1, doubles: 0 })
    const codes = validate(d).filter((i) => i.severity === 'error').map((i) => i.code)
    expect(codes).toContain('E_GROUP_NO_QUALIFIED_TEACHER')
    expect(solve(d, { seed: 1, ...FAST }).status).toBe('infeasible')
  })

  it('validator: subject auto hours over the free capacity of its teachers', () => {
    const d = tinySchool()
    d.groups.find((g) => g.id === d.ids.gMath2)!.teacherIds = []
    d.teachers.find((t) => t.id === d.ids.T1)!.maxWeeklyHours = 4 // 3 fixed → 1 free < 2 auto
    const e = validate(d).find((i) => i.code === 'E_SUBJECT_AUTO_CAPACITY')!
    expect(e.params).toMatchObject({ subject: 'Math', hours: 2, free: 1 })
  })

  it('validator: overall assignment flow detects shared-teacher shortfall', () => {
    // Two subjects share teacher T1; each subject alone fits, together they don't.
    const d = tinySchool()
    d.teachers.find((t) => t.id === d.ids.T1)!.subjectIds.push(d.ids.sci)
    d.teachers.find((t) => t.id === d.ids.T1)!.maxWeeklyHours = 5 // 3 fixed (gMath1) → 2 free
    d.teachers.find((t) => t.id === d.ids.T2)!.maxWeeklyHours = 1 // sci: 1 free on T2
    d.groups.find((g) => g.id === d.ids.gMath2)!.teacherIds = [] // 2 h math: T1 only (2 free) ok
    d.groups.find((g) => g.id === d.ids.gSci)!.teacherIds = [] // 2 h sci: T1 (2) + T2 (1) = 3 ≥ 2 ok
    const codes = validate(d).filter((i) => i.severity === 'error').map((i) => i.code)
    expect(codes).not.toContain('E_SUBJECT_AUTO_CAPACITY')
    expect(codes).toContain('E_AUTO_ASSIGNMENT_INFEASIBLE') // 4 h needed, only 3 assignable
  })

  it('sample school mixes fixed and auto groups and solves completely', () => {
    const p = sampleSchoolProject()
    const auto = p.groups.filter((g) => !g.teacherIds.length)
    expect(auto.length).toBeGreaterThan(0)
    expect(auto.length).toBeLessThan(p.groups.length)
    const r = solve(p, { seed: 1, optimizeIterations: 20000 })
    expect(r.status).toBe('complete')
    for (const g of auto) expect(r.teacherAssignments[g.id]).toHaveLength(1)
    expect(verifyTimetable(p, r.lessons).hardViolations).toEqual([])
  })

  it('checker rejects inconsistent or changed teachers', () => {
    const d = tinySchool()
    d.groups.find((g) => g.id === d.ids.gMath2)!.teacherIds = []
    const r = solve(d, { seed: 1, ...FAST })
    const ls = r.lessons.map((l) => ({ ...l }))
    const i = ls.findIndex((l) => l.studyGroupId === d.ids.gMath1)
    ls[i] = { ...ls[i], teacherIds: [d.ids.T2] }
    const codes = verifyTimetable(d, ls).hardViolations.map((v) => v.code)
    expect(codes).toContain('V_FIXED_TEACHER_CHANGED')
    expect(codes).toContain('V_GROUP_TEACHER_INCONSISTENT')
  })
})
