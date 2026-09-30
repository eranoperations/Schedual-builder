import { describe, expect, it } from 'vitest'
import { largeSampleSchoolProject, sampleSchoolProject } from '../../model/sample'
import { MemoryStore } from '../kv'
import { parseProjectFile, serializeProject, withNewIds, SCHEMA_VERSION } from '../projectFile'
import { KeyValueStoreRepository } from '../repository'

describe('SchoolRepository (memory store)', () => {
  it('saves, lists, loads and removes schools scoped by id', () => {
    const repo = new KeyValueStoreRepository(new MemoryStore())
    const a = sampleSchoolProject()
    const b = largeSampleSchoolProject('sunFri')
    repo.save(a)
    repo.save(b)
    expect(repo.listSchools().map((s) => s.id).sort()).toEqual([a.school.id, b.school.id].sort())
    expect(repo.load(a.school.id)).toEqual(a)
    repo.setActiveSchoolId(b.school.id)
    repo.remove(b.school.id)
    expect(repo.load(b.school.id)).toBeNull()
    expect(repo.getActiveSchoolId()).toBeNull()
    expect(repo.listSchools()).toHaveLength(1)
  })

  it('stores settings separately from school data', () => {
    const repo = new KeyValueStoreRepository(new MemoryStore())
    repo.set('lang', 'en')
    expect(repo.get('lang')).toBe('en')
    expect(repo.listSchools()).toEqual([])
  })
})

describe('project JSON file', () => {
  it('round-trips identically with schemaVersion, ids and reserved fields', () => {
    const p = sampleSchoolProject()
    p.groups[0].clusterId = null
    p.groups[0].level = 'A'
    const text = serializeProject(p)
    expect(JSON.parse(text).schemaVersion).toBe(SCHEMA_VERSION)
    const r = parseProjectFile(text)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.project).toEqual(p)
  })

  it('rejects bad input with an i18n error key', () => {
    expect(parseProjectFile('{nope')).toMatchObject({ ok: false, error: 'notJson' })
    expect(parseProjectFile('{"a":1}')).toMatchObject({ ok: false, error: 'notProject' })
    const p = sampleSchoolProject()
    expect(parseProjectFile(JSON.stringify({ schemaVersion: 99, project: p }))).toMatchObject({ ok: false, error: 'newerVersion' })
    const bad = structuredClone(p)
    bad.teachers[0].schoolId = 'other'
    expect(parseProjectFile(JSON.stringify({ schemaVersion: 1, project: bad }))).toMatchObject({ ok: false, error: 'wrongSchool' })
  })

  it('withNewIds rewrites every id and reference consistently', () => {
    const p = sampleSchoolProject()
    const c = withNewIds(p, 'Copy')
    expect(c.school.id).not.toBe(p.school.id)
    expect(c.school.name).toBe('Copy')
    expect(c.teachers.every((t) => t.schoolId === c.school.id)).toBe(true)
    const tIds = new Set(c.teachers.map((t) => t.id))
    expect(c.groups.every((g) => g.teacherIds.every((id) => tIds.has(id)))).toBe(true)
    const days = Object.values(c.school.week.dayBellSchedule)
    const bsIds = new Set(c.school.week.bellSchedules.map((b) => b.id))
    expect(days.every((id) => bsIds.has(id!))).toBe(true)
    expect(JSON.stringify(c)).not.toContain(p.teachers[0].id)
  })
})
