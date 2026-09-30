import { ChevronLeft, ChevronRight, Printer } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useStore } from '../app/store'
import { SubjectLegend, TimetableGrid, lessonsFor, type ViewKind } from '../components/TimetableGrid'
import { Alert, Badge, Button, Card, PageHeader, Select } from '../components/ui'
import { acceptedTimetable, draftTimetable } from '../lib/timetables'
import { resolveRules } from '../model/rules'
import { teachingDays, weeklyLessonSlots } from '../model/week'
import { cn } from '../lib/utils'

export function TimetablePage() {
  const { t } = useTranslation()
  const { project: p, go } = useStore()
  const draft = draftTimetable(p)
  const accepted = acceptedTimetable(p)
  const [which, setWhich] = useState<'draft' | 'accepted'>(draft ? 'draft' : 'accepted')
  const tt = (which === 'draft' ? draft : accepted) ?? draft ?? accepted
  const [view, setView] = useState<ViewKind>('class')
  const [ids, setIds] = useState<Record<ViewKind, string>>({ class: '', teacher: '', room: '' })
  const [density, setDensity] = useState<'normal' | 'compact'>('normal')

  if (!tt) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title={t('nav.timetable')} />
        <Alert severity="info" title={t('timetable.none')}><Button className="mt-2" variant="primary" onClick={() => go('generate')}>{t('step.generate')}</Button></Alert>
      </div>
    )
  }
  const entities = view === 'class'
    ? p.classes.map((c) => ({ id: c.id, name: c.displayName }))
    : view === 'teacher' ? p.teachers.map((x) => ({ id: x.id, name: x.name })) : p.rooms.map((x) => ({ id: x.id, name: x.name }))
  const current = entities.find((e) => e.id === ids[view]) ?? entities[0]
  const idx = entities.findIndex((e) => e.id === current?.id)
  const select = (id: string) => setIds((s) => ({ ...s, [view]: id }))
  const mine = current ? lessonsFor(p, tt.lessons, view, current.id) : []
  const hours = mine.reduce((a, l) => a + l.slotIds.length, 0)

  let summary = ''
  if (current && view === 'teacher') {
    const teacher = p.teachers.find((x) => x.id === current.id)!
    const daily = teachingDays(p.school.week).map((d) => mine.filter((l) => l.day === d).reduce((a, l) => a + l.slotIds.length, 0))
    const max = teacher.maxDailyHours ?? resolveRules(p.school.rules).maxTeacherDailyHours
    summary = `${t('timetable.teacherSummary', { hours, max: teacher.maxWeeklyHours })} · ${t('timetable.daily', { list: daily.join(' / '), max })}`
  } else if (current && view === 'class') {
    const cls = p.classes.find((c) => c.id === current.id)!
    const required = p.groups.filter((g) => g.classIds.includes(cls.id)).reduce((a, g) => a + g.weeklyHours, 0)
    const room = p.rooms.find((r) => r.id === cls.homeroomRoomId)?.name ?? '—'
    const ht = p.teachers.find((x) => x.id === cls.homeroomTeacherId)?.name ?? '—'
    summary = t('timetable.classSummary', { placed: hours, required, room, teacher: ht })
  } else if (current) {
    const total = weeklyLessonSlots(p.school.week, p.school.rules)
    summary = t('timetable.roomSummary', { used: hours, total })
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t('nav.timetable')}
        actions={<>
          {draft && accepted && (
            <Select value={which} onChange={(e) => setWhich(e.target.value as 'draft' | 'accepted')} aria-label={t('view.showing', { which: '' })}>
              <option value="draft">{t('timetable.showDraft')}</option>
              <option value="accepted">{t('timetable.showAccepted')}</option>
            </Select>
          )}
          <Badge tone={tt.status === 'accepted' ? 'success' : 'neutral'}>{t(`timetable.status.${tt.status}`)}</Badge>
          <Button onClick={() => window.print()}><Printer />{t('action.print')}</Button>
        </>} />
      <div className="no-print flex flex-wrap items-center gap-3">
        <div role="tablist" aria-label={t('nav.timetable')} className="inline-flex rounded-lg border border-line-control bg-surface p-0.5">
          {(['class', 'teacher', 'room'] as const).map((v) => (
            <button key={v} role="tab" type="button" aria-selected={view === v} onClick={() => setView(v)}
              className={cn('h-8 rounded-md px-4 text-sm font-medium', view === v ? 'bg-primary text-primary-foreground' : 'text-fg-muted hover:bg-surface-sunken')}>{t(`view.${v}`)}</button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" aria-label={t('action.previous')} disabled={idx <= 0} onClick={() => select(entities[idx - 1].id)}><ChevronRight className="ltr:rotate-180" /></Button>
          <Select value={current?.id ?? ''} onChange={(e) => select(e.target.value)} aria-label={t(`view.${view}`)} data-testid="entity-select">
            {entities.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </Select>
          <Button variant="ghost" size="icon" aria-label={t('action.nextItem')} disabled={idx >= entities.length - 1} onClick={() => select(entities[idx + 1].id)}><ChevronLeft className="ltr:rotate-180" /></Button>
        </div>
        <Select className="ms-auto" value={density} onChange={(e) => setDensity(e.target.value as 'normal' | 'compact')} aria-label={t('field.density')}>
          <option value="normal">{t('view.density.normal')}</option>
          <option value="compact">{t('view.density.compact')}</option>
        </Select>
      </div>
      {current && (
        <Card title={`${t(`view.${view}`)}: ${current.name}`}>
          <p className="mb-3 text-sm text-fg-muted">{summary}</p>
          <TimetableGrid project={p} lessons={tt.lessons} view={view} entityId={current.id} density={density}
            caption={t('timetable.caption', { entity: current.name, hours })} />
          <SubjectLegend project={p} lessons={mine} />
        </Card>
      )}
    </div>
  )
}
