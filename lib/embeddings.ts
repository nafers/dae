function toNumericArray(values: unknown[]) {
  const numericValues = values
    .map((value) => (typeof value === 'number' ? value : Number(value)))
    .filter((value) => Number.isFinite(value))

  return numericValues.length > 0 ? numericValues : null
}

export function parseEmbedding(value: unknown) {
  if (Array.isArray(value)) {
    return toNumericArray(value)
  }

  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  try {
    const parsed = JSON.parse(trimmed)
    if (Array.isArray(parsed)) {
      return toNumericArray(parsed)
    }
  } catch {
    // Fall back to loose parsing below.
  }

  const normalized = trimmed.replace(/^[\[\(\{]/, '').replace(/[\]\)\}]$/, '')
  if (!normalized) {
    return null
  }

  return toNumericArray(
    normalized
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
  )
}

export function cosineSimilarity(source: number[] | null, target: number[] | null) {
  if (!source || !target || source.length === 0 || target.length === 0) {
    return 0
  }

  const dimensions = Math.min(source.length, target.length)
  let dotProduct = 0
  let sourceMagnitude = 0
  let targetMagnitude = 0

  for (let index = 0; index < dimensions; index += 1) {
    const sourceValue = source[index] ?? 0
    const targetValue = target[index] ?? 0

    dotProduct += sourceValue * targetValue
    sourceMagnitude += sourceValue * sourceValue
    targetMagnitude += targetValue * targetValue
  }

  if (sourceMagnitude === 0 || targetMagnitude === 0) {
    return 0
  }

  return dotProduct / (Math.sqrt(sourceMagnitude) * Math.sqrt(targetMagnitude))
}

export function averageEmbeddings(embeddings: Array<number[] | null>) {
  const validEmbeddings = embeddings.filter((embedding): embedding is number[] => Array.isArray(embedding))

  if (validEmbeddings.length === 0) {
    return null
  }

  const dimensions = validEmbeddings[0]?.length ?? 0
  if (dimensions === 0) {
    return null
  }

  const totals = new Array<number>(dimensions).fill(0)

  for (const embedding of validEmbeddings) {
    if (embedding.length !== dimensions) {
      continue
    }

    for (let index = 0; index < dimensions; index += 1) {
      totals[index] += embedding[index] ?? 0
    }
  }

  return totals.map((value) => value / validEmbeddings.length)
}
