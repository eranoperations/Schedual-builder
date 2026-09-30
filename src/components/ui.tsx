/* eslint-disable react-refresh/only-export-components */
import * as SwitchPrimitive from '@radix-ui/react-switch'
import { cva, type VariantProps } from 'class-variance-authority'
import { CircleCheck, Info, OctagonAlert, TriangleAlert } from 'lucide-react'
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react'
import type { Severity } from '../model/types'
import { cn } from '../lib/utils'

// shadcn-style Button (design-spec §7.1)
export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium transition-colors focus-visible:outline-2 disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-foreground hover:bg-primary-hover active:bg-primary-active',
        secondary: 'bg-surface border border-line-control text-fg hover:bg-surface-sunken',
        ghost: 'text-fg-muted hover:bg-surface-sunken',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-error-fg',
        link: 'text-fg-link underline underline-offset-2 px-0 h-auto',
      },
      size: { sm: 'h-8 px-3 text-sm', md: 'h-10 px-4 text-base', lg: 'h-12 px-6 text-base font-semibold', icon: 'h-8 w-8 p-0' },
    },
    defaultVariants: { variant: 'secondary', size: 'md' },
  },
)
export function Button({ className, variant, size, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>) {
  return <button type="button" className={cn(buttonVariants({ variant, size }), className)} {...props} />
}

export function Card({ className, children, title, actions }: { className?: string; children: ReactNode; title?: ReactNode; actions?: ReactNode }) {
  return (
    <section className={cn('rounded-xl border border-line bg-surface p-4', className)}>
      {(title || actions) && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {title && <h2 className="text-lg font-semibold">{title}</h2>}
          <div className="ms-auto flex flex-wrap gap-2">{actions}</div>
        </div>
      )}
      {children}
    </section>
  )
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn('h-8 rounded-lg border border-line-control bg-surface px-2 text-sm text-fg', className)} {...props} />
}

export function NumberInput({ value, onChange, min = 0, max = 99, className, ...rest }: { value: number | undefined; onChange: (v: number | undefined) => void; min?: number; max?: number; className?: string; 'aria-label'?: string; placeholder?: string }) {
  return (
    <input
      type="number" inputMode="numeric" min={min} max={max}
      className={cn('num h-8 w-20 rounded-lg border border-line-control bg-surface px-2 text-sm', className)}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value === '' ? undefined : Math.max(min, Math.min(max, Math.floor(Number(e.target.value)))))}
      {...rest}
    />
  )
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn('h-8 rounded-lg border border-line-control bg-surface px-2 text-sm text-fg', className)} {...props}>{children}</select>
}

export function Switch({ checked, onCheckedChange, label }: { checked: boolean; onCheckedChange: (v: boolean) => void; label: string }) {
  return (
    <SwitchPrimitive.Root
      checked={checked} onCheckedChange={onCheckedChange} aria-label={label}
      className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 border-transparent bg-line-control transition-colors data-[state=checked]:bg-primary"
    >
      <SwitchPrimitive.Thumb className="block size-5 rounded-full bg-surface shadow-sm transition-transform translate-x-0 data-[state=checked]:translate-x-5 rtl:data-[state=checked]:-translate-x-5" />
    </SwitchPrimitive.Root>
  )
}

const SEV = {
  error: { Icon: OctagonAlert, cls: 'text-error', box: 'bg-error-bg border-s-error-border text-error-fg' },
  warning: { Icon: TriangleAlert, cls: 'text-warning', box: 'bg-warning-bg border-s-warning-border text-warning-fg' },
  info: { Icon: Info, cls: 'text-info', box: 'bg-info-bg border-s-info-border text-info-fg' },
  success: { Icon: CircleCheck, cls: 'text-success', box: 'bg-success-bg border-s-success-border text-success-fg' },
} as const

export function StatusIcon({ severity, className }: { severity: Severity | 'success'; className?: string }) {
  const { Icon, cls } = SEV[severity]
  return <Icon aria-hidden className={cn('size-4 shrink-0', cls, className)} strokeWidth={1.75} />
}

export function Alert({ severity, title, children, className }: { severity: Severity | 'success'; title: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <div role={severity === 'error' ? 'alert' : 'status'} className={cn('flex gap-3 rounded-lg border-s-4 p-3', SEV[severity].box, className)}>
      <StatusIcon severity={severity} className="mt-0.5 size-5" />
      <div className="min-w-0 flex-1">
        <div className="font-medium">{title}</div>
        {children && <div className="mt-1 text-sm text-fg">{children}</div>}
      </div>
    </div>
  )
}

export function Badge({ children, tone = 'neutral', className }: { children: ReactNode; tone?: 'neutral' | 'error' | 'warning' | 'success' | 'primary'; className?: string }) {
  const tones = {
    neutral: 'bg-surface-sunken text-fg-muted',
    error: 'bg-error text-primary-foreground',
    warning: 'bg-warning-bg text-warning-fg border border-warning-border',
    success: 'bg-success-bg text-success-fg',
    primary: 'bg-primary-subtle text-primary-subtle-fg',
  }
  return <span className={cn('inline-flex h-5 min-w-5 items-center justify-center gap-1 rounded-full px-2 text-xs font-semibold', tones[tone], className)}>{children}</span>
}

export function PageHeader({ title, description, actions }: { title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-start gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-bold">{title}</h1>
        {description && <p className="mt-1 max-w-[65ch] text-sm text-fg-muted">{description}</p>}
      </div>
      <div className="ms-auto flex flex-wrap gap-2">{actions}</div>
    </div>
  )
}

export function Table({ children, caption }: { children: ReactNode; caption?: string }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-surface">
      <table className="w-full border-collapse text-sm [&_th]:border-b [&_th]:border-line-subtle [&_th]:bg-canvas [&_th]:px-3 [&_th]:py-2 [&_th]:text-start [&_th]:font-semibold [&_th]:text-fg-muted [&_td]:border-b [&_td]:border-line-subtle [&_td]:px-3 [&_td]:py-1.5">
        {caption && <caption className="sr-only">{caption}</caption>}
        {children}
      </table>
    </div>
  )
}

export function SubjectSwatch({ color, className }: { color: string; className?: string }) {
  return <span data-subject-color={color} className={cn('subject-swatch inline-block size-3 shrink-0 rounded-full', className)} aria-hidden />
}
