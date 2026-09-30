/**
 * Teacher assignment for auto groups (spec v0.5.1 §2, §3.1 #5/#7).
 *
 * 1. Free capacity per teacher = min(X, daily cap × working days, unblocked
 *    slots on working days (≤ daily cap per day)) − hours of fixed groups.
 * 2. `assignmentFlow`: max-flow auto groups → qualified teachers → sink with
 *    those capacities. A relaxation (a group may split across teachers there),
 *    so a shortfall PROVES infeasibility; used by the validator for messages.
 * 3. `greedyAssign`: indivisible assignment, most-constrained / largest group
 *    first, tie-broken by the soft preferences, with a one-level repair (move
 *    another auto group off a full teacher).
 * 4. `reassignForConflicts`: after a failed placement attempt, move the auto
 *    group whose teacher appears in the most conflicts to another qualified
 *    teacher with room (no restart from scratch of the assignment).
 */
import type { Compiled } from './compile'
import { MaxFlow } from './maxflow'
import type { Rng } from './rng'

/** Hours a teacher can teach at all in this week (ignores X). */
export function teacherSlotCapacity(cp: Compiled, t: number): number {
  const { S, slots } = cp
  let capacity = 0
  for (let di = 0; di < cp.D; di++) {
    if (di === cp.teacherDayOff[t]) continue
    let free = 0
    for (let p = 0; p < slots.dayLength[di]; p++) free += cp.teacherOk[t * S + slots.dayStart[di] + p]
    capacity += Math.min(cp.teacherDailyCap[t], free)
  }
  return capacity
}

/** Per teacher: effective weekly capacity, hours of valid fixed groups, and free capacity for auto groups. */
export function teacherCapacities(cp: Compiled): { capacity: Int32Array; fixed: Int32Array; free: Int32Array } {
  const capacity = new Int32Array(cp.nTeacher)
  const fixed = new Int32Array(cp.nTeacher)
  const free = new Int32Array(cp.nTeacher)
  for (let t = 0; t < cp.nTeacher; t++) capacity[t] = Math.min(cp.teacherWeeklyCap[t], teacherSlotCapacity(cp, t))
  for (const G of cp.groups) if (!G.auto && G.baseValid) for (const t of new Set(G.teachers)) fixed[t] += G.hours
  for (let t = 0; t < cp.nTeacher; t++) free[t] = Math.max(0, capacity[t] - fixed[t])
  return { capacity, fixed, free }
}

export interface FlowReport {
  autoHours: number
  assignable: number
  /** Per subject index with auto hours: demand vs the free capacity of its qualified teachers. */
  subjects: { subj: number; hours: number; free: number }[]
}

/** Max-flow relaxation of the auto-group assignment (necessary condition). */
export function assignmentFlow(cp: Compiled): FlowReport {
  const { free } = teacherCapacities(cp)
  const autos = cp.groups.map((G, g) => ({ G, g })).filter(({ G }) => G.auto && G.baseValid)
  const nT = cp.nTeacher
  const src = 0, sink = 1 + autos.length + nT
  const mf = new MaxFlow(sink + 1)
  let autoHours = 0
  autos.forEach(({ G }, i) => {
    autoHours += G.hours
    mf.addEdge(src, 1 + i, G.hours)
    for (const t of G.candidates) mf.addEdge(1 + i, 1 + autos.length + t, G.hours)
  })
  for (let t = 0; t < nT; t++) if (free[t] > 0) mf.addEdge(1 + autos.length + t, sink, free[t])
  const assignable = autos.length ? mf.run(src, sink) : 0
  const bySubj = new Map<number, { hours: number; teachers: Set<number> }>()
  for (const { G } of autos) {
    const e = bySubj.get(G.subj) ?? { hours: 0, teachers: new Set<number>() }
    e.hours += G.hours
    G.candidates.forEach((t) => e.teachers.add(t))
    bySubj.set(G.subj, e)
  }
  const subjects = [...bySubj].map(([subj, e]) => ({ subj, hours: e.hours, free: [...e.teachers].reduce((a, t) => a + free[t], 0) }))
  return { autoHours, assignable, subjects }
}

/** groupTeacher[g] = assigned teacher index for auto groups, -1 otherwise/unassigned. */
export type Assignment = Int32Array

interface AssignCtx {
  load: Int32Array
  capacity: Int32Array
  /** teacher → classes they already teach (continuity bonus) */
  teachesClass: Set<string>
}

function ctxFor(cp: Compiled): AssignCtx {
  const { capacity, fixed } = teacherCapacities(cp)
  const teachesClass = new Set<string>()
  for (const G of cp.groups) if (!G.auto) for (const t of G.teachers) for (const c of G.classes) teachesClass.add(`${t}:${c}`)
  return { load: Int32Array.from(fixed), capacity, teachesClass }
}

function score(cp: Compiled, ctx: AssignCtx, g: number, t: number, rng: Rng): number {
  const G = cp.groups[g]
  const rem = ctx.capacity[t] - ctx.load[t] - G.hours
  if (rem < 0) return -Infinity
  let sc = rem / Math.max(1, ctx.capacity[t]) // prefer spare capacity (keeps later groups assignable)
  if (G.classes.some((c) => ctx.teachesClass.has(`${t}:${c}`))) sc += 0.35 // same teacher for the class: fewer gaps
  if (cp.weights.teacherLoadBalance) sc += 0.2 * rem / Math.max(1, ctx.capacity[t])
  return sc + rng() * 0.25
}

/** Greedy indivisible assignment with one-level repair. Deterministic for a given rng. */
export function greedyAssign(cp: Compiled, rng: Rng): Assignment {
  const a = new Int32Array(cp.groups.length).fill(-1)
  const ctx = ctxFor(cp)
  const order = cp.groups.map((G, g) => ({ G, g, r: rng() })).filter(({ G }) => G.auto && G.baseValid)
  order.sort((x, y) => x.G.candidates.length - y.G.candidates.length || y.G.hours - x.G.hours || x.r - y.r)
  const give = (g: number, t: number) => {
    a[g] = t
    ctx.load[t] += cp.groups[g].hours
    for (const c of cp.groups[g].classes) ctx.teachesClass.add(`${t}:${c}`)
  }
  for (const { G, g } of order) {
    let best = -1, bestSc = -Infinity
    for (const t of G.candidates) { const sc = score(cp, ctx, g, t, rng); if (sc > bestSc) { bestSc = sc; best = t } }
    if (best >= 0) { give(g, best); continue }
    // repair: free a candidate by moving one of its auto groups to another teacher with room
    let done = false
    for (const t of G.candidates) {
      for (let h = 0; h < a.length && !done; h++) {
        if (a[h] !== t) continue
        const H = cp.groups[h]
        if (ctx.capacity[t] - (ctx.load[t] - H.hours) < G.hours) continue
        const alt = H.candidates.find((u) => u !== t && ctx.capacity[u] - ctx.load[u] >= H.hours)
        if (alt === undefined) continue
        ctx.load[t] -= H.hours
        give(h, alt)
        give(g, t)
        done = true
      }
      if (done) break
    }
  }
  return a
}

/**
 * After a failed attempt: `conflicts[t]` counts how often teacher t is involved
 * with unplaced sessions. Moves the auto group whose teacher has the most
 * conflicts (unplaced auto groups first) to another candidate with room.
 * Returns false if nothing could be moved.
 */
export function reassignForConflicts(cp: Compiled, a: Assignment, conflicts: Int32Array, unplacedGroups: Set<number>, rng: Rng): boolean {
  const ctx = ctxFor(cp)
  for (let g = 0; g < a.length; g++) if (a[g] >= 0) ctx.load[a[g]] += cp.groups[g].hours
  const cands: { g: number; w: number }[] = []
  for (let g = 0; g < a.length; g++) {
    const G = cp.groups[g]
    if (!G.auto || !G.baseValid || G.candidates.length < 2 && a[g] >= 0) continue
    const w = (unplacedGroups.has(g) ? 1000 : 0) + (a[g] >= 0 ? conflicts[a[g]] : 500) + rng()
    if (w >= 1) cands.push({ g, w })
  }
  cands.sort((x, y) => y.w - x.w)
  for (const { g } of cands.slice(0, 8)) {
    const G = cp.groups[g]
    const cur = a[g]
    const alts = G.candidates.filter((t) => t !== cur && ctx.capacity[t] - ctx.load[t] >= G.hours)
    if (!alts.length) continue
    alts.sort((x, y) => conflicts[x] - conflicts[y] || (ctx.capacity[y] - ctx.load[y]) - (ctx.capacity[x] - ctx.load[x]))
    const pick = alts[Math.floor(rng() * Math.min(2, alts.length))]
    a[g] = pick
    return true
  }
  return false
}

/** Writes an assignment into the compiled groups (teachers + valid flags). */
export function applyAssignment(cp: Compiled, a: Assignment): void {
  cp.groups.forEach((G, g) => {
    if (!G.auto) return
    G.teachers = a[g] >= 0 ? [a[g]] : []
    G.valid = G.baseValid && G.teachers.length > 0
  })
}
