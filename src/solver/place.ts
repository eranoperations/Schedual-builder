/**
 * Phase 1: place sessions into slots (rooms chosen on the way).
 *
 * Iterative depth-first search over variables (group, length) — identical
 * sessions of a group are one variable with a count, removing symmetry — with
 *  - MRV: branch on the variable with the smallest slack
 *    (feasible start slots − sessions still to place), ties by degree
 *    (busiest teachers/classes first);
 *  - forward checking after every assignment: every variable must keep enough
 *    feasible starts, every class/teacher must keep enough reachable slots, and
 *    every teacher's remaining hours must fit under their daily caps;
 *  - soft-aware value ordering (spread a group over days, early/compact days,
 *    teacher adjacency, avoid soft blocks).
 * A node limit bounds each attempt; the orchestrator restarts with new seeds.
 */
import type { Board } from './board'
import type { Rng } from './rng'

export interface PlaceProgress {
  placed: number
  total: number
  nodes: number
}

export interface PlaceResult {
  complete: boolean
  /** session -> start (or -1); rooms per session */
  starts: Int32Array
  rooms: number[][]
  placedHours: number
  nodes: number
  exhausted: boolean
}

interface Var {
  g: number
  len: 1 | 2
  sessions: number[] // unplaced session ids (stack)
  placed: number[] // placed session ids (stack)
  tie: number
}

interface Frame {
  v: number
  values: Int32Array
  idx: number
  applied: boolean
}

export function* placeSessions(board: Board, rng: Rng, nodeLimit: number, deadline: number): Generator<PlaceProgress, PlaceResult> {
  const cp = board.cp
  const { S, D } = cp
  const maxPerDay = cp.weights.maxGroupHoursPerDay
  const vars: Var[] = []
  const varIdx = new Map<string, number>()
  for (let i = 0; i < board.size; i++) {
    const g = board.sg[i]
    if (!cp.groups[g].valid) continue
    const key = `${g}:${board.slen[i]}`
    if (!varIdx.has(key)) { varIdx.set(key, vars.length); vars.push({ g, len: board.slen[i] as 1 | 2, sessions: [], placed: [], tie: rng() }) }
    vars[varIdx.get(key)!].sessions.push(i)
  }
  let totalHours = 0
  const classRem = new Int32Array(cp.nClass)
  const teacherRem = new Int32Array(cp.nTeacher)
  for (const v of vars) {
    const h = v.len * v.sessions.length
    totalHours += h
    for (const c of cp.groups[v.g].classes) classRem[c] += h
    for (const t of cp.groups[v.g].teachers) teacherRem[t] += h
  }
  const groupDay = new Int32Array(cp.groups.length * D)
  let placedHours = 0
  let best = { hours: -1, starts: new Int32Array(board.size).fill(-1), rooms: [] as number[][] }
  const snapshot = () => {
    best = { hours: placedHours, starts: Int32Array.from(board.sstart), rooms: board.srooms.map((r) => r.slice()) }
  }

  const classMark = new Int32Array(cp.nClass * S)
  const teacherMark = new Int32Array(cp.nTeacher * S)
  const classUnion = new Int32Array(cp.nClass)
  const teacherDayUnion = new Int32Array(cp.nTeacher * D)
  let stamp = 0

  const markSlot = (g: number, s: number) => {
    const G = cp.groups[g]
    for (const c of G.classes) {
      const k = c * S + s
      if (classMark[k] !== stamp) { classMark[k] = stamp; classUnion[c]++ }
    }
    for (const t of G.teachers) {
      const k = t * S + s
      if (teacherMark[k] !== stamp) { teacherMark[k] = stamp; teacherDayUnion[t * D + cp.slots.slotDay[s]]++ }
    }
  }

  /** variable to branch on; -1 dead end; -2 done */
  const select = (): number => {
    if (placedHours === totalHours) return -2
    stamp++
    classUnion.fill(0)
    teacherDayUnion.fill(0)
    let bestV = -1, bestSlack = Infinity, bestDom = Infinity, bestDeg = -1
    for (let vi = 0; vi < vars.length; vi++) {
      const v = vars[vi]
      const need = v.sessions.length
      if (!need) continue
      let dom = 0
      for (let s = 0; s < S; s++) {
        if (!board.fits(v.g, v.len, s, null, -1, null, true)) continue
        dom++
        markSlot(v.g, s)
        if (v.len === 2) markSlot(v.g, cp.slots.nextJoin[s])
      }
      // two doubles can't share a start; singles need distinct slots
      const slack = dom - need
      if (slack < 0) return -1
      const G = cp.groups[v.g]
      let deg = v.tie
      for (const t of G.teachers) deg += teacherRem[t]
      for (const c of G.classes) deg += classRem[c]
      deg += v.len * 10
      if (slack < bestSlack || (slack === bestSlack && (dom < bestDom || (dom === bestDom && deg > bestDeg)))) {
        bestV = vi; bestSlack = slack; bestDom = dom; bestDeg = deg
      }
    }
    for (let c = 0; c < cp.nClass; c++) if (classRem[c] > classUnion[c]) return -1
    for (let t = 0; t < cp.nTeacher; t++) {
      if (!teacherRem[t]) continue
      let cap = 0
      for (let d = 0; d < D; d++) cap += Math.min(cp.teacherDailyCap[t] - board.teacherDay[t * D + d], teacherDayUnion[t * D + d])
      if (cap < teacherRem[t]) return -1
    }
    return bestV
  }

  const orderValues = (vi: number): Int32Array => {
    const v = vars[vi]
    const G = cp.groups[v.g]
    const cand: { s: number; cost: number }[] = []
    for (let s = 0; s < S; s++) {
      if (!board.fits(v.g, v.len, s, null, -1, null, true)) continue
      const d = cp.slots.slotDay[s]
      const p = cp.slots.slotPos[s]
      const last = board.second(v.len, s)
      const pl = cp.slots.slotPos[last]
      const len = cp.slots.dayLength[d]
      const gd = groupDay[v.g * D + d]
      let cost = gd + v.len > maxPerDay ? 60 + gd * 10 : gd * 8
      cost += p * 0.8
      for (const t of G.teachers) {
        if (p > 0 && board.teacherAt[t * S + s - 1] >= 0) cost -= 2
        if (pl < len - 1 && board.teacherAt[t * S + last + 1] >= 0) cost -= 2
        if (cp.teacherSoft[t * S + s] || cp.teacherSoft[t * S + last]) cost += 12
      }
      for (const c of G.classes) {
        if (p === cp.slots.regularStart[d] || (p > 0 && board.classAt[c * S + s - 1] >= 0)) cost -= 2
        if (cp.classSoft[c * S + s] || cp.classSoft[c * S + last]) cost += 12
      }
      cost += rng() * 1.5
      cand.push({ s, cost })
    }
    cand.sort((a, b) => a.cost - b.cost)
    return Int32Array.from(cand, (x) => x.s)
  }

  const scratch: number[] = []
  const apply = (vi: number, s: number): boolean => {
    const v = vars[vi]
    if (!board.fits(v.g, v.len, s, scratch, -1, null, true)) return false
    const i = v.sessions.pop()!
    board.place(i, s, scratch)
    v.placed.push(i)
    const h = v.len
    placedHours += h
    groupDay[v.g * D + cp.slots.slotDay[s]] += h
    for (const c of cp.groups[v.g].classes) classRem[c] -= h
    for (const t of cp.groups[v.g].teachers) teacherRem[t] -= h
    if (placedHours > best.hours) snapshot()
    return true
  }
  const undo = (vi: number) => {
    const v = vars[vi]
    const i = v.placed.pop()!
    const s = board.sstart[i]
    board.unplace(i)
    v.sessions.push(i)
    const h = v.len
    placedHours -= h
    groupDay[v.g * D + cp.slots.slotDay[s]] -= h
    for (const c of cp.groups[v.g].classes) classRem[c] += h
    for (const t of cp.groups[v.g].teachers) teacherRem[t] += h
  }

  const frames: Frame[] = []
  let nodes = 0
  const step = (): boolean => {
    while (frames.length) {
      const top = frames[frames.length - 1]
      if (top.applied) { undo(top.v); top.applied = false }
      while (top.idx < top.values.length) {
        const s = top.values[top.idx++]
        if (apply(top.v, s)) { top.applied = true; nodes++; return true }
      }
      frames.pop()
    }
    return false
  }

  snapshot()
  const result = (complete: boolean, exhausted: boolean): PlaceResult => complete
    ? { complete, starts: Int32Array.from(board.sstart), rooms: board.srooms.map((r) => r.slice()), placedHours, nodes, exhausted }
    : { complete, starts: best.starts, rooms: best.rooms, placedHours: best.hours, nodes, exhausted }

  if (totalHours === 0) return result(true, false)
  let iter = 0
  for (;;) {
    if ((iter++ & 127) === 0) {
      yield { placed: best.hours, total: totalHours, nodes }
      if (Date.now() > deadline) break
    }
    if (nodes > nodeLimit) break
    const vi = select()
    if (vi === -2) return result(true, false)
    if (vi >= 0) frames.push({ v: vi, values: orderValues(vi), idx: 0, applied: false })
    if (!step()) return result(false, true)
  }
  return result(false, false)
}
