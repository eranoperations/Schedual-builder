import type { SchoolSnapshot, SolveResult, SolverOptions } from '../model/types'
import type { SolveProgress } from '../solver'

export interface SolveJob {
  promise: Promise<SolveResult>
  cancel: () => void
}

/** Runs the solver in a Web Worker. `cancel` asks for the best-so-far result. */
export function runSolver(data: SchoolSnapshot, options: Partial<SolverOptions>, onProgress: (p: SolveProgress) => void): SolveJob {
  const worker = new Worker(new URL('./solver.worker.ts', import.meta.url), { type: 'module' })
  const promise = new Promise<SolveResult>((resolve, reject) => {
    worker.onmessage = (e) => {
      if (e.data.type === 'progress') onProgress(e.data.progress)
      else if (e.data.type === 'result') { resolve(e.data.result); worker.terminate() }
      else if (e.data.type === 'error') { reject(new Error(e.data.message)); worker.terminate() }
    }
    worker.onerror = (e) => { reject(new Error(e.message)); worker.terminate() }
  })
  worker.postMessage({ type: 'solve', data, options })
  return { promise, cancel: () => worker.postMessage({ type: 'cancel' }) }
}
