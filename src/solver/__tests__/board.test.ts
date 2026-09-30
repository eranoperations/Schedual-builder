import { describe, expect, it } from 'vitest'
import { scoped } from '../../model/defaults'
import { tinySchool, slotId } from '../../test/fixtures'
import { Board, buildSessions } from '../board'
import { compile } from '../compile'

describe('Board room matching', () => {
  it('frees a specific room by moving a type-room occupant (augmenting path)', () => {
    const d = tinySchool()
    const LAB2 = { ...scoped(d.school.id), name: 'LAB2', roomTypeId: d.ids.lab }
    d.rooms.push(LAB2)
    // gX needs exactly LAB (by id); gSci needs any lab.
    const gX = { ...scoped(d.school.id), subjectId: d.ids.math, teacherIds: [d.ids.T1], classIds: [d.ids.C2], weeklyHours: 1, doubles: 0, room: { roomId: d.ids.LAB }, clusterId: null, level: null }
    d.groups = [d.groups.find((g) => g.id === d.ids.gSci)!, gX]
    const cp = compile(d)
    const sessions = buildSessions(cp)
    const board = new Board(cp, sessions)
    const s0 = cp.slots.slotOf(0, slotId(d, 0, 1))
    const LAB = cp.roomIdx.get(d.ids.LAB)!
    const L2 = cp.roomIdx.get(LAB2.id)!
    const out: number[] = []
    // Place the science double on Sun P1–P2: greedy picks LAB first.
    expect(board.fits(0, 2, s0, out)).toBe(true)
    board.place(0, s0, out.slice())
    expect(board.srooms[0]).toEqual([LAB])
    // Without relocation gX cannot go to Sun P1; with it, science moves to LAB2.
    expect(board.fits(1, 1, s0)).toBe(false)
    expect(board.fits(1, 1, s0, out, -1, null, true)).toBe(true)
    board.place(1, s0, out.slice())
    expect(board.srooms[1]).toEqual([LAB])
    expect(board.srooms[0]).toEqual([L2])
    const S = cp.S
    expect(board.roomAt[L2 * S + s0]).toBe(0)
    expect(board.roomAt[L2 * S + cp.slots.nextJoin[s0]]).toBe(0)
    expect(board.roomAt[LAB * S + s0]).toBe(1)
    expect(board.roomAt[LAB * S + cp.slots.nextJoin[s0]]).toBe(-1)
  })
})
