interface SupabaseLikeError {
  code?: string | null
  message?: string | null
}

export function isMissingRelationError(error: SupabaseLikeError | null | undefined) {
  if (!error) {
    return false
  }

  return error.code === '42P01' || error.message?.toLowerCase().includes('relation') === true
}
