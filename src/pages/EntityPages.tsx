import { Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useStore } from '../app/store'
import { Button, Card, Input, NumberInput, PageHeader, Select, SubjectSwatch, Table } from '../components/ui'
import { dayName } from '../i18n/format'
import { lessonTeacherIds } from '../model/lessons'
import { classDisplayName, gradeLabel, nextSubjectColor, scoped, SUBJECT_COLOR_KEYS } from '../model/defaults'
import { resolveRules } from '../model/rules'
import type { RoomRequirement, SchoolProject, Weekday } from '../model/types'
import { acceptedTimetable, draftTimetable } from '../lib/timetables'
import { hebrewQuotes } from '../lib/text'


const touch = <T extends { updatedAt: string }>(x: T) => { x.updatedAt = new Date().toISOString(); return x }
const del = 'size-4'

function reqValue(r: RoomRequirement): string { return typeof r === 'string' ? r : `type:${r.roomTypeId}` }
function reqParse(v: string): RoomRequirement { return v.startsWith('type:') ? { roomTypeId: v.slice(5) } : (v as 'homeroom' | 'none') }

function RoomReqSelect({ p, value, onChange, label }: { p: SchoolProject; value: RoomRequirement; onChange: (r: RoomRequirement) => void; label: string }) {
  const { t } = useTranslation()
  return (
    <Select aria-label={label} value={reqValue(value)} onChange={(e) => onChange(reqParse(e.target.value))}>
      <option value="homeroom">{t('room.homeroom')}</option>
      <option value="none">{t('room.none')}</option>
      {p.roomTypes.map((rt) => <option key={rt.id} value={`type:${rt.id}`}>{rt.name}</option>)}
    </Select>
  )
}

export function RoomsPage() {
  const { t } = useTranslation()
  const { project: p, update } = useStore()
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t('step.rooms')} />
      <Card title={t('roomType.title')} actions={<Button size="sm" onClick={() => update((d) => { d.roomTypes.push({ ...scoped(d.school.id), name: t('roomType.new') }) })}><Plus />{t('action.addRoomType')}</Button>}>
        <p className="mb-2 text-sm text-fg-muted">{t('roomType.suggestions')}</p>
        <div className="flex flex-wrap gap-2">
          {p.roomTypes.map((rt, i) => (
            <div key={rt.id} className="flex items-center gap-1 rounded-lg border border-line-subtle p-1">
              <Input value={rt.name} aria-label={t('field.name')} onChange={(e) => update((d) => { touch(d.roomTypes[i]).name = e.target.value })} />
              <span className="num px-1 text-xs text-fg-muted">{p.rooms.filter((r) => r.roomTypeId === rt.id).length}</span>
              <Button variant="ghost" size="icon" aria-label={t('action.delete')} disabled={p.rooms.some((r) => r.roomTypeId === rt.id)}
                onClick={() => update((d) => { d.roomTypes.splice(i, 1) })}><Trash2 className={del} /></Button>
            </div>
          ))}
        </div>
      </Card>
      <Card title={t('rooms.count', { count: p.rooms.length })}
        actions={<Button size="sm" disabled={!p.roomTypes.length} onClick={() => update((d) => { d.rooms.push({ ...scoped(d.school.id), name: `${t('kind.room')} ${d.rooms.length + 1}`, roomTypeId: d.roomTypes[0].id }) })}><Plus />{t('action.addRoom')}</Button>}>
        <Table>
          <thead><tr><th>{t('field.roomName')}</th><th>{t('field.roomType')}</th><th>{t('field.capacity')}</th><th>{t('field.homeroomRoom')}</th><th><span className="sr-only">{t('field.actions')}</span></th></tr></thead>
          <tbody>
            {p.rooms.map((r, i) => (
              <tr key={r.id}>
                <td><Input value={r.name} aria-label={t('field.roomName')} onChange={(e) => update((d) => { touch(d.rooms[i]).name = e.target.value })} /></td>
                <td><Select value={r.roomTypeId} aria-label={t('field.roomType')} onChange={(e) => update((d) => { touch(d.rooms[i]).roomTypeId = e.target.value })}>
                  {p.roomTypes.map((rt) => <option key={rt.id} value={rt.id}>{rt.name}</option>)}</Select></td>
                <td><NumberInput value={r.capacity} max={999} aria-label={t('field.capacity')} onChange={(v) => update((d) => { touch(d.rooms[i]).capacity = v })} /></td>
                <td className="text-sm text-fg-muted">{p.classes.filter((c) => c.homeroomRoomId === r.id).map((c) => c.displayName).join(', ')}</td>
                <td><Button variant="ghost" size="icon" aria-label={t('action.delete')} onClick={() => update((d) => {
                  d.rooms.splice(i, 1)
                  d.classes.forEach((c) => { if (c.homeroomRoomId === r.id) c.homeroomRoomId = null })
                  d.blocks = d.blocks.filter((b) => !(b.target.type === 'room' && b.target.id === r.id))
                })}><Trash2 className={del} /></Button></td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  )
}

export function SubjectsPage() {
  const { t } = useTranslation()
  const { project: p, update } = useStore()
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t('step.subjects')}
        actions={<Button variant="primary" onClick={() => update((d) => { d.subjects.push({ ...scoped(d.school.id), name: t('subject.new'), color: nextSubjectColor(d.subjects.map((s) => s.color)), defaultRoom: 'homeroom' }) })}><Plus />{t('action.addSubject')}</Button>} />
      <Card>
        <Table>
          <thead><tr><th>{t('field.color')}</th><th>{t('field.subjectName')}</th><th>{t('field.defaultRoom')}</th><th>{t('field.classWeeklyHours')}</th><th><span className="sr-only">{t('field.actions')}</span></th></tr></thead>
          <tbody>
            {p.subjects.map((s, i) => (
              <tr key={s.id}>
                <td><div className="flex items-center gap-2"><SubjectSwatch color={s.color} />
                  <Select value={s.color} aria-label={t('field.color')} onChange={(e) => update((d) => { touch(d.subjects[i]).color = e.target.value })}>
                    {SUBJECT_COLOR_KEYS.map((k) => <option key={k} value={k}>{t(`color.${k}`)}</option>)}</Select></div></td>
                <td><Input value={s.name} aria-label={t('field.subjectName')} onChange={(e) => update((d) => { touch(d.subjects[i]).name = e.target.value })} /></td>
                <td><RoomReqSelect p={p} value={s.defaultRoom} label={t('field.defaultRoom')} onChange={(r) => update((d) => { touch(d.subjects[i]).defaultRoom = r })} /></td>
                <td className="num text-sm">{p.groups.filter((g) => g.subjectId === s.id).reduce((a, g) => a + g.weeklyHours, 0)}</td>
                <td><Button variant="ghost" size="icon" aria-label={t('action.delete')} onClick={() => {
                  const n = p.groups.filter((g) => g.subjectId === s.id).length
                  if (n && !window.confirm(t('confirm.deleteSubject', { name: s.name, count: n }))) return
                  update((d) => {
                    d.subjects.splice(i, 1)
                    d.groups = d.groups.filter((g) => g.subjectId !== s.id)
                    d.teachers.forEach((x) => { x.subjectIds = x.subjectIds.filter((id) => id !== s.id) })
                  })
                }}><Trash2 className={del} /></Button></td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  )
}

export function TeachersPage() {
  const { t } = useTranslation()
  const { project: p, update } = useStore()
  const days = p.school.week.days
  const tt = draftTimetable(p) ?? acceptedTimetable(p)
  const planned = (id: string) => p.groups.filter((g) => g.teacherIds.includes(id)).reduce((a, g) => a + g.weeklyHours, 0)
  const autoHours = (id: string) => {
    if (!tt) return 0
    const byId = new Map(p.groups.map((g) => [g.id, g]))
    return tt.lessons.filter((l) => { const g = byId.get(l.studyGroupId); return g && g.teacherIds.length === 0 && lessonTeacherIds(g, l).includes(id) }).reduce((a, l) => a + l.slotIds.length, 0)
  }
  const [open, setOpen] = useState<string | null>(null)
  const dailyDefault = resolveRules(p.school.rules).maxTeacherDailyHours
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t('step.teachers')}
        actions={<Button variant="primary" onClick={() => update((d) => { d.teachers.push({ ...scoped(d.school.id), name: t('teacher.new'), maxWeeklyHours: 24, subjectIds: [], dayOff: (d.school.week.days[d.school.week.days.length - 1] ?? 5) as Weekday }) })}><Plus />{t('action.addTeacher')}</Button>} />
      <Card>
        <Table>
          <thead><tr><th>{t('field.teacherName')}</th><th>{t('field.maxWeeklyHours.short')}</th><th>{t('field.maxDailyHours')}</th><th>{t('field.dayOff')}</th><th>{t('field.subjectsTaught')}</th><th>{t('field.assigned')}</th><th><span className="sr-only">{t('field.actions')}</span></th></tr></thead>
          <tbody>
            {p.teachers.map((x, i) => {
              const fixed = planned(x.id), auto = autoHours(x.id)
              return (
                <tr key={x.id} className="align-top">
                  <td><Input value={x.name} aria-label={t('field.teacherName')} onChange={(e) => update((d) => { touch(d.teachers[i]).name = e.target.value })} /></td>
                  <td><NumberInput value={x.maxWeeklyHours} min={1} max={60} aria-label={t('field.maxWeeklyHours')} onChange={(v) => update((d) => { touch(d.teachers[i]).maxWeeklyHours = v ?? 1 })} /></td>
                  <td><NumberInput value={x.maxDailyHours} min={1} max={12} placeholder={String(dailyDefault)} aria-label={t('field.maxDailyHours')} onChange={(v) => update((d) => { touch(d.teachers[i]).maxDailyHours = v })} /></td>
                  <td><Select value={x.dayOff} aria-label={t('field.dayOff')} onChange={(e) => update((d) => { touch(d.teachers[i]).dayOff = Number(e.target.value) as Weekday })}>
                    {[0, 1, 2, 3, 4, 5].map((dd) => <option key={dd} value={dd}>{dayName(t, dd)}{days.includes(dd as Weekday) ? '' : ` (${t('state.noSchool')})`}</option>)}</Select></td>
                  <td className="max-w-80">
                    <button type="button" className="text-start text-sm underline-offset-2 hover:underline" onClick={() => setOpen(open === x.id ? null : x.id)}>
                      {x.subjectIds.map((id) => p.subjects.find((s) => s.id === id)?.name).filter(Boolean).join(', ') || t('field.subjects.required')}
                    </button>
                    {open === x.id && (
                      <div className="mt-2 grid grid-cols-2 gap-1">
                        {p.subjects.map((s) => (
                          <label key={s.id} className="flex items-center gap-2 text-sm">
                            <input type="checkbox" checked={x.subjectIds.includes(s.id)} onChange={(e) => update((d) => {
                              const tt2 = touch(d.teachers[i]); tt2.subjectIds = e.target.checked ? [...tt2.subjectIds, s.id] : tt2.subjectIds.filter((id) => id !== s.id)
                            })} />{s.name}
                          </label>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="num text-sm"><span className={fixed + auto > x.maxWeeklyHours ? 'font-semibold text-error-fg' : ''}>{fixed}{auto ? `+${auto}` : ''} / {x.maxWeeklyHours}</span></td>
                  <td><Button variant="ghost" size="icon" aria-label={t('action.delete')} onClick={() => update((d) => {
                    d.teachers.splice(i, 1)
                    d.groups.forEach((g) => { g.teacherIds = g.teacherIds.filter((id) => id !== x.id) })
                    d.classes.forEach((c) => { if (c.homeroomTeacherId === x.id) c.homeroomTeacherId = null })
                    d.blocks = d.blocks.filter((b) => !(b.target.type === 'teacher' && b.target.id === x.id))
                  })}><Trash2 className={del} /></Button></td>
                </tr>
              )
            })}
          </tbody>
        </Table>
      </Card>
    </div>
  )
}

export function ClassesPage() {
  const { t } = useTranslation()
  const { project: p, update } = useStore()
  const [grade, setGrade] = useState(7)
  const [count, setCount] = useState(3)
  const addGrade = () => update((d) => {
    const existing = d.classes.filter((c) => c.grade === grade).map((c) => c.parallel)
    let par = existing.length ? Math.max(...existing) : 0
    for (let k = 0; k < count; k++) {
      par++
      d.classes.push({ ...scoped(d.school.id), grade, parallel: par, displayName: classDisplayName(grade, par), homeroomRoomId: null, homeroomTeacherId: null })
    }
  })
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t('step.classes')} />
      <Card title={t('action.addGrade')}>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm">{t('field.grade')}
            <Select value={grade} onChange={(e) => setGrade(Number(e.target.value))}>{[7, 8, 9].map((g) => <option key={g} value={g}>{gradeLabel(g)}</option>)}</Select></label>
          <label className="flex flex-col gap-1 text-sm">{t('classes.parallels')}
            <NumberInput value={count} min={1} max={15} onChange={(v) => setCount(v ?? 1)} /></label>
          <Button variant="primary" onClick={addGrade}><Plus />{t('action.addGradeN', { count })}</Button>
        </div>
      </Card>
      <Card>
        {p.classes.length === 0 ? <p className="text-sm text-fg-muted">{t('empty.classes')}</p> : (
          <Table>
            <thead><tr><th>{t('field.displayName')}</th><th>{t('field.homeroomRoom')}</th><th>{t('field.homeroomTeacher')}</th><th>{t('field.classWeeklyHours')}</th><th><span className="sr-only">{t('field.actions')}</span></th></tr></thead>
            <tbody>
              {p.classes.map((c, i) => (
                <tr key={c.id}>
                  <td><Input value={c.displayName} aria-label={t('field.displayName')} className="w-24" onChange={(e) => update((d) => { touch(d.classes[i]).displayName = hebrewQuotes(e.target.value) })} /></td>
                  <td><Select value={c.homeroomRoomId ?? ''} aria-label={t('field.homeroomRoom')} onChange={(e) => update((d) => { touch(d.classes[i]).homeroomRoomId = e.target.value || null })}>
                    <option value="">—</option>{p.rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</Select></td>
                  <td><Select value={c.homeroomTeacherId ?? ''} aria-label={t('field.homeroomTeacher')} onChange={(e) => update((d) => { touch(d.classes[i]).homeroomTeacherId = e.target.value || null })}>
                    <option value="">—</option>{p.teachers.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select></td>
                  <td className="num text-sm">{p.groups.filter((g) => g.classIds.includes(c.id)).reduce((a, g) => a + g.weeklyHours, 0)}</td>
                  <td><Button variant="ghost" size="icon" aria-label={t('action.delete')} onClick={() => update((d) => {
                    d.classes.splice(i, 1)
                    d.groups.forEach((g) => { g.classIds = g.classIds.filter((id) => id !== c.id) })
                    d.groups = d.groups.filter((g) => g.classIds.length > 0)
                    d.blocks = d.blocks.filter((b) => !(b.target.type === 'class' && b.target.id === c.id))
                  })}><Trash2 className={del} /></Button></td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  )
}
