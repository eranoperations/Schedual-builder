/* eslint-disable react-refresh/only-export-components */
import { Link2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { lessonTeacherIds } from '../model/lessons'
import type { Lesson, SchoolProject, Weekday } from '../model/types'
import { dayName } from '../i18n/format'
import { gridModel, minutes } from '../lib/grid'

export type ViewKind = 'class' | 'teacher' | 'room'

export function lessonsFor(p: SchoolProject, lessons: Lesson[], view: ViewKind, id: string): Lesson[] {
  const groups = new Map(p.groups.map((g) => [g.id, g]))
  return lessons.filter((l) => {
    const g = groups.get(l.studyGroupId)
    if (!g) return false
    if (view === 'class') return g.classIds.includes(id)
    if (view === 'teacher') return lessonTeacherIds(g, l).includes(id)
    return l.roomIds.includes(id)
  })
}

export function TimetableGrid({ project, lessons, view, entityId, density = 'normal', caption }: {
  project: SchoolProject; lessons: Lesson[]; view: ViewKind; entityId: string; density?: 'normal' | 'compact'; caption: string
}) {
  const { t } = useTranslation()
  const model = gridModel(project.school.week, project.school.rules)
  const mine = lessonsFor(project, lessons, view, entityId)
  const groups = new Map(project.groups.map((g) => [g.id, g]))
  const subjects = new Map(project.subjects.map((s) => [s.id, s]))
  const nameOf = new Map<string, string>([
    ...project.teachers.map((x) => [x.id, x.name] as [string, string]),
    ...project.classes.map((x) => [x.id, x.displayName] as [string, string]),
    ...project.rooms.map((x) => [x.id, x.name] as [string, string]),
  ])
  const at = new Map<string, Lesson>()
  for (const l of mine) l.slotIds.forEach((s, k) => at.set(`${l.day}:${s}`, k === 0 ? l : ({ ...l, _cont: true } as Lesson)))
  const teacher = view === 'teacher' ? project.teachers.find((x) => x.id === entityId) : undefined
  // cells covered by a rowspan (second slot of a double, and a break row in between)
  const covered = new Set<string>()

  const chip = (l: Lesson) => {
    const g = groups.get(l.studyGroupId)!
    const s = subjects.get(g.subjectId)
    const tNames = lessonTeacherIds(g, l).map((id) => nameOf.get(id) ?? '').join(', ')
    const cNames = g.classIds.map((id) => nameOf.get(id) ?? '').join(', ')
    const rNames = l.roomIds.map((id) => nameOf.get(id) ?? '').join(', ')
    const meta = view === 'class' ? [tNames, rNames] : view === 'teacher' ? [cNames, rNames] : [cNames, tNames]
    const dbl = l.slotIds.length === 2
    return (
      <div className="lesson-chip flex flex-col" data-subject-color={s?.color ?? 'subject-other'} data-double={dbl} tabIndex={0}
        aria-label={[s?.name, ...meta, dbl ? t('grid.double') : ''].filter(Boolean).join(', ')}>
        <span className="truncate text-sm font-semibold">{s?.name}</span>
        <span className="chip-meta truncate text-xs font-medium">{meta.filter(Boolean).join(' · ')}</span>
        {dbl && density === 'normal' && <span className="chip-meta mt-auto flex items-center gap-1 text-xs font-medium"><Link2 className="size-3" aria-hidden />{t('grid.double')}</span>}
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="timetable-grid text-sm" data-density={density}>
        <caption className="sr-only">{caption}</caption>
        <colgroup><col style={{ width: 'var(--grid-period-col-width)' }} />{model.days.map((d) => <col key={d} />)}</colgroup>
        <thead>
          <tr>
            <th scope="col" className="p-2 text-xs text-fg-muted">{t('grid.period')}</th>
            {model.days.map((d) => (
              <th key={d} scope="col" className="p-2 text-center font-semibold">
                {dayName(t, d)}
                {teacher?.dayOff === d && <div className="text-xs font-medium text-fg-muted">{t('legend.dayOff')}</div>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {model.rows.map((row, ri) => {
            if (row.kind === 'break') {
              return (
                <tr key={`b${row.after}`} className="break-row">
                  <th scope="row" className="px-2 text-xs font-medium text-fg-muted">{t('grid.break')}</th>
                  {model.days.map((d) => {
                    if (covered.has(`${d}:b${row.after}`)) return null
                    const b = model.breakAfter(d, row.after)
                    return <td key={d} className="px-2 text-center text-xs font-medium text-fg-muted" title={b ? `${b.start}–${b.end}` : undefined}>{b ? t('grid.breakMin', { min: minutes(b) }) : ''}</td>
                  })}
                </tr>
              )
            }
            return (
              <tr key={`l${row.index}`}>
                <th scope="row" className="px-2 py-1 text-start align-top">
                  <div className="text-sm font-semibold">{row.index === 0 ? t('bell.slot.zero') : t('bell.slot.lesson', { n: row.index })}</div>
                  {row.label && <div className="ltr-isolate num text-start text-xs font-medium text-fg-muted">{row.label.start}–{row.label.end}</div>}
                </th>
                {model.days.map((d: Weekday) => {
                  if (covered.has(`${d}:${row.index}`)) return null
                  const slot = model.slotAt(d, row.index)
                  if (!slot) return <td key={d} className="lesson-cell bg-offday-hatch" data-cell-state="offday"><span className="text-xs font-medium text-fg-muted">{t('state.noSchool')}</span></td>
                  if (teacher?.dayOff === d) return <td key={d} className="lesson-cell bg-offday-hatch" data-cell-state="offday" />
                  const l = at.get(`${d}:${slot.id}`)
                  if (!l || (l as Lesson & { _cont?: boolean })._cont) return <td key={d} className="lesson-cell" />
                  let span = 1
                  if (l.slotIds.length === 2) {
                    span = 2
                    // next lesson row (maybe after a break row)
                    const nextRow = model.rows[ri + 1]
                    if (nextRow?.kind === 'break') { span = 3; covered.add(`${d}:b${nextRow.after}`) }
                    const lessonRow = model.rows.slice(ri + 1).find((r) => r.kind === 'lesson')
                    if (lessonRow?.kind === 'lesson') covered.add(`${d}:${lessonRow.index}`)
                  }
                  return <td key={d} className="lesson-cell" rowSpan={span}>{chip(l)}</td>
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export function SubjectLegend({ project, lessons }: { project: SchoolProject; lessons: Lesson[] }) {
  const { t } = useTranslation()
  const groups = new Map(project.groups.map((g) => [g.id, g]))
  const used = new Set(lessons.map((l) => groups.get(l.studyGroupId)?.subjectId))
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-medium text-fg-muted">
      <span className="font-semibold">{t('legend.title')}:</span>
      {project.subjects.filter((s) => used.has(s.id)).map((s) => (
        <span key={s.id} className="inline-flex items-center gap-1" data-subject-color={s.color}><span className="subject-swatch inline-block size-3 rounded-full" />{s.name}</span>
      ))}
      <span className="inline-flex items-center gap-1"><span className="bg-offday-hatch inline-block size-3 rounded-sm" />{t('legend.hatch')}</span>
      <span className="inline-flex items-center gap-1"><Link2 className="size-3" />{t('legend.double')}</span>
    </div>
  )
}
