/**
 * tailwind.theme.js: Tailwind theme extension for the timetable app.
 * Every value points at a CSS variable in tokens.css (single source of truth).
 *
 * Tailwind v3:  tailwind.config.js → module.exports = { darkMode: 'class', ...require('./tailwind.theme.js') }
 * Tailwind v4:  in your main CSS:   @import "tailwindcss"; @import "./tokens.css"; @config "./tailwind.theme.js";
 *               (or port to an `@theme inline { … }` block. A ready snippet is in design-spec.md §5.3)
 *
 * RTL: do NOT add an RTL plugin. Use Tailwind's built-in logical utilities
 * (ms-/me-/ps-/pe-/start-/end-/border-s/border-e/rounded-s/rounded-e/text-start/text-end)
 * and the built-in `rtl:` / `ltr:` variants for icon mirroring.
 */
const v = (name) => `var(--${name})`;
const ramp = (prefix, steps) =>
  Object.fromEntries(steps.map((s) => [s, v(`${prefix}-${s}`)]));

const subjects = Object.fromEntries(
  [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 'other'].map((n) => [
    n,
    { bg: v(`subject-${n}-bg`), fg: v(`subject-${n}-fg`), accent: v(`subject-${n}-accent`) },
  ]),
);

module.exports = {
  theme: {
    extend: {
      colors: {
        // primitives (use sparingly in components; prefer semantic names below)
        neutral: ramp('neutral', [0, 25, 50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]),
        brand: ramp('primary', [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]),

        // semantic
        canvas: v('ui-bg'),
        surface: { DEFAULT: v('ui-surface'), sunken: v('ui-surface-sunken'), sidebar: v('ui-surface-sidebar'), inverse: v('ui-surface-inverse') },
        fg: { DEFAULT: v('ui-text'), muted: v('ui-text-muted'), subtle: v('ui-text-subtle'), inverse: v('ui-text-inverse'), disabled: v('ui-text-disabled'), link: v('ui-text-link'), 'on-primary': v('ui-text-on-primary') },
        line: { subtle: v('ui-border-subtle'), DEFAULT: v('ui-border'), control: v('ui-border-control'), strong: v('ui-border-strong') },
        primary: { DEFAULT: v('ui-primary'), hover: v('ui-primary-hover'), active: v('ui-primary-active'), subtle: v('ui-primary-subtle'), 'subtle-fg': v('ui-primary-subtle-text'), foreground: v('ui-text-on-primary') },
        success: { DEFAULT: v('ui-success'), bg: v('ui-success-bg'), fg: v('ui-success-text'), border: v('ui-success-border') },
        warning: { DEFAULT: v('ui-warning'), bg: v('ui-warning-bg'), fg: v('ui-warning-text'), border: v('ui-warning-border') },
        error:   { DEFAULT: v('ui-error'),   bg: v('ui-error-bg'),   fg: v('ui-error-text'),   border: v('ui-error-border') },
        info:    { DEFAULT: v('ui-info'),    bg: v('ui-info-bg'),    fg: v('ui-info-text'),    border: v('ui-info-border') },
        subject: subjects, // e.g. bg-subject-3-bg text-subject-3-fg border-s-subject-3-accent
        chip: { bg: v('chip-bg'), fg: v('chip-fg'), accent: v('chip-accent') }, // driven by [data-subject-color="subject-N"] (Subject.colour token key)

        // shadcn/ui bridge (keeps generated components working)
        background: v('background'),
        foreground: v('foreground'),
        card: { DEFAULT: v('card'), foreground: v('card-foreground') },
        popover: { DEFAULT: v('popover'), foreground: v('popover-foreground') },
        secondary: { DEFAULT: v('secondary'), foreground: v('secondary-foreground') },
        muted: { DEFAULT: v('muted'), foreground: v('muted-foreground') },
        accent: { DEFAULT: v('accent'), foreground: v('accent-foreground') },
        destructive: { DEFAULT: v('destructive'), foreground: v('destructive-foreground') },
        border: v('border'),
        input: v('input'),
        ring: v('ring'),
      },
      fontFamily: {
        sans: ['Heebo', '"Segoe UI"', '"Arial Hebrew"', 'Arial', '"Noto Sans Hebrew"', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', '"Cascadia Mono"', 'Consolas', '"Liberation Mono"', 'monospace'],
      },
      fontSize: {
        '2xs': [v('text-2xs'), { lineHeight: v('leading-2xs') }],
        xs:   [v('text-xs'),   { lineHeight: v('leading-xs') }],
        sm:   [v('text-sm'),   { lineHeight: v('leading-sm') }],
        base: [v('text-base'), { lineHeight: v('leading-base') }],
        lg:   [v('text-lg'),   { lineHeight: v('leading-lg'), fontWeight: '600' }],
        xl:   [v('text-xl'),   { lineHeight: v('leading-xl'), fontWeight: '700' }],
        '2xl':[v('text-2xl'),  { lineHeight: v('leading-2xl'), fontWeight: '700' }],
        '3xl':[v('text-3xl'),  { lineHeight: v('leading-3xl'), fontWeight: '700' }],
      },
      borderRadius: {
        xs: v('radius-xs'), sm: v('radius-sm'), md: v('radius-md'), lg: v('radius-lg'),
        xl: v('radius-xl'), '2xl': v('radius-2xl'), full: v('radius-full'),
        chip: v('chip-radius'),
      },
      borderWidth: { accent: v('border-width-accent') },
      boxShadow: {
        xs: v('shadow-xs'), sm: v('shadow-sm'), md: v('shadow-md'), lg: v('shadow-lg'), drag: v('shadow-drag'),
      },
      zIndex: {
        raised: v('z-raised'), sticky: v('z-sticky'), sidebar: v('z-sidebar'), dropdown: v('z-dropdown'),
        drag: v('z-drag'), overlay: v('z-overlay'), modal: v('z-modal'), toast: v('z-toast'), tooltip: v('z-tooltip'),
      },
      transitionDuration: {
        instant: v('duration-instant'), fast: v('duration-fast'), quick: v('duration-quick'),
        normal: v('duration-normal'), medium: v('duration-medium'), slow: v('duration-slow'),
      },
      transitionTimingFunction: {
        standard: v('ease-standard'), out: v('ease-out'), in: v('ease-in'),
      },
      spacing: {
        topbar: v('topbar-height'),
        sidebar: v('sidebar-width'),
        'sidebar-collapsed': v('sidebar-width-collapsed'),
        panel: v('panel-width'),
        sheet: v('sheet-width'),
        control: v('control-md'),
        'control-sm': v('control-sm'),
        'control-lg': v('control-lg'),
        target: v('target-min'),
        'avail-cell': v('avail-cell-size'),
        'block-cell-w': v('block-cell-min-w'),
        'block-cell-h': v('block-cell-min-h'),
        'plan-cell': v('plan-cell-w'),
        'plan-cell-h': v('plan-cell-h'),
        'plan-panel': v('plan-panel-w'),
      },
      width: { 'dialog-sm': v('dialog-sm'), 'dialog-md': v('dialog-md'), 'dialog-lg': v('dialog-lg') },
      maxWidth: { content: v('content-max') },
      minHeight: { 'grid-row': v('grid-row-min'), 'table-row': v('table-row-height') },
      gridTemplateColumns: {
        // period column + N day columns; set --days on the grid element (5 or 6)
        timetable: `${v('grid-period-col-width')} repeat(var(--days, 6), minmax(${v('grid-day-col-min')}, 1fr))`,
      },
      backgroundImage: {
        'offday-hatch': v('grid-offday-hatch'),
        'block-hard': v('block-hard-bg'),
        'block-soft': v('block-soft-bg'),
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'pop-in': { from: { opacity: '0', transform: 'scale(0.97)' }, to: { opacity: '1', transform: 'scale(1)' } },
        'settle': { from: { transform: 'scale(1.04)' }, to: { transform: 'scale(1)' } },
      },
      animation: {
        'fade-in': `fade-in ${v('duration-quick')} ${v('ease-out')}`,
        'pop-in': `pop-in ${v('duration-normal')} ${v('ease-out')}`,
        settle: `settle ${v('duration-normal')} ${v('ease-standard')}`,
      },
      screens: {
        // laptop-first admin tool; below 1024px show "use a larger screen" notice for editing (read-only still works)
        lg: '1024px', xl: '1280px', '2xl': '1440px', '3xl': '1600px',
        print: { raw: 'print' },
      },
    },
  },
};
