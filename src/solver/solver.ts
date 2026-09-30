/**
 * Solver entry point — a pure function of a SchoolSnapshot (no DOM, no
 * storage). Runs in the Web Worker, in Node and in Vitest.
 *
 *   solve(snapshot, options?, hooks?)       synchronous
 *   solveAsync(snapshot, options?, hooks?)  time-sliced (lets a worker receive "cancel")
 *   solveSteps(...)                         generator form (progress via yield)
 *
 * Pipeline: validate (infeasibility explanations) → compile → place sessions
 * (MRV backtracking + forward checking, restarts; rooms assigned in the same
 * step) → simulated annealing on soft preferences → diagnose leftovers.
 * Every returned lesson satisfies all hard constraints (§3.1).
 */
import { defaultSolverOptions } from '../model/defaults'
import { fingerprint } from '../model/fingerprint'
import type { Issue, Lesson, SchoolSnapshot, SolveResult, SolverOptions, UnplacedLesson } from '../model/types'
import { Board, buildSessions } from './board'
import { compile, type Compiled } from './compile'
import { nameLookup } from './names'
import { applyAssignment, greedyAssign, reassignForConflicts } from './assign'
import { optimize, type OptimizeResult } from './optimize'
import { placeSessions } from './place'
import { qualityReport } from './quality'
import { createRng, subSeed } from './rng'
import { validate } from './validate'

export type SolvePhase = 'validate' | 'place' | 'optimize' | 'done'

export interface SolveProgress {
  phase: SolvePhase
  /** 0..100 overall */
  percent: number
  placed?: number
  total?: number
  attempt?: number
  iteration?: number
  iterations?: number
  score?: number
  pending?: number
}

export interface SolveHooks {
  onProgress?: (p: SolveProgress) => void
  /** Polled regularly; return true to stop and get the best result so far. */
  shouldCancel?: () => boolean
}

function luby(i: number): number {
  let k = 1
  while ((1 << k) - 1 < i) k++
  if ((1 << k) - 1 === i) return 1 << (k - 1)
  return luby(i - (1 << (k - 1)) + 1)
}

/** Converts board session state to model lessons. */
export function toLessons(cp: Compiled, board: Board, starts: Int32Array, rooms: number[][]): Lesson[] {
  const out: Lesson[] = []
  for (let i = 0; i < board.size; i++) {
    const s = starts[i]
    if (s < 0) continue
    const g = cp.groups[board.sg[i]]
    const s2 = board.second(board.slen[i], s)
    out.push({
      studyGroupId: g.id,
      teacherIds: g.teachers.map((t) => cp.data.teachers[t].id),
      day: cp.slots.days[cp.slots.slotDay[s]],
      slotIds: board.slen[i] === 2 ? [cp.slots.slot[s].id, cp.slots.slot[s2].id] : [cp.slots.slot[s].id],
      roomIds: rooms[i].map((r) => cp.data.rooms[r].id),
      pinned: false,
    })
  }
  return out
}

export function* solveSteps(
  data: SchoolSnapshot,
  opts: Partial<SolverOptions> = {},
  shouldCancel: () => boolean = () => false,
): Generator<SolveProgress, SolveResult> {
  const options = { ...defaultSolverOptions(), ...opts }
  const seed = options.seed >>> 0
  const t0 = Date.now()
  const deadline = t0 + Math.max(100, options.timeLimitMs)
  let cancelled = false
  const stop = () => {
    if (!cancelled && shouldCancel()) cancelled = true
    return cancelled
  }
  yield { phase: 'validate', percent: 0 }
  const blocking = validate(data).filter((i) => i.severity === 'error')
  const cp = compile(data, options.weights)
  const sessions = buildSessions(cp)

  // ---- phase 1: placement with restarts --------------------------------------
  const tPlace = Date.now()
  let best: { starts: Int32Array; rooms: number[][]; hours: number } | null = null
  let nodes = 0
  let attempts = 0
  // Teacher assignment for auto groups (v0.5.1): greedy, then conflict-driven reassignment
  // between placement attempts. Fixed teachers are never changed.
  const hasAuto = cp.groups.some((G) => G.auto && G.baseValid)
  const assignRng = createRng(subSeed(seed, 4242))
  const assignment = greedyAssign(cp, assignRng)
  applyAssignment(cp, assignment)
  let bestAssignment = assignment.slice()
  // Validator errors are proofs of infeasibility: skip the search entirely (fast "infeasible").
  const maxAttempts = blocking.length ? 0 : Math.max(1, options.maxAttempts)
  for (let a = 0; a < maxAttempts; a++) {
    const board = new Board(cp, sessions)
    const nodeLimit = Math.max(3000, sessions.length * 20) * luby(a + 1)
    const gen = placeSessions(board, createRng(subSeed(seed, a)), nodeLimit, deadline)
    attempts++
    let r = gen.next()
    while (!r.done) {
      yield { phase: 'place', percent: 2 + (58 * r.value.placed) / Math.max(1, r.value.total), placed: r.value.placed, total: r.value.total, attempt: a + 1 }
      if (stop()) break
      r = gen.next()
    }
    if (!r.done) break // cancelled
    nodes += r.value.nodes
    if (!best || r.value.placedHours > best.hours) {
      best = { starts: r.value.starts, rooms: r.value.rooms, hours: r.value.placedHours }
      bestAssignment = assignment.slice()
    }
    if (r.value.complete || Date.now() > deadline || stop()) break
    let changed = false
    if (hasAuto) {
      const conflicts = new Int32Array(cp.nTeacher)
      const unplacedGroups = new Set<number>()
      for (let i = 0; i < board.size; i++) {
        if (r.value.starts[i] >= 0) continue
        const g = board.sg[i]
        unplacedGroups.add(g)
        for (const t of cp.groups[g].teachers) conflicts[t]++
        // teachers of other groups sharing the unplaced group's classes are also involved
        for (const H of cp.groups) if (H.auto && H.teachers.length && H.classes.some((c) => cp.groups[g].classes.includes(c))) conflicts[H.teachers[0]]++
      }
      changed = reassignForConflicts(cp, assignment, conflicts, unplacedGroups, assignRng)
      if (changed) applyAssignment(cp, assignment)
    }
    if (r.value.exhausted && !changed) break
  }
  applyAssignment(cp, bestAssignment)
  const placementMs = Date.now() - tPlace
  const board = new Board(cp, sessions)
  if (best) for (let i = 0; i < board.size; i++) if (best.starts[i] >= 0) board.place(i, best.starts[i], best.rooms[i])
  const initialLessons = toLessons(cp, board, board.sstart, board.srooms)

  // ---- phase 2: local search ----------------------------------------------------
  const tOpt = Date.now()
  const og = optimize(board, createRng(subSeed(seed, 777)), cancelled || blocking.length ? 0 : options.optimizeIterations, deadline, stop)
  // Blocking validation errors: no placement and no local search (it would also fill pending sessions).
  let o = blocking.length ? { done: true as const, value: { starts: board.sstart, rooms: board.srooms, iterations: 0, initialScore: 0, finalScore: 0 } satisfies OptimizeResult } : og.next()
  while (!o.done) {
    yield { phase: 'optimize', percent: 60 + (40 * o.value.iteration) / Math.max(1, o.value.iterations), iteration: o.value.iteration, iterations: o.value.iterations, score: o.value.best, pending: o.value.pending }
    o = og.next()
  }
  const optimizeMs = Date.now() - tOpt
  const lessons = blocking.length ? [] : toLessons(cp, board, o.value.starts, o.value.rooms)
  const unplaced = blocking.length ? [] : diagnoseUnplaced(cp, board, o.value.starts, o.value.rooms)

  const totalHours = cp.groups.reduce((a, g) => a + g.hours, 0)
  const placedHours = lessons.reduce((a, l) => a + l.slotIds.length, 0)
  const allPlaced = placedHours === totalHours
  const status: SolveResult['status'] = allPlaced && !blocking.length
    ? 'complete'
    : cancelled ? 'cancelled' : blocking.length ? 'infeasible' : allPlaced ? 'complete' : 'incomplete'
  yield { phase: 'done', percent: 100 }
  const teacherAssignments: Record<string, string[]> = {}
  cp.groups.forEach((G, g) => { teacherAssignments[G.id] = G.auto ? G.teachers.map((t) => data.teachers[t].id) : [...data.groups[g].teacherIds] })
  return {
    status,
    lessons,
    teacherAssignments,
    unplaced,
    reasons: status === 'infeasible' ? blocking : [],
    qualityReport: qualityReport(data, lessons, initialLessons),
    dataFingerprint: fingerprint(data),
    stats: {
      seed,
      elapsedMs: Date.now() - t0,
      placementMs,
      optimizeMs,
      placementNodes: nodes,
      placementAttempts: attempts,
      saIterations: o.value.iterations,
      initialSoftScore: o.value.initialScore,
      finalSoftScore: o.value.finalScore,
      cancelled,
      timedOut: !cancelled && Date.now() > deadline,
      totalHours,
      placedHours,
    },
  }
}

/** Explains why each remaining session could not be placed (against the final timetable). */
function diagnoseUnplaced(cp: Compiled, board0: Board, starts: Int32Array, rooms: number[][]): UnplacedLesson[] {
  const board = new Board(cp, Array.from({ length: board0.size }, (_, i) => ({ g: board0.sg[i], len: board0.slen[i] as 1 | 2 })))
  for (let i = 0; i < board.size; i++) if (starts[i] >= 0) board.place(i, starts[i], rooms[i])
  const name = nameLookup(cp.data)
  const agg = new Map<string, UnplacedLesson>()
  for (let i = 0; i < board.size; i++) {
    if (starts[i] >= 0) continue
    const gi = board.sg[i]
    const len = board.slen[i] as 1 | 2
    const key = `${gi}:${len}`
    const e = agg.get(key)
    if (e) { e.count++; continue }
    const G = cp.groups[gi]
    const src = cp.data.groups[gi]
    const base = {
      subject: name(src.subjectId),
      class: src.classIds.map(name).join(', '),
      teacher: G.teachers.map((t) => cp.data.teachers[t].name).join(', ') || src.teacherIds.map(name).join(', '),
    }
    const mk = (code: string, extra: Issue['params'] = {}): Issue => ({ code, severity: 'error', params: { ...base, ...extra }, ref: { kind: 'group', id: G.id } })
    let reason: Issue
    if (G.auto && G.baseValid && !G.teachers.length) reason = mk('U_NO_TEACHER_AVAILABLE')
    else if (!G.valid) reason = mk('U_GROUP_INVALID')
    else {
      const { S } = cp
      let starts2 = 0, teacherClassOk = 0, capOk = 0
      for (let s = 0; s < S; s++) {
        const s2 = board.second(len, s)
        if (s2 < 0) continue
        starts2++
        const free = (x: number) =>
          G.teachers.every((t) => cp.teacherOk[t * S + x] && board.teacherAt[t * S + x] < 0) &&
          G.classes.every((c) => cp.classOk[c * S + x] && board.classAt[c * S + x] < 0)
        if (!free(s) || !free(s2)) continue
        teacherClassOk++
        const d = cp.slots.slotDay[s]
        if (G.teachers.every((t) => board.teacherDay[t * cp.D + d] + len <= cp.teacherDailyCap[t] && board.teacherTotal[t] + len <= cp.teacherWeeklyCap[t])) capOk++
      }
      if (len === 2 && starts2 === 0) reason = mk('U_NO_JOINABLE_PAIR')
      else if (teacherClassOk === 0) reason = mk('U_NO_COMMON_SLOT')
      else if (capOk === 0) reason = mk('U_TEACHER_CAP')
      else reason = mk('U_NO_ROOM_OR_SEARCH_LIMIT')
    }
    agg.set(key, { studyGroupId: G.id, length: len, count: 1, reason })
  }
  return [...agg.values()]
}

/** Synchronous solve (Node, tests). */
export function solve(data: SchoolSnapshot, options: Partial<SolverOptions> = {}, hooks: SolveHooks = {}): SolveResult {
  const gen = solveSteps(data, options, hooks.shouldCancel)
  let r = gen.next()
  while (!r.done) {
    hooks.onProgress?.(r.value)
    r = gen.next()
  }
  return r.value
}

/** Time-sliced solve: yields to the event loop every ~sliceMs so cancel messages get through. */
export async function solveAsync(
  data: SchoolSnapshot,
  options: Partial<SolverOptions> = {},
  hooks: SolveHooks = {},
  sliceMs = 50,
): Promise<SolveResult> {
  const gen = solveSteps(data, options, hooks.shouldCancel)
  let r = gen.next()
  let sliceStart = Date.now()
  while (!r.done) {
    if (Date.now() - sliceStart >= sliceMs) {
      hooks.onProgress?.(r.value)
      await new Promise((res) => setTimeout(res, 0))
      sliceStart = Date.now()
    }
    r = gen.next()
  }
  hooks.onProgress?.({ phase: 'done', percent: 100 })
  return r.value
}
