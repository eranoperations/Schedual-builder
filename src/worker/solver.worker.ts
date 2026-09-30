/// <reference lib="webworker" />
import { solveAsync } from '../solver'
import type { SchoolSnapshot, SolverOptions } from '../model/types'

export type WorkerIn = { type: 'solve'; data: SchoolSnapshot; options: Partial<SolverOptions> } | { type: 'cancel' }

let cancel = false
self.onmessage = async (e: MessageEvent<WorkerIn>) => {
  if (e.data.type === 'cancel') { cancel = true; return }
  cancel = false
  try {
    const result = await solveAsync(e.data.data, e.data.options, {
      onProgress: (p) => self.postMessage({ type: 'progress', progress: p }),
      shouldCancel: () => cancel,
    })
    self.postMessage({ type: 'result', result })
  } catch (err) {
    self.postMessage({ type: 'error', message: String(err) })
  }
}
