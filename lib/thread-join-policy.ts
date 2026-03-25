export const AUTO_JOIN_THREAD_FIT_THRESHOLD = 0.5

export function canAutoJoinThreadWithFitScore(score: number | null | undefined) {
  return typeof score === 'number' && score >= AUTO_JOIN_THREAD_FIT_THRESHOLD
}
