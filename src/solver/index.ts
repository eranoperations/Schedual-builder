/** Public solver/checker API — see docs/SOLVER_API.md. */
export { solve, solveAsync, solveSteps } from './solver'
export type { SolveHooks, SolvePhase, SolveProgress } from './solver'
export { validate, hasBlockingErrors } from './validate'
export { verifyTimetable, canMove, teacherLoads, HARD_CHECKERS } from './verify'
export type { VerificationReport, MoveCheck, TeacherLoad } from './verify'
export { qualityReport, softScore, softMetrics } from './quality'
export type { SoftScore } from './quality'
