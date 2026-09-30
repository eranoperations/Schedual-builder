import { describe, expect, it } from 'vitest'
import en from './en.json'
import he from './he.json'
import validateSrc from '../solver/validate.ts?raw'
import verifySrc from '../solver/verify.ts?raw'
import solverSrc from '../solver/solver.ts?raw'
import weekSrc from '../model/week.ts?raw'

const vars = (s: string) => [...s.matchAll(/{{\s*(\w+)\s*}}/g)].map((m) => m[1]).sort()

describe('i18n resources', () => {
  it('he and en have exactly the same keys', () => {
    expect(Object.keys(he).sort()).toEqual(Object.keys(en).sort())
  })
  it('every value is a non-empty string with the same interpolation variables', () => {
    for (const k of Object.keys(he) as (keyof typeof he)[]) {
      expect(typeof he[k] === 'string' && he[k].length > 0, k).toBe(true)
      expect(typeof en[k] === 'string' && en[k].length > 0, k).toBe(true)
      if (k.endsWith('_one') || k.endsWith('_two')) continue // plural forms may omit {{count}}
      expect(vars(he[k]), k).toEqual(vars(en[k]))
    }
  })
  it('has a template for every issue code the engine can emit', () => {
    const src = [validateSrc, verifySrc, solverSrc, weekSrc].join('\n')
    const codes = new Set([...src.matchAll(/'([EWIUV]_[A-Z_]+)'/g)].map((m) => m[1]))
    for (const c of codes) expect(he, c).toHaveProperty(`issues.${c}`)
  })
})
