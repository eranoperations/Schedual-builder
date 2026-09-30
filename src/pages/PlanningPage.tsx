import { Pin, Plus, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useStore } from '../app/store'
import { Button, Card, NumberInput, PageHeader, Select, SubjectSwatch } from '../components/ui'
import { acceptedTimetable, draftTimetable } from '../lib/timetables'
import { cn } from '../lib/utils'
import { scoped } from '../model/defaults'
import { weeklyLessonSlots } from '../model/week'

export function PlanningPage() {
  const { t } = useTranslation()
  const { project: p, update } = useStore()
  const [sel, setSel] = useState<{ classId: string; subjectId: string } | null>(null)
  const tt = acceptedTimetable(p) ?? draftTimetable(p)
  const slots = weeklyLessonSlots(p.school.week, p.school.rules)
  const name = (id: string) => p.teachers.find((x) => x.id === id)?.name ?? '?'
  const cellGroups = (classId: string, subjectId: string) => p.groups.filter((g) => g.subjectId === subjectId && g.classIds.includes(classId))
  const teacherLabel = (gid: string, teacherIds: string[]) => {
    if (teacherIds.length) return teacherIds.map(name).join(', ')
    const a = tt?.teacherAssignments[gid]
    return a?.length ? `${t('group.auto')}: ${a.map(name).join(', ')}` : t('group.auto')
  }
  if (!p.classes.length || !p.subjects.length) return <><PageHeader title={t('planning.title')} /><Card><p className="text-sm text-fg-muted">{t('empty.planning')}</p></Card></>

  const selGroups = sel ? cellGroups(sel.classId, sel.subjectId) : []
  const selSubject = sel && p.subjects.find((s) => s.id === sel.subjectId)
  const selClass = sel && p.classes.find((c) => c.id === sel.classId)
  const totalHours = p.groups.reduce((a, g) => a + g.weeklyHours, 0)

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t('planning.title')} description={t('planning.help')} />
      <Card>
        <div className="overflow-x-auto">
          <table className="border-separate border-spacing-0 text-sm">
            <thead>
              <tr>
                <th className="sticky start-0 z-10 bg-surface p-2 text-start">{t('field.className')}</th>
                {p.subjects.map((s) => <th key={s.id} className="min-w-24 p-2 text-center font-semibold"><span className="inline-flex items-center gap-1"><SubjectSwatch color={s.color} />{s.name}</span></th>)}
                <th className="p-2">{t('planning.total')}</th>
              </tr>
            </thead>
            <tbody>
              {p.classes.map((c) => {
                const hours = p.groups.filter((g) => g.classIds.includes(c.id)).reduce((a, g) => a + g.weeklyHours, 0)
                return (
                  <tr key={c.id}>
                    <th scope="row" className="sticky start-0 z-10 border-t border-line-subtle bg-surface p-2 text-start font-semibold">{c.displayName}</th>
                    {p.subjects.map((s) => {
                      const gs = cellGroups(c.id, s.id)
                      const active = sel?.classId === c.id && sel.subjectId === s.id
                      return (
                        <td key={s.id} className="border-t border-line-subtle p-0.5">
                          <button type="button" onClick={() => setSel({ classId: c.id, subjectId: s.id })}
                            className={cn('flex min-h-12 w-full flex-col items-center justify-center rounded-md px-1 text-center hover:bg-surface-sunken', active && 'ring-2 ring-primary', gs.length === 0 && 'text-fg-subtle')}>
                            {gs.length === 0 ? '—' : gs.map((g) => (
                              <span key={g.id} className="leading-tight">
                                <span className="num font-semibold">{g.weeklyHours}</span>
                                <span className={cn('block max-w-28 truncate text-xs', g.teacherIds.length ? 'text-fg-muted' : 'text-primary')}>{teacherLabel(g.id, g.teacherIds)}</span>
                              </span>
                            ))}
                          </button>
                        </td>
                      )
                    })}
                    <td className={cn('num border-t border-line-subtle p-2 text-center', hours > slots && 'font-semibold text-error-fg')}>{t('planning.slots', { hours, slots })}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-sm text-fg-muted">{t('planning.grandTotal', { hours: totalHours, groups: p.groups.length })}</p>
      </Card>

      {sel && selSubject && selClass && (
        <Card title={t('group.dialogTitle', { subject: selSubject.name, class: selClass.displayName })}
          actions={<>
            <Button size="sm" onClick={() => update((d) => { d.groups.push({ ...scoped(d.school.id), subjectId: sel.subjectId, classIds: [sel.classId], teacherIds: [], weeklyHours: 2, doubles: 0 }) })}><Plus />{t('planning.addGroup')}</Button>
            <Button variant="ghost" size="icon" aria-label={t('action.close')} onClick={() => setSel(null)}><X /></Button>
          </>}>
          {selGroups.length === 0 && <p className="text-sm text-fg-muted">{t('planning.empty')}</p>}
          <div className="flex flex-col gap-3">
            {selGroups.map((g) => {
              const qualified = p.teachers.filter((x) => x.subjectIds.includes(g.subjectId))
              const assigned = tt?.teacherAssignments[g.id]
              const edit = (fn: (x: typeof g) => void) => update((d) => { const x = d.groups.find((y) => y.id === g.id); if (x) { fn(x); x.updatedAt = new Date().toISOString() } })
              return (
                <div key={g.id} className="flex flex-wrap items-end gap-3 rounded-lg border border-line-subtle p-3">
                  <label className="flex flex-col gap-1 text-sm">{t('group.teacher')}
                    <Select value={g.teacherIds[0] ?? ''} onChange={(e) => edit((x) => { x.teacherIds = e.target.value ? [e.target.value] : [] })}>
                      <option value="">{t('group.auto')}</option>
                      {qualified.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                      {g.teacherIds.filter((id) => !qualified.some((q) => q.id === id)).map((id) => <option key={id} value={id}>{name(id)} ({t('group.unqualified')})</option>)}
                    </Select>
                  </label>
                  {g.teacherIds.length === 0 && assigned?.length ? (
                    <div className="flex items-center gap-2 pb-1 text-sm">
                      <span>{t('group.autoAssigned', { name: assigned.map(name).join(', ') })}</span>
                      <Button size="sm" variant="secondary" title={t('group.pinTitle', { name: assigned.map(name).join(', ') })} onClick={() => edit((x) => { x.teacherIds = [...assigned] })}><Pin />{t('group.pin')}</Button>
                    </div>
                  ) : null}
                  <label className="flex flex-col gap-1 text-sm">{t('group.weeklyHours')}
                    <NumberInput value={g.weeklyHours} min={1} max={20} onChange={(v) => edit((x) => { x.weeklyHours = v ?? 1; x.doubles = Math.min(x.doubles, Math.floor(x.weeklyHours / 2)) })} /></label>
                  <label className="flex flex-col gap-1 text-sm">{t('group.doubles')}
                    <NumberInput value={g.doubles} min={0} max={Math.floor(g.weeklyHours / 2)} onChange={(v) => edit((x) => { x.doubles = v ?? 0 })} /></label>
                  {g.classIds.length > 1 && <span className="pb-1 text-sm text-fg-muted">{g.classIds.map((id) => p.classes.find((c) => c.id === id)?.displayName).join(' + ')}</span>}
                  <Button variant="ghost" size="icon" className="ms-auto" aria-label={t('action.deleteGroup')} onClick={() => update((d) => { d.groups = d.groups.filter((x) => x.id !== g.id) })}><Trash2 /></Button>
                </div>
              )
            })}
          </div>
        </Card>
      )}
    </div>
  )
}
