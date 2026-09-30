/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { nowIso } from '../model/ids'
import { sampleSchoolProject } from '../model/sample'
import type { EntityKind, SchoolProject } from '../model/types'
import { browserStore } from '../storage/kv'
import { KeyValueStoreRepository } from '../storage/repository'

export type Page =
  | 'home' | 'week' | 'rooms' | 'subjects' | 'teachers' | 'classes' | 'planning' | 'blocks'
  | 'validate' | 'generate' | 'timetable' | 'export' | 'settings'

export const repo = new KeyValueStoreRepository(browserStore())

/** First run: the demo middle school is created and becomes the active school. */
export function loadInitialProject(): SchoolProject {
  const id = repo.getActiveSchoolId()
  const p = id ? repo.load(id) : null
  if (p) return p
  const first = repo.listSchools()[0]
  const any = first ? repo.load(first.id) : null
  if (any) { repo.setActiveSchoolId(any.school.id); return any }
  const demo = sampleSchoolProject()
  repo.save(demo)
  repo.setActiveSchoolId(demo.school.id)
  return demo
}

export interface Focus { kind: EntityKind; id?: string }

interface StoreValue {
  project: SchoolProject
  /** Mutates a deep copy of the project and saves it (one undo step). */
  update: (fn: (draft: SchoolProject) => void) => void
  replace: (p: SchoolProject) => void
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
  saveState: 'saved' | 'saving' | 'failed'
  page: Page
  go: (page: Page, focus?: Focus) => void
  focus: Focus | null
}

const Ctx = createContext<StoreValue | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [project, setProject] = useState<SchoolProject>(loadInitialProject)
  const [past, setPast] = useState<SchoolProject[]>([])
  const [future, setFuture] = useState<SchoolProject[]>([])
  const [saveState, setSaveState] = useState<StoreValue['saveState']>('saved')
  const [page, setPage] = useState<Page>('home')
  const [focus, setFocus] = useState<Focus | null>(null)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => {
    setSaveState('saving')
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      try { repo.save(project); repo.setActiveSchoolId(project.school.id); setSaveState('saved') } catch { setSaveState('failed') }
    }, 400)
    return () => window.clearTimeout(timer.current)
  }, [project])

  const update = useCallback((fn: (d: SchoolProject) => void) => {
    setProject((cur) => {
      const next = structuredClone(cur)
      fn(next)
      next.school.updatedAt = nowIso()
      setPast((p) => [...p.slice(-99), cur])
      setFuture([])
      return next
    })
  }, [])
  const replace = useCallback((p: SchoolProject) => { setPast([]); setFuture([]); setProject(p) }, [])
  const undo = useCallback(() => {
    setPast((p) => {
      if (!p.length) return p
      const prev = p[p.length - 1]
      setProject((cur) => { setFuture((f) => [cur, ...f]); return prev })
      return p.slice(0, -1)
    })
  }, [])
  const redo = useCallback(() => {
    setFuture((f) => {
      if (!f.length) return f
      const [next, ...rest] = f
      setProject((cur) => { setPast((p) => [...p, cur]); return next })
      return rest
    })
  }, [])
  const go = useCallback((pg: Page, fc?: Focus) => { setPage(pg); setFocus(fc ?? null); window.scrollTo(0, 0) }, [])

  const value = useMemo<StoreValue>(() => ({
    project, update, replace, undo, redo, canUndo: past.length > 0, canRedo: future.length > 0, saveState, page, go, focus,
  }), [project, update, replace, undo, redo, past.length, future.length, saveState, page, go, focus])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useStore(): StoreValue {
  const v = useContext(Ctx)
  if (!v) throw new Error('StoreProvider missing')
  return v
}

/** Setup page for an Issue reference (validation "Fix" links). */
export function pageForRef(kind: EntityKind | undefined): Page {
  switch (kind) {
    case 'week': return 'week'
    case 'rules': return 'blocks'
    case 'roomType': case 'room': return 'rooms'
    case 'subject': return 'planning'
    case 'teacher': return 'teachers'
    case 'class': return 'classes'
    case 'group': return 'planning'
    case 'block': return 'blocks'
    default: return 'settings'
  }
}
