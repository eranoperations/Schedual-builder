import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useStore } from '../app/store'
import { Button, Card, PageHeader, Select } from '../components/ui'
import { dayName } from '../i18n/format'
import { gridModel } from '../lib/grid'
import { cn } from '../lib/utils'
import { gradeLabel, scoped } from '../model/defaults'
import type { Block, BlockTargetType, SchoolProject, Weekday } from '../model/types'
import { lessonSlots } from '../model/week'

type Cell = 'hard' | 'soft' | null
const sameTarget = (b: Block, type: BlockTargetType, id?: string) => b.target.type === type && (type === 'school' || String(b.target.id) === String(id))

function cellState(p: SchoolProject, blocks: Block[], day: Weekday, slotId: string): Cell {
  let st: Cell = null
  for (const b of blocks) for (const w of b.when) {
    if (w.day !== day) continue
    if (!w.slotIds || w.slotIds.includes(slotId)) { if (b.hardness === 'hard') return 'hard'; st = 'soft' }
  }
  void p
  return st
}

export function BlocksPage() {
  const { t } = useTranslation()
  const { project: p, update, go } = useStore()
  const [type, setType] = useState<BlockTargetType>('teacher')
  const [id, setId] = useState<string>('')
  const options: { id: string; name: string }[] =
    type === 'teacher' ? p.teachers.map((x) => ({ id: x.id, name: x.name }))
      : type === 'class' ? p.classes.map((x) => ({ id: x.id, name: x.displayName }))
        : type === 'room' ? p.rooms.map((x) => ({ id: x.id, name: x.name }))
          : type === 'grade' ? [...new Set(p.classes.map((c) => c.grade))].sort().map((g) => ({ id: String(g), name: gradeLabel(g) })) : []
  const targetId = type === 'school' ? undefined : (options.find((o) => o.id === id)?.id ?? options[0]?.id)
  const mine = p.blocks.filter((b) => sameTarget(b, type, targetId))
  const model = gridModel(p.school.week, p.school.rules)

  const cycle = (day: Weekday, slotId: string) => update((d) => {
    const cur = cellState(d, d.blocks.filter((b) => sameTarget(b, type, targetId)), day, slotId)
    const next: Cell = cur === null ? 'hard' : cur === 'hard' ? 'soft' : null
    const all = lessonSlots(d.school.week, day, d.school.rules).map((s) => s.id)
    for (const b of d.blocks.filter((x) => sameTarget(x, type, targetId))) {
      b.when = b.when.flatMap((w) => {
        if (w.day !== day) return [w]
        const ids = (w.slotIds ?? all).filter((s) => s !== slotId)
        return ids.length ? [{ day, slotIds: ids }] : []
      })
    }
    d.blocks = d.blocks.filter((b) => !sameTarget(b, type, targetId) || b.when.length > 0)
    if (next) {
      let b = d.blocks.find((x) => sameTarget(x, type, targetId) && x.hardness === next)
      if (!b) { b = { ...scoped(d.school.id), target: type === 'school' ? { type } : { type, id: targetId }, when: [], hardness: next }; d.blocks.push(b) }
      const w = b.when.find((x) => x.day === day)
      if (w) w.slotIds = [...(w.slotIds ?? []), slotId]
      else b.when.push({ day, slotIds: [slotId] })
    }
  })

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t('step.blocks')} description={t('blocks.helpCycle')}
        actions={<Button onClick={() => go('settings')}>{t('rules.title')}</Button>} />
      <Card>
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm">{t('blocks.target')}
            <Select value={type} onChange={(e) => { setType(e.target.value as BlockTargetType); setId('') }}>
              {(['teacher', 'class', 'room', 'grade', 'school'] as const).map((k) => <option key={k} value={k}>{t(`blocks.scope.${k}`)}</option>)}
            </Select></label>
          {type !== 'school' && (
            <Select value={targetId ?? ''} onChange={(e) => setId(e.target.value)} aria-label={t('blocks.target')}>
              {options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </Select>
          )}
          <div className="ms-auto flex items-center gap-3 text-sm">
            <span className="inline-flex items-center gap-1"><span className="bg-block-hard inline-block size-4 rounded-sm" />{t('blocks.hard')}</span>
            <span className="inline-flex items-center gap-1"><span className="bg-block-soft inline-block size-4 rounded-sm" />{t('blocks.soft')}</span>
          </div>
        </div>
        {(type === 'school' || targetId) && (
          <table className="timetable-grid text-sm">
            <thead><tr><th className="p-2 text-xs text-fg-muted">{t('grid.period')}</th>{model.days.map((d) => <th key={d} className="p-2">{dayName(t, d)}</th>)}</tr></thead>
            <tbody>
              {model.rows.filter((r) => r.kind === 'lesson').map((r) => r.kind === 'lesson' && (
                <tr key={r.index}>
                  <th scope="row" className="px-2 text-start">{r.index === 0 ? t('bell.slot.zero') : t('bell.slot.lesson', { n: r.index })}</th>
                  {model.days.map((d) => {
                    const s = model.slotAt(d, r.index)
                    if (!s) return <td key={d} className="bg-offday-hatch" />
                    const st = cellState(p, mine, d, s.id)
                    return (
                      <td key={d} className="p-0.5">
                        <button type="button" onClick={() => cycle(d, s.id)} aria-pressed={st !== null}
                          aria-label={`${dayName(t, d)} ${t('bell.slot.lesson', { n: r.index })}: ${st ? t(`blocks.${st}`) : t('blocks.free')}`}
                          className={cn('h-10 w-full rounded-md border border-line-subtle text-xs font-medium', st === 'hard' && 'bg-block-hard', st === 'soft' && 'bg-block-soft')}>
                          {st ? t(`blocks.brush.${st}`) : ''}
                        </button>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}
