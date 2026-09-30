/** JSON project file (one school + all its records) — spec §2.2 / US-12. */
import { newId, nowIso } from '../model/ids'
import type { SchoolProject } from '../model/types'

export const SCHEMA_VERSION = 1
export const FILE_KIND = 'israeli-school-timetable/project'

export interface ProjectFile {
  kind: typeof FILE_KIND
  schemaVersion: number
  exportedAt: string
  project: SchoolProject
}

export function toProjectFile(project: SchoolProject): ProjectFile {
  return { kind: FILE_KIND, schemaVersion: SCHEMA_VERSION, exportedAt: nowIso(), project }
}

export function serializeProject(project: SchoolProject): string {
  return JSON.stringify(toProjectFile(project), null, 2)
}

export function projectFileName(project: SchoolProject): string {
  const safe = project.school.name.replace(/[\\/:*?"<>|]+/g, '').trim() || 'school'
  return `${safe}.timetable.json`
}

export type ParseResult = { ok: true; project: SchoolProject; schemaVersion: number } | { ok: false; error: string; params?: Record<string, string | number> }

const ARRAYS = ['roomTypes', 'rooms', 'subjects', 'teachers', 'classes', 'groups', 'blocks', 'clusters', 'timetables'] as const

/**
 * Parses and structurally validates a project file. Error `error` values are
 * i18n keys under `io.errors.*`. Accepts a bare SchoolProject too.
 */
export function parseProjectFile(text: string): ParseResult {
  let raw: unknown
  try { raw = JSON.parse(text) } catch { return { ok: false, error: 'notJson' } }
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'notProject' }
  const obj = raw as Record<string, unknown>
  const version = typeof obj.schemaVersion === 'number' ? obj.schemaVersion : SCHEMA_VERSION
  if (version > SCHEMA_VERSION) return { ok: false, error: 'newerVersion', params: { version, supported: SCHEMA_VERSION } }
  const p = (obj.project ?? obj) as Record<string, unknown>
  const school = p.school as Record<string, unknown> | undefined
  if (!school || typeof school.id !== 'string' || typeof school.name !== 'string' || !school.week) return { ok: false, error: 'notProject' }
  const project = { ...p } as Record<string, unknown>
  for (const k of ARRAYS) {
    if (project[k] === undefined) project[k] = []
    if (!Array.isArray(project[k])) return { ok: false, error: 'badField', params: { field: k } }
    for (const rec of project[k] as Record<string, unknown>[]) {
      if (!rec || typeof rec.id !== 'string') return { ok: false, error: 'badField', params: { field: k } }
      if (rec.schoolId !== school.id) return { ok: false, error: 'wrongSchool', params: { field: k } }
    }
  }
  return { ok: true, project: project as unknown as SchoolProject, schemaVersion: version }
}

/**
 * Deep copy with fresh UUIDs for the school and every record (references are
 * rewritten consistently). Used for "import as a copy" and "duplicate school".
 */
export function withNewIds(project: SchoolProject, newName?: string): SchoolProject {
  const ids = new Set<string>([project.school.id])
  const collect = (v: unknown) => {
    if (Array.isArray(v)) v.forEach(collect)
    else if (v && typeof v === 'object') {
      const o = v as Record<string, unknown>
      if (typeof o.id === 'string') ids.add(o.id)
      Object.values(o).forEach(collect)
    }
  }
  collect(project)
  const map = new Map([...ids].map((id) => [id, newId()]))
  const remap = (v: unknown): unknown => {
    if (typeof v === 'string') return map.get(v) ?? v
    if (Array.isArray(v)) return v.map(remap)
    if (v && typeof v === 'object') {
      const out: Record<string, unknown> = {}
      for (const [k, val] of Object.entries(v)) out[map.get(k) ?? k] = remap(val)
      return out
    }
    return v
  }
  const copy = remap(project) as SchoolProject
  if (newName) copy.school.name = newName
  return copy
}
