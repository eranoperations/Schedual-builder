# Product Spec: School Timetable Builder

Status: draft v0.5 (2026-09-30) · Owner: Product Bot · Items still open are marked **[OPEN]**.
**Freeze:** sections 2, 3 and 5 are frozen at v0.5 until the first working solve. Later changes are queued in section 9 and released together as v0.6.
Background research: `/workspace/research/israeli-school-timetable.md` (cited below as [R §n]).

## 0. Decisions

**From Eran**
- The product serves many schools. The MVP stays lean (no accounts, local storage), but the data model is multi-school from day one.
- Middle schools (grades 7 to 9) come first.
- The product is generic, and each school configures its own week, bell schedule and rules. Sun to Thu is only a default template.
- Teachers teach **up to** X weekly hours. Every teacher has exactly one day off.
- The UI is Hebrew first (RTL) with English as a second language, and i18n is built in from day one.
- Soft preferences are in the MVP as per-school on/off toggles.
- Level groups and clusters (הקבצות/אשכולות) come in a later phase, but the model must allow them without a rewrite.

**v0.5 changes (research folded in, requested via Master Bot)**
- The unit that gets scheduled is now the **study group** (קבוצת לימוד) = subject + teacher(s) + class(es) + weekly hours, not "class × subject hours" [R §2].
- Bell schedules are explicit lists of slots with real start and end times. A school can have several and assign one to each day (e.g. a short Friday). Double periods are supported [R §1].
- There are per-school **rules** (max teacher hours per day, default 6 [R §5]) and **blocks** (חסמים) for teachers, classes, rooms, grades and the whole school, each marked hard or soft [R §5–6].
- Each class has a **homeroom** (כיתת אם). **Room types** are defined by each school [R §4].

## 1. Problem and goal

Building a weekly timetable (מערכת שעות) for an Israeli school is done by hand or in legacy desktop tools. It takes days and breaks every time a teacher's availability changes. The goal is a web product for many schools. A school's scheduler (משבץ) sets up the week, rooms, teachers, classes and study groups, clicks **Generate**, and gets a valid weekly timetable that respects every hard constraint and scores well on the school's preferences. If that's impossible, the app explains why.

**First target segment:** middle schools (חטיבות ביניים, grades 7 to 9).
**Primary user:** the school's timetable coordinator (usually a deputy principal or dedicated scheduler).
**Secondary users (later):** school admins, teachers, and students/parents viewing their timetables.

**Israeli context to respect** [R §1]: 6-day weeks are the legal default, and many secondary schools run 5 days. Friday is usually short. 45 minutes is the usual period length, but schools set their own, and many use 50-minute early periods. A joined lesson may not exceed 100 minutes. Some schools use a "zero hour" (שעה אפס) before period 1.

## 2. Data model (multi-school from day one)

Every record has a UUID `id` generated client-side and a `schoolId` (except `School`), plus `createdAt`/`updatedAt`. Entities marked *(reserved)* are defined in the types and export format now but get no UI or solver support until a later phase. This lets clusters and multi-class groups arrive without a migration.

| Entity | Fields (MVP) |
|---|---|
| **School** | id, name, optional institutionCode (סמל מוסד), `week` (2.1), `rules` (3.2), `preferences` (3.3) |
| **RoomType** | id, schoolId, name. Defined by the school. A new school is seeded with editable suggestions: classroom, science lab, computer room, gym, art room, music room, library |
| **Room** | id, schoolId, name, roomTypeId, optional capacity |
| **Subject** | id, schoolId, name, optional ministryCode, colour, `defaultRoom`: `homeroom` \| `{ roomTypeId }` \| `none` (online/outdoor, no room needed) |
| **Teacher** | id, schoolId, name, maxWeeklyHours (X, an upper limit), optional maxDailyHours (overrides the school rule, e.g. the teacher agreed to 7), subjectIds they can teach, dayOff (exactly one of the school's teaching days, required) |
| **Class** (כיתת אם) | id, schoolId, grade (integer 7 to 9), parallel (integer), displayName (auto-formatted, e.g. ז'3, editable), homeroomRoomId, optional homeroomTeacherId |
| **StudyGroup** (קבוצת לימוד) | id, schoolId, subjectId, `teacherIds[]`, `classIds[]`, weeklyHours, `doubles` (how many of the weekly hours must be taught as double periods, default 0), optional `room` override (same shape as Subject.defaultRoom, or `{ roomId }` for a specific room), `clusterId` *(reserved)*, `level` *(reserved)*. **MVP UI: exactly one teacher and one class per group.** The solver and checker handle arrays from day one. |
| **Cluster** *(reserved)* | id, schoolId, name, studyGroupIds[]. All member groups must be placed in identical slots (for level groups and majors) |
| **Block** (חסם) | id, schoolId, target `{ type: teacher \| class \| room \| grade \| school, id? }`, `when`: list of `{ day, slotIds? }` (no slotIds = whole day), hardness `hard` \| `soft`, optional note |
| **Timetable** | id, schoolId, name, createdAt, status (draft or accepted), lessons[], qualityReport |
| **Lesson** (placed) | studyGroupId, day, slotIds[] (one slot, or two for a double), roomIds[] (one per class, empty if no room is needed), `pinned` *(reserved)* |

A class's weekly hours equal the sum of its study groups' hours. A teacher's weekly hours equal the sum of their groups' hours. In the MVP, X counts teaching (frontal) hours only. Individual and stay hours arrive with reform-aware positions later [R §3]. **[OPEN]**

### 2.1 Week and bell schedules (configurable per school)

```
week: {
  days: Weekday[]                         // any subset of Sun..Sat, Sunday-first order
  bellSchedules: BellSchedule[]           // at least one
  dayBellSchedule: { [day]: bellScheduleId }
}
BellSchedule: { id, name, slots: Slot[] }
Slot: {
  id                                      // stable, so blocks and lessons survive edits
  index: number                           // period number as shown (0 = zero hour, then 1, 2, ...)
  type: "lesson" | "break"
  start: "HH:MM", end: "HH:MM"            // explicit times, lengths may differ between slots
  joinableWithNext: boolean               // lesson slots only: can form a double with the next lesson slot
}
```

- **Explicit slots, generated from a pattern.** The scheduler can generate a bell schedule from start time, period length, breaks (after period N, M minutes) and end time, then edit any slot's times, add or remove slots, or add a zero hour. The stored truth is the explicit slot list [R §1].
- **Per-day schedules.** Each teaching day points to one bell schedule, so a short Friday is just a second schedule.
- **Doubles.** Two consecutive lesson slots form a double only if the first is `joinableWithNext`. A lesson slot followed by a break isn't joinable by default, but the school can allow it. The span from the first slot's start to the second slot's end may not exceed `rules.maxJoinedLessonMinutes` (default 100).
- **Zero hour.** Lesson slots with index 0 are used only when `rules.allowZeroHour` is on (default off).
- **Validation:** slots in ascending order with no overlap, start before end, at least one lesson slot per teaching day, and the max-joined check on joinable pairs.
- **Templates at school creation:**
  - *Sun to Thu* (default): 08:00 start, 45-minute periods, breaks of 20 minutes after P2, 15 after P4 and 10 after P6, giving 8 periods ending 14:45. P1–2, P3–4, P5–6 and P7–8 are joinable.
  - *Sun to Fri, short Friday*: the same, plus a Friday schedule of P1–P5 ending 12:20.
- **References:** blocks and lessons point to `slotId`. When a slot or day is removed, anything pointing to it is flagged for the user and never silently dropped.

### 2.2 Architecture seams
- **Storage:** all reads and writes go through one repository interface scoped by `schoolId` (e.g. `SchoolRepository`). The MVP uses localStorage/IndexedDB, and phase 2 swaps in a cloud API.
- **Solver:** a pure function `(schoolSnapshot) → { timetable, qualityReport } | { infeasible, reasons }`, running in a Web Worker. A separate pure **checker** validates any timetable against section 3.
- **Export:** a JSON project file holds one school and all its records, plus `schemaVersion`. Reserved fields are included.

## 3. Constraints

### 3.1 Hard constraints (never violated)
1. **No clashes:** in any slot, each teacher, class and room is in at most one lesson. A lesson occupies all of its group's teachers and classes.
2. **Hours:** each study group gets exactly `weeklyHours`, with exactly `doubles` double lessons and the rest as singles.
3. **Doubles:** a double uses two consecutive lesson slots on the same day, the first marked joinable, spanning no more than `maxJoinedLessonMinutes`.
4. **Valid slots:** lessons go only in lesson slots on teaching days. Zero-hour slots are used only if allowed.
5. **Qualification:** every teacher of a group is qualified for its subject.
6. **Day off:** a teacher never teaches on their day off.
7. **Weekly cap:** a teacher's placed hours are at most X.
8. **Daily cap:** a teacher's placed hours per day are at most their maxDailyHours, which defaults to `rules.maxTeacherDailyHours` (default 6) [R §5].
9. **Rooms:** each class in a lesson gets a room that satisfies the group's room requirement (its own homeroom, any free room of the required type, the specific room, or none). The room must be free and not hard-blocked.
10. **Hard blocks:** no lesson in a slot or day that is hard-blocked for any of its teachers, classes, rooms, their grade, or the whole school.
11. *(Reserved, enforced when clusters ship)* All groups of a cluster occupy identical slots.

### 3.2 School rules (per-school settings, hard)
`rules = { maxTeacherDailyHours: 6, maxJoinedLessonMinutes: 100, allowZeroHour: false }`. A missing key means the default. New rules can be added later without a migration.

### 3.3 Soft preferences (per-school toggles)
Soft preferences never override a hard constraint. When they can't be met fully, the timetable is still produced and the shortfall shows up in the quality report. The MVP uses fixed internal weights, and user weights come later.

| Key | Preference | Default | Measured as |
|---|---|---|---|
| `avoidTeacherGaps` | Avoid free periods between a teacher's lessons on the same day (חלונות) | On | Teacher gap periods |
| `compactClassDays` | Classes have no gaps and start at the first regular lesson slot | On | Class gap periods plus late starts |
| `spreadSubjects` | Spread a group's hours across different days: at most 2 hours per day, and a double counts as one session | On | Group-days over the limit |
| `balanceTeacherLoad` | Spread a teacher's hours evenly across their working days | Off | Deviation from the teacher's average daily load |
| `respectSoftBlocks` | Avoid slots that are soft-blocked | On | Lessons in soft-blocked slots |

`preferences = { [key]: boolean }`, and a missing key means the default. After each solve the **quality report** lists each enabled preference with its count and links to the affected teachers, classes or groups.

## 4. Scope and roadmap

### Phase 1: MVP
- One school per local project, one user, no login. Data stays in the browser, with JSON export/import. The multi-school model and repository seam sit underneath.
- School setup: teaching days, bell schedules (generate from a pattern, then edit slots), per-day assignment, zero hour, joinable pairs, and the two templates.
- Room types and rooms. Subjects with a default room requirement.
- Teachers: X, optional daily cap override, subjects, day off.
- Classes with grade, parallel, auto display name, homeroom and optional homeroom teacher.
- **Planning sheet (סדין):** a classes × subjects grid where each cell is a study group (teacher, hours, doubles, room override), with live totals per class and per teacher [R §6].
- Blocks (hard or soft) for teachers, classes, rooms, grades and the whole school. School rules. Soft preference toggles.
- Validation checks before solving.
- A solver in a Web Worker with progress and cancel. It also assigns rooms.
- Infeasibility explanations. A quality report.
- Views by class, teacher and room. Print/PDF.
- i18n: Hebrew (RTL, default) and English (LTR), with Hebrew terms taken from the research glossary [R §7].
- A demo middle school.

### Phase 1.5: Manual editing (v0.6, right after the first working solve)
- Move and swap lessons by drag and drop, plus a keyboard-accessible "Move to" dialog.
- Lock (pin) lessons and re-solve the rest around them.
- A "why can't this go here?" explanation on invalid targets.
- See section 9 for the full v0.6 list.

### Phase 2: Accounts and multi-school (next)
- Sign-up/login. Organization = school, and users can belong to several schools with a school switcher.
- Roles: school admin and scheduler.
- Cloud storage behind the same repository interface. Local projects can be imported into an account.
- Server-side per-school isolation, plus a privacy review (teacher personal data).
- Multiple saved timetable versions per school (e.g. semester A/B, a temporary timetable).

### Phase 3+: Later
- **Clusters and level groups (הקבצות):** multi-class and multi-teacher study groups in the UI, clusters placed in identical slots, and grade blocks (גושים) [R §2].
- Reform-aware teacher positions (Ofek Hadash / Oz LaTmura): individual and stay hours, age and mother reductions, and gaps filled with stay hours [R §3].
- More preferences and user weights: prefer doubles, core subjects early, homeroom teacher teaches period 1, teacher preferred days and slots.
- Per-grade bell schedules and week overrides.
- Curriculum validation against Ministry hour tables. Ministry subject codes.
- Elementary and high school support (majors, bagrut units).
- Teacher self-service constraints via a link. Read-only views for teachers, students and parents. iCal export.
- Day-to-day changes: absences, substitutions, cancellations, merges, payments [R §6].
- Excel import/export. Mashov and Ministry export. **[OPEN]**
- Arabic locale (RTL).

## 5. MVP user stories and acceptance criteria

**US-1: Set up the week and bell schedules**
As a scheduler, I want to define my teaching days and bell schedules so the timetable matches how my school runs.
- AC1: Creating a school offers the two templates (Sun to Thu, and Sun to Fri with a short Friday). Sun to Thu is preselected.
- AC2: I can choose any subset of weekdays as teaching days.
- AC3: I can generate a bell schedule from start time, period length, breaks and end time, then edit each slot's start and end, add or remove lesson and break slots, and add a zero hour.
- AC4: I can create several bell schedules and assign one to each teaching day.
- AC5: I can mark which consecutive lesson slots are joinable for doubles. Pairs longer than the max joined length are rejected.
- AC6: Overlapping or out-of-order slots and days with no lesson slot are blocked with a clear message. Removing a slot or day flags any blocks and lessons that point to it.

**US-2: Room types and rooms**
As a scheduler, I want to define my own room types and rooms.
- AC1: A new school starts with an editable list of suggested room types, and I can add, rename and delete types.
- AC2: Each room has a name, a type and an optional capacity.
- AC3: Deleting a type or room in use asks for confirmation and shows where it's used.

**US-3: Subjects**
- AC1: I can add subjects with a name, a colour, an optional Ministry code and a default room requirement: homeroom, a room type, or no room.

**US-4: Teachers**
- AC1: I can set name, X (a positive integer), an optional personal daily cap, qualified subjects (at least one) and exactly one required day off from the teaching days.
- AC2: The teacher list shows live assigned hours against X, e.g. 18/22, with over-assignment highlighted.

**US-5: Classes**
- AC1: I can add a class with grade (7 to 9) and parallel number. The display name auto-fills (e.g. ז'3) and can be edited.
- AC2: I can set a homeroom (required if any of the class's groups use the homeroom) and an optional homeroom teacher.
- AC3: I can add a whole grade at once (e.g. grade 7, parallels 1 to 4), creating one class per parallel.

**US-6: Planning sheet (study groups)**
As a scheduler, I want to set who teaches what to which class, and how many hours, in one grid.
- AC1: The grid shows classes as rows and subjects as columns. Filling a cell with a teacher, weekly hours, a number of doubles and an optional room override creates a study group.
- AC2: Only teachers qualified for the subject are offered.
- AC3: Row totals (class hours against the lesson slots in its week) and teacher totals (against X) update live, and over-limit values are highlighted.
- AC4: I can copy one class's row to other classes in the same grade, then change teachers.
- AC5: Doubles × 2 can't exceed weekly hours.

**US-7: Blocks and rules**
As a scheduler, I want to mark when teachers, classes, rooms, grades or the whole school are unavailable, and set school-wide rules.
- AC1: On a day by slot grid, I can block single slots or whole days for a teacher, class, room, grade or the whole school, and mark each block hard or soft.
- AC2: Settings show the rules (max teacher hours per day, default 6; max joined lesson length, default 100 minutes; allow zero hour, default off) with defaults applied to new schools.

**US-8: Pre-solve validation**
- AC1: Generate first runs checks. Blocking errors are listed with links to the record to fix.
- AC2: The checks cover at least these cases:
  - a group whose teacher isn't qualified;
  - class hours greater than its available lesson slots;
  - teacher hours greater than X;
  - teacher hours greater than daily cap × working days, or greater than the unblocked slots on those days;
  - a room requirement with no matching room;
  - a class missing a homeroom;
  - doubles required but no joinable pairs on the teacher's working days;
  - a day off or block pointing to a removed day or slot.

**US-9: Generate a timetable**
- AC1: Every result passes the checker for all hard constraints in 3.1. This is enforced in tests and in the app after each solve.
- AC2: Rooms are assigned as part of the solve.
- AC3: A large middle school solves in under 60 seconds in a modern desktop browser, on both templates. The working target is 24 classes, 50 teachers, 35 rooms and about 250 study groups. **[OPEN: confirm size]**
- AC4: The UI stays responsive, shows progress and can be cancelled. On timeout the best valid timetable found so far is shown. Regenerating keeps the previous timetable until I accept the new one.

**US-10: Explain infeasibility**
- AC1: The message distinguishes "impossible" from "not found within the time limit".
- AC2: For impossible cases, at least one concrete conflict is named in plain language, e.g. "Dana: 26 hours but only 4 working days × 6 per day = 24".

**US-11: View timetables**
- AC1: A selector switches between class, teacher and room views.
- AC2: Columns are the teaching days in week order (Sunday on the right in Hebrew) and rows are slots labelled with their times. Breaks show as thin rows. Days with fewer slots show the missing rows empty.
- AC3: A double shows as one cell spanning two slots. Cells show subject plus teacher, class and room as relevant, using the subject's colour.
- AC4: The teacher view shows hours against X and daily hours.

**US-12: Save, export and print**
- AC1: All data persists across reloads.
- AC2: JSON export/import round-trips identically, IDs and reserved fields included.
- AC3: Any view prints on one A4 landscape page.

**US-13: Soft preferences and quality report**
- AC1: Settings list the preferences from 3.3 with on/off toggles and one-line explanations, and new schools get the defaults.
- AC2: Preferences never break a hard constraint.
- AC3: On the demo school, enabling a preference measurably improves its metric compared with it off.
- AC4: After each solve a quality report shows each enabled preference's count with links to what's affected.

**US-14: Language**
- AC1: Hebrew is the default, and a switcher changes the whole UI to English and back without losing data. The choice is remembered.
- AC2: The layout is RTL in Hebrew and LTR in English, including grids and print. Times stay LTR.
- AC3: No hardcoded UI strings. The build fails if a translation key is missing in either language.

**US-15: Demo data**
- AC1: One button loads a realistic grades 7 to 9 school (several parallels per grade, study groups based on the Ministry middle school hours [R §2], homerooms, labs, a gym, some blocks) that solves successfully.

## 6. Non-functional requirements (MVP)
- Fully client-side. No data leaves the browser in phase 1.
- Latest Chrome, Edge, Safari and Firefox on desktop. Mobile is view-friendly.
- Accessible, keyboard-navigable forms (visual design owned by Website Design Bot).
- Nothing hardcoded about days, slots, times or period counts. Everything comes from the school's settings.
- All persistence goes through the repository interface. Solver and checker are pure and unit-tested.
- i18n via translation files and logical CSS properties. Use `Intl` for day names, but never its weekend data to decide school days [R §7].

## 7. Success metrics
- A scheduler goes from an empty project to a valid timetable for a mid-size middle school in under 2 hours of data entry.
- 100% generation success on feasible demo datasets within the time limit.
- Zero hard-constraint violations in any accepted timetable.

## 8. Open questions for Eran
1. **Size:** roughly how many classes, teachers and rooms does the largest middle school you want to support have?
2. **Integrations:** how soon do we need Excel import or Mashov/Ministry export? Schools already using Mashov will expect it.
3. **Teacher hours:** for the MVP, does X cover teaching hours only, with individual and stay hours (פרטני/שהייה) added later?
4. **Preference defaults:** are the defaults in 3.3 right (everything on except balanced teacher load)?

## 9. Queued for v0.6 (after the first working solve)

Reconciled with Website Design Bot's `/workspace/timetable-design/design-spec.md` §14 on 2026-09-30. Priority order:

1. **Manual editing (first, per Eran via Master Bot).**
   - Drag and drop to move or swap a lesson. Valid targets are colour-coded.
   - A keyboard "Move to" dialog (choose day and slot) as the accessible equivalent.
   - Lock and unlock a lesson using the reserved `Lesson.pinned`. Re-solve keeps pinned lessons fixed.
   - The "why can't this go here?" explainer lists the violated hard constraints (teacher busy, day off, block, room taken, daily cap and so on).
   - Every manual edit is checked immediately. A hard violation is refused, and soft costs update the quality report.
   - New user stories: US-16 (move/swap by drag and drop), US-17 (Move to dialog), US-18 (lock and re-solve around locks).
2. **Subject display fields.** Add `Subject.shortName` (an abbreviation for compact cells, e.g. "מתמ'", auto-suggested from the name and editable). `Subject.colour` stays, stored as a palette token key from the design system (contrast-safe) rather than free hex.
3. **Several local schools with a switcher.** The multi-school model already supports it. Locally, a user can create, switch and delete schools, so the demo school no longer overwrites real data. Phase 2 keeps the same switcher with accounts.
4. **Continuous validation.** The design runs pre-solve checks continuously and Generate re-runs them. This is a compatible superset of US-8, so update the US-8 wording to match.

Design §14 items already resolved by v0.5 (no v0.6 change): teacher availability (hard/soft teacher Blocks), room types (RoomType entity), fixed teacher per class and subject (StudyGroup.teacherIds), periods of different lengths within a day (explicit bell-schedule slot times), multi-school model. Aligned as-is: teachers teach up to X, timetable versions stay Phase 2, Excel import is hidden until it ships, level groups are later.
