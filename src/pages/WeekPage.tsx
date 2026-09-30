import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useStore } from '../app/store'
import { Button, Card, Input, PageHeader, Select, Table } from '../components/ui'
import { dayName } from '../i18n/format'
import type { Weekday } from '../model/types'
import { weekFromTemplate, type WeekTemplate } from '../model/week'

export function WeekPage() {
  const { t } = useTranslation()
  const { project: p, update } = useStore()
  const w = p.school.week
  const [tpl, setTpl] = useState<WeekTemplate>('sunThu')
  const [sched, setSched] = useState(w.bellSchedules[0]?.id ?? '')
  const bs = w.bellSchedules.find((b) => b.id === sched) ?? w.bellSchedules[0]
  const toggleDay = (d: Weekday, on: boolean) => update((x) => {
    const wk = x.school.week
    wk.days = on ? [...wk.days, d].sort() as Weekday[] : wk.days.filter((y) => y !== d)
    if (on && !wk.dayBellSchedule[d]) wk.dayBellSchedule[d] = wk.bellSchedules[wk.bellSchedules.length - 1]?.id
  })
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t('step.week')} />
      <Card title={t('field.schoolDays')}>
        <div className="flex flex-wrap gap-4">
          {([0, 1, 2, 3, 4, 5] as Weekday[]).map((d) => (
            <label key={d} className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" checked={w.days.includes(d)} onChange={(e) => toggleDay(d, e.target.checked)} />{dayName(t, d)}
            </label>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-sm">{t('field.template')}
            <Select value={tpl} onChange={(e) => setTpl(e.target.value as WeekTemplate)}>
              <option value="sunThu">{t('template.sunThu')}</option>
              <option value="sunFri">{t('template.sunFriShort')}</option>
            </Select></label>
          <Button onClick={() => {
            if (!window.confirm(t('week.templateWarn'))) return
            update((x) => { x.school.week = weekFromTemplate(tpl, { regular: t('week.regularName'), friday: t('week.fridayName') }) })
          }}>{t('week.templateApply')}</Button>
        </div>
      </Card>
      <Card title={t('bell.dayAssignment')}>
        <div className="flex flex-wrap gap-4">
          {w.days.map((d) => (
            <label key={d} className="flex flex-col gap-1 text-sm">{dayName(t, d)}
              <Select value={w.dayBellSchedule[d] ?? ''} onChange={(e) => update((x) => { x.school.week.dayBellSchedule[d] = e.target.value })}>
                {w.bellSchedules.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </Select></label>
          ))}
        </div>
      </Card>
      {bs && (
        <Card title={t('bell.schedule')} actions={
          <Select value={bs.id} onChange={(e) => setSched(e.target.value)} aria-label={t('bell.schedule')}>
            {w.bellSchedules.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </Select>}>
          <Table>
            <thead><tr><th>{t('bell.slot')}</th><th>{t('field.start')}</th><th>{t('field.end')}</th><th>{t('bell.joinable')}</th></tr></thead>
            <tbody>
              {bs.slots.map((s, i) => {
                const edit = (fn: (x: typeof s) => void) => update((x) => { const b = x.school.week.bellSchedules.find((y) => y.id === bs.id)!; fn(b.slots[i]) })
                return (
                  <tr key={s.id} className={s.type === 'break' ? 'bg-surface-sunken' : ''}>
                    <td className="text-sm font-medium">{s.type === 'break' ? t('bell.slot.break') : s.index === 0 ? t('bell.slot.zero') : t('bell.slot.lesson', { n: s.index })}</td>
                    <td><Input type="time" dir="ltr" value={s.start} onChange={(e) => edit((x) => { x.start = e.target.value })} /></td>
                    <td><Input type="time" dir="ltr" value={s.end} onChange={(e) => edit((x) => { x.end = e.target.value })} /></td>
                    <td>{s.type === 'lesson' && <input type="checkbox" aria-label={t('bell.joinable')} checked={s.joinableWithNext} onChange={(e) => edit((x) => { x.joinableWithNext = e.target.checked })} />}</td>
                  </tr>
                )
              })}
            </tbody>
          </Table>
        </Card>
      )}
    </div>
  )
}
