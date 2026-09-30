/**
 * Occupancy board shared by the placement search and the local search.
 * A "session" is one placed lesson of a study group: a single (1 slot) or a
 * double (2 joinable consecutive slots). Every placement goes through `fits`,
 * which checks ALL hard constraints, so the board is hard-feasible by
 * construction.
 */
import type { Compiled } from './compile'

export class Board {
  readonly cp: Compiled
  readonly teacherAt: Int32Array
  readonly classAt: Int32Array
  readonly roomAt: Int32Array
  readonly teacherDay: Int32Array
  readonly teacherTotal: Int32Array
  /** session -> group */
  readonly sg: Int32Array
  /** session -> length (1|2) */
  readonly slen: Int32Array
  /** session -> start slot or -1 */
  readonly sstart: Int32Array
  /** session -> rooms (one per class; empty for no room) */
  readonly srooms: number[][]
  private chosen: number[] = []
  /** Room re-assignments planned by the last successful `fits(..., allowRelocate)` with `out`. */
  private relocations: { k: number; from: number; to: number }[] = []

  constructor(cp: Compiled, sessions: { g: number; len: 1 | 2 }[]) {
    this.cp = cp
    const { S, D } = cp
    this.teacherAt = new Int32Array(cp.nTeacher * S).fill(-1)
    this.classAt = new Int32Array(cp.nClass * S).fill(-1)
    this.roomAt = new Int32Array(cp.nRoom * S).fill(-1)
    this.teacherDay = new Int32Array(cp.nTeacher * D)
    this.teacherTotal = new Int32Array(cp.nTeacher)
    this.sg = Int32Array.from(sessions, (x) => x.g)
    this.slen = Int32Array.from(sessions, (x) => x.len)
    this.sstart = new Int32Array(sessions.length).fill(-1)
    this.srooms = sessions.map(() => [])
  }

  get size(): number {
    return this.sg.length
  }

  /** Second slot of a session starting at s, or s itself for singles; -1 if invalid. */
  second(len: number, s: number): number {
    return len === 2 ? this.cp.slots.nextJoin[s] : s
  }

  private roomFree(r: number, s: number, s2: number, ignore: number): boolean {
    const { S, roomOk } = this.cp
    const a = this.roomAt[r * S + s]
    const b = this.roomAt[r * S + s2]
    return roomOk[r * S + s] === 1 && roomOk[r * S + s2] === 1 && (a < 0 || a === ignore) && (b < 0 || b === ignore)
  }

  /**
   * Can group g (as a session of `len`) start at slot s? When `out` is given,
   * the chosen rooms are written to it. `ignore` is a session id treated as
   * absent (used when evaluating moves).
   */
  fits(g: number, len: number, s: number, out: number[] | null = null, ignore = -1, preferRooms: number[] | null = null, allowRelocate = false): boolean {
    const cp = this.cp
    const { S, D } = cp
    const G = cp.groups[g]
    if (!G.valid) return false
    const s2 = this.second(len, s)
    if (s2 < 0) return false
    for (const t of G.teachers) {
      if (!cp.teacherOk[t * S + s] || !cp.teacherOk[t * S + s2]) return false
      const a = this.teacherAt[t * S + s]
      const b = this.teacherAt[t * S + s2]
      if ((a >= 0 && a !== ignore) || (b >= 0 && b !== ignore)) return false
    }
    for (const c of G.classes) {
      if (!cp.classOk[c * S + s] || !cp.classOk[c * S + s2]) return false
      const a = this.classAt[c * S + s]
      const b = this.classAt[c * S + s2]
      if ((a >= 0 && a !== ignore) || (b >= 0 && b !== ignore)) return false
    }
    const d = cp.slots.slotDay[s]
    const ign = ignore >= 0 ? ignore : -1
    for (const t of G.teachers) {
      let day = this.teacherDay[t * D + d]
      let tot = this.teacherTotal[t]
      if (ign >= 0 && this.sstart[ign] >= 0 && cp.groups[this.sg[ign]].teachers.includes(t)) {
        tot -= this.slen[ign]
        if (cp.slots.slotDay[this.sstart[ign]] === d) day -= this.slen[ign]
      }
      if (day + len > cp.teacherDailyCap[t] || tot + len > cp.teacherWeeklyCap[t]) return false
    }
    // rooms
    const room = G.room
    if (room.kind === 'none') { if (out) out.length = 0; return true }
    if (room.kind === 'invalid') return false
    const chosen = this.chosen
    chosen.length = 0
    if (out) this.relocations.length = 0
    for (let k = 0; k < G.classes.length; k++) {
      let r = -1
      if (room.kind === 'homeroom') {
        r = cp.classHomeroom[G.classes[k]]
        if (r < 0) return false
        if (!chosen.includes(r) && !this.roomFree(r, s, s2, ign) && !(allowRelocate && this.augment([r], s, s2, chosen, out !== null) === r)) return false
      } else if (room.kind === 'room') {
        r = room.room
        if (!chosen.includes(r) && !this.roomFree(r, s, s2, ign) && !(allowRelocate && this.augment([r], s, s2, chosen, out !== null) === r)) return false
      } else {
        const pref = preferRooms?.[k] ?? -1
        if (pref >= 0 && room.rooms.includes(pref) && !chosen.includes(pref) && this.roomFree(pref, s, s2, ign)) r = pref
        else {
          for (const cand of room.rooms) {
            if (!chosen.includes(cand) && this.roomFree(cand, s, s2, ign)) { r = cand; break }
          }
        }
        if (r < 0 && allowRelocate) r = this.augment(room.rooms, s, s2, chosen, out !== null)
        if (r < 0) return false
      }
      chosen.push(r)
    }
    if (out) { out.length = 0; for (const r of chosen) out.push(r) }
    return true
  }

  /**
   * Bipartite-matching augmenting path of length 1: find a room `r` among
   * `wanted` (a type's rooms, or a single homeroom/fixed room) whose occupant (in slot s or s2) can move to another free room
   * of its own required type, freeing `r`. Returns r or -1; records the move
   * when `record` is set (applied by the next `place`).
   */
  private augment(wanted: number[], s: number, s2: number, chosen: number[], record: boolean): number {
    const cp = this.cp
    const { S } = cp
    for (const r of wanted) {
      if (chosen.includes(r) || !cp.roomOk[r * S + s] || !cp.roomOk[r * S + s2]) continue
      const occ = new Set([this.roomAt[r * S + s], this.roomAt[r * S + s2]].filter((k) => k >= 0))
      if (occ.size !== 1) continue
      const k = [...occ][0]
      const Gk = cp.groups[this.sg[k]]
      if (Gk.room.kind !== 'type') continue
      const ks = this.sstart[k]
      const ks2 = this.second(this.slen[k], ks)
      // the other slot of the wanted pair must be free in r (or held by k too)
      const other = this.roomAt[r * S + (this.roomAt[r * S + s] === k ? s2 : s)]
      if (other >= 0 && other !== k) continue
      for (const alt of Gk.room.rooms) {
        if (alt === r || this.srooms[k].includes(alt) || chosen.includes(alt)) continue
        if (!this.roomFree(alt, ks, ks2, -1)) continue
        if (alt === r) continue
        if (record) this.relocations.push({ k, from: r, to: alt })
        return r
      }
    }
    return -1
  }

  private applyRelocations(): void {
    const { S } = this.cp
    for (const { k, from, to } of this.relocations) {
      const ks = this.sstart[k]
      const ks2 = this.second(this.slen[k], ks)
      this.roomAt[from * S + ks] = -1
      this.roomAt[from * S + ks2] = -1
      this.roomAt[to * S + ks] = k
      this.roomAt[to * S + ks2] = k
      this.srooms[k] = this.srooms[k].map((r) => (r === from ? to : r))
    }
    this.relocations.length = 0
  }

  place(i: number, s: number, rooms: number[]): void {
    const cp = this.cp
    const { S, D } = cp
    this.applyRelocations()
    const G = cp.groups[this.sg[i]]
    const len = this.slen[i]
    const s2 = this.second(len, s)
    this.sstart[i] = s
    this.srooms[i] = rooms.slice()
    const d = cp.slots.slotDay[s]
    for (const t of G.teachers) {
      this.teacherAt[t * S + s] = i
      this.teacherAt[t * S + s2] = i
      this.teacherDay[t * D + d] += len
      this.teacherTotal[t] += len
    }
    for (const c of G.classes) {
      this.classAt[c * S + s] = i
      this.classAt[c * S + s2] = i
    }
    for (const r of rooms) {
      this.roomAt[r * S + s] = i
      this.roomAt[r * S + s2] = i
    }
  }

  unplace(i: number): void {
    this.relocations.length = 0
    const cp = this.cp
    const { S, D } = cp
    const s = this.sstart[i]
    if (s < 0) return
    const G = cp.groups[this.sg[i]]
    const len = this.slen[i]
    const s2 = this.second(len, s)
    const d = cp.slots.slotDay[s]
    for (const t of G.teachers) {
      this.teacherAt[t * S + s] = -1
      this.teacherAt[t * S + s2] = -1
      this.teacherDay[t * D + d] -= len
      this.teacherTotal[t] -= len
    }
    for (const c of G.classes) {
      this.classAt[c * S + s] = -1
      this.classAt[c * S + s2] = -1
    }
    for (const r of this.srooms[i]) {
      this.roomAt[r * S + s] = -1
      this.roomAt[r * S + s2] = -1
    }
    this.sstart[i] = -1
    this.srooms[i] = []
  }
}

/** Expands valid groups into sessions: doubles first, then singles. */
export function buildSessions(cp: Compiled): { g: number; len: 1 | 2 }[] {
  const out: { g: number; len: 1 | 2 }[] = []
  cp.groups.forEach((G, g) => {
    for (let k = 0; k < G.doubles; k++) out.push({ g, len: 2 })
    for (let k = 0; k < G.singles; k++) out.push({ g, len: 1 })
  })
  return out
}
