import { DirectionProvider } from '@radix-ui/react-direction'
import {
  BookOpen, CalendarDays, CheckSquare, DoorOpen, Download, Grid3x3, House, Languages, LayoutGrid, Redo2, School, Settings, ShieldBan, Sparkles, Undo2, Users, UsersRound,
} from 'lucide-react'
import { useMemo, type ComponentType } from 'react'
import { useTranslation } from 'react-i18next'
import { repo, useStore, type Page } from './app/store'
import { Badge, Button } from './components/ui'
import { applyDocumentLang, type Lang } from './i18n'
import { cn } from './lib/utils'
import { validate } from './solver'
import { BlocksPage } from './pages/BlocksPage'
import { ExportPage } from './pages/ExportPage'
import { GeneratePage } from './pages/GeneratePage'
import { HomePage } from './pages/HomePage'
import { ClassesPage, RoomsPage, SubjectsPage, TeachersPage } from './pages/EntityPages'
import { PlanningPage } from './pages/PlanningPage'
import { SettingsPage } from './pages/SettingsPage'
import { TimetablePage } from './pages/TimetablePage'
import { ValidatePage } from './pages/ValidatePage'
import { WeekPage } from './pages/WeekPage'

type NavItem = { page: Page; key: string; icon: ComponentType<{ className?: string }>; step?: number }
const SETUP: NavItem[] = [
  { page: 'week', key: 'step.week', icon: CalendarDays, step: 1 },
  { page: 'rooms', key: 'step.rooms', icon: DoorOpen, step: 2 },
  { page: 'subjects', key: 'step.subjects', icon: BookOpen, step: 3 },
  { page: 'teachers', key: 'step.teachers', icon: Users, step: 4 },
  { page: 'classes', key: 'step.classes', icon: UsersRound, step: 5 },
  { page: 'planning', key: 'step.planning', icon: Grid3x3, step: 6 },
  { page: 'blocks', key: 'step.blocks', icon: ShieldBan, step: 7 },
]
const RUN: NavItem[] = [
  { page: 'validate', key: 'step.validate', icon: CheckSquare, step: 8 },
  { page: 'generate', key: 'step.generate', icon: Sparkles, step: 9 },
]
const OUT: NavItem[] = [
  { page: 'timetable', key: 'nav.timetable', icon: LayoutGrid },
  { page: 'export', key: 'nav.export', icon: Download },
  { page: 'settings', key: 'nav.settings', icon: Settings },
]

export default function App() {
  const { t, i18n } = useTranslation()
  const { project, page, go, undo, redo, canUndo, canRedo, saveState } = useStore()
  const lang = (i18n.language === 'en' ? 'en' : 'he') as Lang
  const errors = useMemo(() => validate(project).filter((i) => i.severity === 'error').length, [project])
  const setLang = (l: Lang) => { void i18n.changeLanguage(l); applyDocumentLang(l); repo.set('lang', l) }

  const item = (it: NavItem) => {
    const Icon = it.icon
    const active = page === it.page
    return (
      <li key={it.page}>
        <button type="button" onClick={() => go(it.page)} aria-current={active ? 'page' : undefined}
          className={cn('relative flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-sidebar-foreground hover:bg-surface-sunken',
            active && 'bg-primary-subtle text-primary-subtle-fg before:absolute before:inset-y-1 before:start-0 before:w-[3px] before:rounded-full before:bg-primary')}>
          <Icon className="size-5 shrink-0" />
          <span className="truncate">{it.step ? `${it.step}. ` : ''}{t(it.key)}</span>
          {it.page === 'validate' && errors > 0 && <Badge tone="error" className="ms-auto">{errors}</Badge>}
        </button>
      </li>
    )
  }

  const Current = {
    home: HomePage, week: WeekPage, rooms: RoomsPage, subjects: SubjectsPage, teachers: TeachersPage, classes: ClassesPage,
    planning: PlanningPage, blocks: BlocksPage, validate: ValidatePage, generate: GeneratePage, timetable: TimetablePage,
    export: ExportPage, settings: SettingsPage,
  }[page]

  return (
    <DirectionProvider dir={lang === 'he' ? 'rtl' : 'ltr'}>
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:start-2 focus:top-2 focus:z-50 focus:rounded focus:bg-surface focus:p-2">{t('nav.skip')}</a>
      <div className="flex min-h-screen bg-canvas text-fg">
        <nav aria-label={t('nav.main')} className="no-print sticky top-0 flex h-screen w-64 shrink-0 flex-col gap-1 overflow-y-auto border-e border-line-subtle bg-surface-sidebar p-3">
          <div className="mb-2 flex items-center gap-2 px-2 py-1 text-base font-bold"><CalendarDays className="size-6 text-primary" />{t('app.name')}</div>
          <ul className="flex flex-col gap-0.5">{item({ page: 'home', key: 'nav.home', icon: House })}</ul>
          <div className="mt-3 px-3 text-xs font-semibold text-fg-muted">{t('nav.setup')}</div>
          <ul className="flex flex-col gap-0.5">{SETUP.map(item)}</ul>
          <hr className="my-2 border-line-subtle" />
          <ul className="flex flex-col gap-0.5">{RUN.map(item)}</ul>
          <hr className="my-2 border-line-subtle" />
          <ul className="flex flex-col gap-0.5">{OUT.map(item)}</ul>
        </nav>
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="no-print sticky top-0 z-(--z-sticky) flex h-14 items-center gap-3 border-b border-line-subtle bg-surface px-6">
            <button type="button" onClick={() => go('settings')} className="flex items-center gap-2 text-base font-semibold">
              <School className="size-5" />{project.school.name}
            </button>
            <div className="ms-auto flex items-center gap-2">
              <span role="status" className="text-sm text-fg-muted">{t(`save.${saveState}`)}</span>
              <Button variant="ghost" size="icon" onClick={undo} disabled={!canUndo} aria-label={t('action.undo')} title={t('action.undo')}><Undo2 className="rtl:-scale-x-100" /></Button>
              <Button variant="ghost" size="icon" onClick={redo} disabled={!canRedo} aria-label={t('action.redo')} title={t('action.redo')}><Redo2 className="rtl:-scale-x-100" /></Button>
              <Button variant="ghost" size="sm" onClick={() => setLang(lang === 'he' ? 'en' : 'he')} aria-label={t('display.language')}>
                <Languages />{lang === 'he' ? 'EN' : 'עב'}
              </Button>
            </div>
          </header>
          <main id="main" className="mx-auto w-full max-w-(--content-max) flex-1 p-6">
            <Current />
          </main>
        </div>
      </div>
    </DirectionProvider>
  )
}
