/**
 * Phase 2: simulated annealing on the soft score. Every move is validated by
 * Board.fits (all hard constraints) before it is applied, so the timetable
 * stays hard-feasible throughout. Moves: relocate a session; swap two
 * same-length sessions of the same class. Unplaced sessions are periodically
 * re-inserted whenever a feasible slot opens up.
 */
import type { Board } from './board'
import { randInt, type Rng } from './rng'

export interface OptimizeProgress {
  iteration: number
  iterations: number
  best: number
  pending: number
}

export interface OptimizeResult {
  starts: Int32Array
  rooms: number[][]
  initialScore: number
  finalScore: number
  iterations: number
}

export function* optimize(
  board: Board,
  rng: Rng,
  iterations: number,
  deadline: number,
  shouldStop: () => boolean = () => false,
): Generator<OptimizeProgress, OptimizeResult> {
  const cp = board.cp
  const { S, D } = cp
  const w = cp.weights
  const { slotDay, dayStart, dayLength, regularStart } = cp.slots
  const n = board.size
  const tdGap = new Float64Array(cp.nTeacher * D)
  const cdGap = new Float64Array(cp.nClass * D)
  const groupDay = new Int32Array(cp.groups.length * D)
  const softHit = new Uint8Array(n)
  const teacherAvg = new Float64Array(cp.nTeacher)
  let total = 0

  // teacher average daily load over working days (all their sessions)
  {
    const tot = new Int32Array(cp.nTeacher)
    for (let i = 0; i < n; i++) for (const t of cp.groups[board.sg[i]].teachers) tot[t] += board.slen[i]
    for (let t = 0; t < cp.nTeacher; t++) {
      const wd = D - (cp.teacherDayOff[t] >= 0 ? 1 : 0)
      teacherAvg[t] = wd > 0 ? tot[t] / wd : 0
      if (w.teacherLoadBalance && tot[t]) for (let d = 0; d < D; d++) if (d !== cp.teacherDayOff[t]) total += w.teacherLoadBalance * teacherAvg[t]
    }
  }

  const teacherGap = (t: number, d: number): number => {
    let first = -1, last = -1, cnt = 0
    const b = t * S + dayStart[d]
    for (let p = 0; p < dayLength[d]; p++) if (board.teacherAt[b + p] >= 0) { if (first < 0) first = p; last = p; cnt++ }
    return cnt ? last - first + 1 - cnt : 0
  }
  const classGap = (c: number, d: number): number => {
    let last = -1, cnt = 0
    const reg = regularStart[d]
    const b = c * S + dayStart[d]
    for (let p = reg; p < dayLength[d]; p++) if (board.classAt[b + p] >= 0) { last = p; cnt++ }
    return cnt ? last - reg + 1 - cnt : 0
  }
  const excess = (h: number) => (h > w.maxGroupHoursPerDay ? h - w.maxGroupHoursPerDay : 0)

  const refresh = (i: number, d: number) => {
    const G = cp.groups[board.sg[i]]
    for (const t of G.teachers) {
      const k = t * D + d
      const ng = teacherGap(t, d)
      total += w.teacherGaps * (ng - tdGap[k])
      tdGap[k] = ng
    }
    for (const c of G.classes) {
      const k = c * D + d
      const ng = classGap(c, d)
      total += w.classGaps * (ng - cdGap[k])
      cdGap[k] = ng
    }
  }
  const sessionSoft = (i: number): number => {
    const s = board.sstart[i]
    const s2 = board.second(board.slen[i], s)
    const G = cp.groups[board.sg[i]]
    for (const t of G.teachers) if (cp.teacherSoft[t * S + s] || cp.teacherSoft[t * S + s2]) return 1
    for (const c of G.classes) if (cp.classSoft[c * S + s] || cp.classSoft[c * S + s2]) return 1
    for (const r of board.srooms[i]) if (cp.roomSoft[r * S + s] || cp.roomSoft[r * S + s2]) return 1
    return 0
  }
  const balance = (i: number, d: number, delta: number) => {
    if (!w.teacherLoadBalance) return
    for (const t of cp.groups[board.sg[i]].teachers) {
      const now = board.teacherDay[t * D + d]
      const before = now - delta
      total += w.teacherLoadBalance * (Math.abs(now - teacherAvg[t]) - Math.abs(before - teacherAvg[t]))
    }
  }

  const add = (i: number, s: number, rooms: number[]) => {
    board.place(i, s, rooms)
    const d = slotDay[s]
    const len = board.slen[i]
    refresh(i, d)
    const gk = board.sg[i] * D + d
    total += w.spreadExcess * (excess(groupDay[gk] + len) - excess(groupDay[gk]))
    groupDay[gk] += len
    balance(i, d, len)
    softHit[i] = sessionSoft(i)
    total += w.softBlocks * softHit[i]
  }
  const remove = (i: number) => {
    const s = board.sstart[i]
    const d = slotDay[s]
    const len = board.slen[i]
    total -= w.softBlocks * softHit[i]
    softHit[i] = 0
    board.unplace(i)
    refresh(i, d)
    const gk = board.sg[i] * D + d
    total += w.spreadExcess * (excess(groupDay[gk] - len) - excess(groupDay[gk]))
    groupDay[gk] -= len
    balance(i, d, -len)
  }

  // Load the initial state through add() so all components are consistent.
  const init = Array.from({ length: n }, (_, i) => ({ s: board.sstart[i], r: board.srooms[i].slice() }))
  for (let i = 0; i < n; i++) board.unplace(i)
  const pending: number[] = []
  for (let i = 0; i < n; i++) {
    if (init[i].s >= 0) add(i, init[i].s, init[i].r)
    else if (cp.groups[board.sg[i]].valid) pending.push(i)
  }
  const scratch: number[] = []
  const scratch2: number[] = []
  const tryInsertPending = (): boolean => {
    let any = false
    for (let k = pending.length - 1; k >= 0; k--) {
      const i = pending[k]
      const off = randInt(rng, Math.max(1, S))
      for (let q = 0; q < S; q++) {
        const s = (q + off) % S
        if (board.fits(board.sg[i], board.slen[i], s, scratch)) {
          add(i, s, scratch)
          pending.splice(k, 1)
          any = true
          break
        }
      }
    }
    return any
  }
  tryInsertPending()

  const placedList = (): number[] => {
    const arr: number[] = []
    for (let i = 0; i < n; i++) if (board.sstart[i] >= 0) arr.push(i)
    return arr
  }
  let placed = placedList()
  const initialScore = total
  let bestScore = total
  let bestPending = pending.length
  let bestStarts = Int32Array.from(board.sstart)
  let bestRooms = board.srooms.map((r) => r.slice())
  const snapshot = () => {
    bestScore = total
    bestPending = pending.length
    bestStarts = Int32Array.from(board.sstart)
    bestRooms = board.srooms.map((r) => r.slice())
  }

  const T0 = 6
  const T1 = 0.02
  const iters = Math.max(0, Math.floor(iterations))
  let it = 0
  for (; it < iters && placed.length > 0 && S > 1; it++) {
    if ((it & 1023) === 0) {
      if (Date.now() > deadline || shouldStop()) break
      if (pending.length && tryInsertPending()) {
        placed = placedList()
        if (pending.length < bestPending) snapshot()
      }
      if ((it & 8191) === 0) yield { iteration: it, iterations: iters, best: bestScore, pending: pending.length }
    }
    const T = T0 * Math.pow(T1 / T0, it / iters)
    const before = total
    const i = placed[randInt(rng, placed.length)]
    const g = board.sg[i]
    const len = board.slen[i]
    const s1 = board.sstart[i]
    const r1 = board.srooms[i].slice()
    const s2 = randInt(rng, S)
    if (s2 === s1 || board.second(len, s2) < 0) continue
    const G = cp.groups[g]
    const c0 = G.classes[0]
    const j = board.classAt[c0 * S + s2]
    if (j < 0 || j === i) {
      // relocate (s2 must be free for the class — checked by fits)
      if (!board.fits(g, len, s2, scratch, i, r1)) continue
      remove(i)
      add(i, s2, scratch)
      const delta = total - before
      if (delta <= 0 || rng() < Math.exp(-delta / T)) {
        if (total < bestScore - 1e-9 && pending.length <= bestPending) snapshot()
        continue
      }
      remove(i)
      add(i, s1, r1)
      continue
    }
    // swap with j (same length, j must start at s2)
    if (board.slen[j] !== len || board.sstart[j] !== s2) continue
    const gj = board.sg[j]
    const rj = board.srooms[j].slice()
    remove(i)
    remove(j)
    let ok = false
    if (board.fits(g, len, s2, scratch, -1, r1)) {
      add(i, s2, scratch)
      if (board.fits(gj, len, s1, scratch2, -1, rj)) { add(j, s1, scratch2); ok = true } else remove(i)
    }
    if (!ok) { add(i, s1, r1); add(j, s2, rj); continue }
    const delta = total - before
    if (delta <= 0 || rng() < Math.exp(-delta / T)) {
      if (total < bestScore - 1e-9 && pending.length <= bestPending) snapshot()
      continue
    }
    remove(i); remove(j)
    add(i, s1, r1); add(j, s2, rj)
  }
  if (pending.length < bestPending || (pending.length === bestPending && total < bestScore)) snapshot()
  return { starts: bestStarts, rooms: bestRooms, initialScore, finalScore: bestScore, iterations: it }
}
