/**
 * Storage seam (spec §2.2): every read/write goes through `SchoolRepository`,
 * scoped by schoolId. MVP implementation: `KeyValueStoreRepository` over
 * localStorage (or memory in tests). A cloud implementation can replace it.
 */
import { nowIso } from '../model/ids'
import type { SchoolProject } from '../model/types'
import type { KeyValueStore } from './kv'
import { SCHEMA_VERSION } from './projectFile'

export interface SchoolSummary {
  id: string
  name: string
  updatedAt: string
}

export interface SchoolRepository {
  listSchools(): SchoolSummary[]
  load(schoolId: string): SchoolProject | null
  /** Creates or replaces the school's record set. */
  save(project: SchoolProject): void
  remove(schoolId: string): void
  getActiveSchoolId(): string | null
  setActiveSchoolId(schoolId: string | null): void
}

/** Small app-level settings (UI language etc.), not school data. */
export interface SettingsRepository {
  get(key: string): string | null
  set(key: string, value: string): void
}

const PREFIX = 'tt:v1:'
const INDEX = `${PREFIX}schools`
const ACTIVE = `${PREFIX}activeSchool`
const schoolKey = (id: string) => `${PREFIX}school:${id}`

interface Stored { schemaVersion: number; project: SchoolProject }

export class KeyValueStoreRepository implements SchoolRepository, SettingsRepository {
  private readonly store: KeyValueStore
  constructor(store: KeyValueStore) { this.store = store }

  private readIndex(): SchoolSummary[] {
    try {
      const v = JSON.parse(this.store.get(INDEX) ?? '[]')
      return Array.isArray(v) ? v : []
    } catch {
      return []
    }
  }

  private writeIndex(list: SchoolSummary[]) { this.store.set(INDEX, JSON.stringify(list)) }

  listSchools(): SchoolSummary[] {
    return this.readIndex().sort((a, b) => a.name.localeCompare(b.name, 'he'))
  }

  load(schoolId: string): SchoolProject | null {
    const raw = this.store.get(schoolKey(schoolId))
    if (!raw) return null
    try {
      const s = JSON.parse(raw) as Stored
      return s.project ?? null
    } catch {
      return null
    }
  }

  save(project: SchoolProject): void {
    const id = project.school.id
    const stored: Stored = { schemaVersion: SCHEMA_VERSION, project }
    this.store.set(schoolKey(id), JSON.stringify(stored))
    const list = this.readIndex().filter((s) => s.id !== id)
    list.push({ id, name: project.school.name, updatedAt: project.school.updatedAt || nowIso() })
    this.writeIndex(list)
  }

  remove(schoolId: string): void {
    this.store.remove(schoolKey(schoolId))
    this.writeIndex(this.readIndex().filter((s) => s.id !== schoolId))
    if (this.getActiveSchoolId() === schoolId) this.setActiveSchoolId(null)
  }

  getActiveSchoolId(): string | null { return this.store.get(ACTIVE) }

  setActiveSchoolId(schoolId: string | null): void {
    if (schoolId) this.store.set(ACTIVE, schoolId)
    else this.store.remove(ACTIVE)
  }

  get(key: string): string | null { return this.store.get(`${PREFIX}setting:${key}`) }
  set(key: string, value: string): void { this.store.set(`${PREFIX}setting:${key}`, value) }
}
