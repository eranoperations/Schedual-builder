# Solver & checker API

Stable interface of the timetable engine. Everything here is **pure TypeScript with no DOM,
storage or network access** — it runs unchanged in Node (tests, benchmarks, `tsx`), in the
browser main thread and in the Web Worker.

| What | Path |
|---|---|
| Data model types (input/output shapes) | `src/model/types.ts` |
| Public solver/checker entry point | `src/solver/index.ts` |
| Defaults (`defaultSolverOptions`, `newSchool`, `scoped`) | `src/model/defaults.ts` |
| Week / bell-schedule helpers | `src/model/week.ts` |
| Rules / preferences defaults | `src/model/rules.ts`, `src/model/preferences.ts` |
| Sample data (`sampleSchoolProject`, `largeSampleSchoolProject`) | `src/model/sample.ts` |
| Test fixture (`tinySchool`, `validTinyTimetable`) | `src/test/fixtures.ts` |

```ts
import { solve, verifyTimetable, validate, canMove } from './src/solver'
import { sampleSchoolProject } from './src/model/sample'

const data = sampleSchoolProject()          // a SchoolProject is also a SchoolSnapshot
const result = solve(data, { seed: 1 })     // synchronous
const report = verifyTimetable(data, result.lessons)
console.log(result.status, report.ok, result.stats.elapsedMs)
```

Run from Node with `npx tsx script.ts` (the repo is ESM; `tsx` is a devDependency).

---

## 1. Functions

All functions are pure: they never mutate their inputs and depend only on their arguments
(plus the wall clock, used only for `timeLimitMs`). With the same input and `seed`, the
result is deterministic as long as the time limit isn't hit.

```ts
// src/solver/solver.ts
function solve(data: SchoolSnapshot, options?: Partial<SolverOptions>, hooks?: SolveHooks): SolveResult
function solveAsync(data: SchoolSnapshot, options?: Partial<SolverOptions>, hooks?: SolveHooks, sliceMs?: number /* 50 */): Promise<SolveResult>
function solveSteps(data: SchoolSnapshot, options?: Partial<SolverOptions>, shouldCancel?: () => boolean): Generator<SolveProgress, SolveResult>

// src/solver/validate.ts — pre-solve validation (runs inside solve too)
function validate(data: SchoolSnapshot): Issue[]
function hasBlockingErrors(issues: Issue[]): boolean          // any severity === 'error'

// src/solver/verify.ts — independent hard-constraint checker (shares no code with the search)
function verifyTimetable(data: SchoolSnapshot, lessons: Lesson[]): VerificationReport
const HARD_CHECKERS: Record<string, (data: SchoolSnapshot, lessons: Lesson[]) => Issue[]>
function teacherLoads(data: SchoolSnapshot, lessons: Lesson[]): TeacherLoad[]
function canMove(data: SchoolSnapshot, lessons: Lesson[], lesson: Lesson,
                 targetDay: Weekday, targetSlotIds: string[], targetRoomIds?: string[] /* default: lesson.roomIds */): MoveCheck

// src/solver/quality.ts — soft metrics
function softScore(data: SchoolSnapshot, lessons: Lesson[], weights?: SoftWeights): SoftScore   // equals the optimiser's objective
function softMetrics(data: SchoolSnapshot, lessons: Lesson[], maxPerDay?: number): {...}
function qualityReport(data: SchoolSnapshot, lessons: Lesson[], initialLessons?: Lesson[]): QualityMetric[]
```

Hook and helper types:

```ts
interface SolveHooks {
  onProgress?: (p: SolveProgress) => void
  shouldCancel?: () => boolean        // polled often; true => stop and return best-so-far with status 'cancelled'
}
interface SolveProgress {
  phase: 'validate' | 'place' | 'optimize' | 'done'
  percent: number                     // 0..100 overall
  placed?: number; total?: number; attempt?: number
  iteration?: number; iterations?: number; score?: number; pending?: number
}
interface VerificationReport {
  ok: boolean                         // hardViolations.length === 0
  hardViolations: Issue[]             // V_* codes
  hardByChecker: Record<string, number>   // per HARD_CHECKERS key
  info: Issue[]                       // e.g. I_TEACHER_UNDER_MAX (allowed, never a violation)
}
interface TeacherLoad { teacherId: string; assigned: number; max: number; daily: Partial<Record<Weekday, number>> }
interface MoveCheck { ok: boolean; violations: Issue[] }   // only violations the move would ADD
```

`canMove` is the pure move check reserved for future drag & drop: it replaces `lesson` (by
identity within `lessons`; if it isn't found it's treated as a new lesson) and returns only
the hard violations that are new compared with the current state.

`solveAsync` is what the Web Worker uses (`src/worker/solver.worker.ts`). It yields to the
event loop every `sliceMs` so a cancel message can arrive, and reports progress at the same
rate. `solve` is the synchronous wrapper for Node and tests. `solveSteps` is the underlying
generator if you want to drive it yourself.

---

## 2. Input: `SchoolSnapshot` (JSON)

```jsonc
{
  "school": {
    "id": "uuid", "name": "…", "createdAt": "ISO", "updatedAt": "ISO",
    "week": {
      "days": [0,1,2,3,4],                               // 0 = Sunday … 6 = Saturday
      "bellSchedules": [{ "id": "uuid", "name": "Regular", "slots": [
        { "id": "uuid", "index": 1, "type": "lesson", "start": "08:00", "end": "08:45", "joinableWithNext": true },
        { "id": "uuid", "index": 2, "type": "lesson", "start": "08:45", "end": "09:30", "joinableWithNext": false },
        { "id": "uuid", "index": 2, "type": "break",  "start": "09:30", "end": "09:45", "joinableWithNext": false }
      ]}],
      "dayBellSchedule": { "0": "bellScheduleId", "1": "…" }
    },
    "rules": { "maxTeacherDailyHours": 6, "maxJoinedLessonMinutes": 100, "allowZeroHour": false },
    "preferences": { "avoidTeacherGaps": true, "compactClassDays": true, "spreadSubjects": true,
                     "balanceTeacherLoad": false, "respectSoftBlocks": true }
  },
  "roomTypes": [{ "id", "schoolId", "name" }],
  "rooms":     [{ "id", "schoolId", "name", "roomTypeId", "capacity?" }],
  "subjects":  [{ "id", "schoolId", "name", "color": "#hex",
                  "defaultRoom": "homeroom" | "none" | { "roomTypeId": "…" } }],
  "teachers":  [{ "id", "schoolId", "name", "maxWeeklyHours": 24, "maxDailyHours?": 6,
                  "subjectIds": ["…"], "dayOff": 3 }],
  "classes":   [{ "id", "schoolId", "grade": 7, "parallel": 1, "displayName": "ז'1",
                  "homeroomRoomId": "…" | null, "homeroomTeacherId?": "…" | null }],
  "groups":    [{ "id", "schoolId", "subjectId", "teacherIds": ["…"], "classIds": ["…"],
                  "weeklyHours": 5, "doubles": 1,
                  "room?": "homeroom" | "none" | { "roomTypeId": "…" } | { "roomId": "…" },
                  "clusterId?": null, "level?": null }],
  "blocks":    [{ "id", "schoolId", "target": { "type": "teacher|class|room|grade|school", "id?": "…" },
                  "when": [{ "day": 0, "slotIds?": ["…"] }], "hardness": "hard" | "soft", "note?": "" }],
  "clusters":  []                                         // reserved; triggers W_CLUSTERS_NOT_SUPPORTED
}
```

Every record also has `createdAt`/`updatedAt` (ignored by the solver). A `SchoolProject`
(the per-school export) is a `SchoolSnapshot` plus `timetables[]`, and can be passed directly.

What the solver treats as hard (spec §3.1–3.2):
- no teacher, class or room clash
- each group gets exactly `weeklyHours`, with exactly `doubles` doubles placed on joinable
  consecutive pairs whose span is ≤ `maxJoinedLessonMinutes`
- only lesson slots on teaching days; zero hour only if `allowZeroHour`
- teachers are qualified for the group's subject and never work on their `dayOff`
- a teacher's total hours are ≤ `maxWeeklyHours` (X is a **maximum**)
- a teacher's hours per day are ≤ `maxDailyHours ?? rules.maxTeacherDailyHours`
- rooms meet the requirement: one room per class of the group, homeroom / type / specific
- hard blocks are respected

Soft (the optimiser's objective): the preference keys, with fixed internal weights
(`INTERNAL_WEIGHTS` in `src/model/preferences.ts`).

## 3. Options

```ts
interface SolverOptions {
  seed: number               // default 1
  timeLimitMs: number        // default 30000 — wall-clock cap for the whole solve
  optimizeIterations: number // default 300000 — simulated-annealing budget (0 = no optimisation)
  maxAttempts: number        // default 60 — placement restarts (Luby schedule)
  weights?: Partial<SoftWeights>  // override internal soft weights (benchmarks/tests only)
}
```

All options are optional (`Partial<SolverOptions>`). Missing ones come from `defaultSolverOptions()`.

## 4. Output: `SolveResult` (JSON)

```jsonc
{
  "status": "complete" | "infeasible" | "incomplete" | "cancelled",
  "lessons": [{ "studyGroupId": "…", "day": 0, "slotIds": ["slotId"] /* 2 for a double */,
                "roomIds": ["roomId"] /* one per classIds entry; [] if no room */,
                "teacherIds": ["teacherId"] /* resolved teachers; always set by the solver */, "pinned": false }],
  "teacherAssignments": { "<studyGroupId>": ["teacherId"] }, // resolved teachers of every group (fixed or auto)
  "unplaced": [{ "studyGroupId": "…", "length": 1 | 2, "count": 2, "reason": Issue }],
  "reasons": [Issue],                 // blocking validation errors; non-empty only if status = infeasible
  "qualityReport": [{ "key": "avoidTeacherGaps", "enabled": true, "count": 5, "initialCount": 74,
                      "affected": [{ "kind": "teacher" | "class" | "group", "id": "…", "count": 2 }] }],
  "stats": { "seed", "elapsedMs", "placementMs", "optimizeMs", "placementNodes", "placementAttempts",
             "saIterations", "initialSoftScore", "finalSoftScore", "cancelled", "timedOut",
             "totalHours", "placedHours" },
  "dataFingerprint": "hash of the solver input (to flag a stale timetable)"
}
```

**Invariant:** every returned lesson satisfies all hard constraints, even when the status
isn't `complete`. The result is always a valid (possibly partial) timetable.
`verifyTimetable(data, result.lessons).hardViolations` is empty, apart from `V_GROUP_HOURS` /
`V_GROUP_DOUBLES` for unplaced lessons.

## 5. How infeasibility is reported

| status | meaning | where to look |
|---|---|---|
| `complete` | all lessons placed, all hard constraints met | `qualityReport` |
| `infeasible` | **proven** impossible by the validator's necessary-condition checks. The search is **skipped** (returns in milliseconds) and `lessons` is **empty** | `reasons` (error `Issue`s) |
| `incomplete` | not proven impossible, but not solved within `maxAttempts`/`timeLimitMs`; best partial returned | `unplaced[].reason` |
| `cancelled` | `shouldCancel()` returned true; best-so-far returned | `unplaced` |

`Issue = { code, severity: 'error'|'warning'|'info', params, ref?: { kind, id? } }`. Issues are
language-neutral: `code` selects an i18n template (`issues.<CODE>` in `src/i18n/*.json`),
`params` fill it in (names are already resolved; `day` is a weekday index; `period` is the
displayed period number), and `ref` points to the record to fix (the UI links to it).

Code families:
- **`E_*`** (validation errors, blocking → `infeasible`):
  - week: `E_WEEK_*`, `E_BELL_*`
  - groups: `E_GROUP_NO_TEACHER` (fixed group lost its teacher), `E_GROUP_NO_QUALIFIED_TEACHER` (auto group, nobody teaches the subject), `E_GROUP_TEACHER_NOT_QUALIFIED`, `E_GROUP_HOURS_INVALID`,
    `E_GROUP_DOUBLES_INVALID`, `E_GROUP_NO_JOINABLE_PAIR`, `E_GROUP_NO_MATCHING_ROOM`,
    `E_GROUP_NOT_ENOUGH_SLOTS`, …
  - teacher capacity pre-checks, which replace a separate teacher-assignment stage:
    `E_TEACHER_OVER_X` (assigned load > X), `E_TEACHER_DAILY_CAPACITY` (load > daily max ×
    working days), `E_TEACHER_SLOT_CAPACITY` (load > available slots after day off and hard
    blocks), `E_TEACHER_DAY_OFF_INVALID` (includes a day off on a non-teaching day)
  - auto teachers: `E_SUBJECT_AUTO_CAPACITY {subject, hours, free}` (qualified teachers' free
    hours per subject), `E_AUTO_ASSIGNMENT_INFEASIBLE {hours, assignable, missing}` (max-flow over
    shared teachers; only reported when no per-subject shortfall was found)
  - classes: `E_CLASS_OVER_SLOTS`, `E_CLASS_NO_HOMEROOM`
  - rooms: `E_ROOM_TYPE_CAPACITY` (also when a required room type has zero usable rooms), `E_ROOM_CAPACITY`
- **`W_*`** (warnings, non-blocking): `W_BLOCK_REMOVED_DAY/SLOT`, `W_BLOCK_UNKNOWN_TARGET`,
  `W_CLUSTERS_NOT_SUPPORTED`, `W_GROUP_SPREAD`, `W_DUPLICATE_NAME`, `W_SHARED_HOMEROOM`, …
- **`I_*`** (info): `I_TEACHER_UNDER_X` / `I_TEACHER_UNDER_MAX` (below X is allowed),
  `I_CLASS_NO_GROUPS`, `I_TEACHER_NO_GROUPS`.
- **`U_*`** (reason for an unplaced lesson): `U_NO_COMMON_SLOT`, `U_NO_JOINABLE_PAIR`,
  `U_TEACHER_CAP`, `U_NO_ROOM_OR_SEARCH_LIMIT`, `U_GROUP_INVALID`, `U_NO_TEACHER_AVAILABLE`.
- **`V_*`** (checker violations): `V_TEACHER_CLASH`, `V_CLASS_CLASH`, `V_ROOM_CLASH`,
  `V_GROUP_HOURS`, `V_GROUP_DOUBLES`, `V_INVALID_DOUBLE`, `V_INVALID_SLOT`,
  `V_NOT_TEACHING_DAY`, `V_ZERO_HOUR`, `V_LESSON_LENGTH`, `V_TEACHER_NOT_QUALIFIED`,
  `V_TEACHER_DAY_OFF`, `V_TEACHER_WEEKLY_CAP`, `V_TEACHER_DAILY_CAP`, `V_ROOM_REQUIREMENT`,
  `V_ROOM_COUNT`, `V_ROOM_NOT_EXPECTED`, `V_HARD_BLOCK`, `V_CLUSTER_MISMATCH`,
  `V_UNKNOWN_GROUP`, `V_GROUP_NO_TEACHER`, `V_FIXED_TEACHER_CHANGED`, `V_GROUP_TEACHER_INCONSISTENT`.

## 6. Algorithm (for reference)

1. **Validate:** `validate()`. If there are blocking errors the status is `infeasible` and the
   solver stops immediately (no placement, no optimisation, `lessons: []`). Fixed-teacher checks
   (qualification, weekly X, daily capacity) are validator pre-checks; auto groups are checked
   with per-subject capacity and a max-flow relaxation (Dinic).
2. **Assign auto teachers (v0.5.1):** a group with `teacherIds: []` is "Auto". A greedy pass
   (most-constrained, largest first, preference tie-breaks, one-level repair) picks a qualified
   teacher within each teacher's free capacity (min(X, daily max × days, unblocked slots) − fixed
   load). Between failed placement attempts, `reassignForConflicts` moves the auto group whose
   teacher is in the most conflicts. The teacher choice is fixed during optimisation.
2b. **Compile:** turn everything into dense integer arrays. Usable lesson slots are indexed
   `0..S-1` with a `nextJoin` table. Blocks are folded into per-resource availability arrays
   (hard) and penalty arrays (soft).
3. **Place:** a DFS over sessions (a single or a double of a group) using MRV (fewest feasible
   starts first), forward checking on class/teacher remaining capacity, randomised value
   ordering, and Luby restarts. Rooms are assigned **in the same step**. For each candidate
   slot, rooms are matched greedily (homeroom / specific room / first free room of the
   type), with a length-1 augmenting path: an occupant of a needed room is moved to another
   free room of its own type. This is a partial per-slot bipartite matching; full
   Hopcroft–Karp re-matching isn't done.
4. **Optimise:** simulated annealing over the hard-feasible board, with relocate moves and
   same-class swaps. The move check is incremental and uses occupancy arrays. The objective
   equals `softScore()`.
5. **Report:** `toLessons`, unplaced diagnosis (`U_*`), `qualityReport`, `stats`.

Measured on the box (Node 20, seed 1, default options):

| dataset | groups / hours | status | time | soft score (initial → final) |
|---|---|---|---|---|
| `sampleSchoolProject()` (9 classes) | 117 / 321 | complete | ~0.5 s | 237 → 15 |
| `largeSampleSchoolProject('sunThu')` (24 classes) | 312 / 856 | complete | ~0.9 s | 679 → 121 |
| `largeSampleSchoolProject('sunFri')` (24 classes) | 312 / 856 | complete | ~1.0 s | 504 → 17 |

All three pass `verifyTimetable` with 0 hard violations.

## 7. Note for QA adapters

`qa/adapters/app-v05.ts` pre-assigns teachers to every group. Since v0.5.1 it may leave
`teacherIds: []` on a group (Auto) and read the chosen teachers from `result.teacherAssignments`
or `lesson.teacherIds`. Also note that an `infeasible` result now has no lessons.

## 8. Stability

The names, signatures and JSON shapes above are the stable interface. Anything not exported
from `src/solver/index.ts` (`compile`, `Board`, `place`, `optimize`) is internal and may change.
New optional fields may be added to results; existing fields won't change meaning without a
`schemaVersion` bump in the project export.
