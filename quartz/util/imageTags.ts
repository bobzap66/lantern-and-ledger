export function validImageTagQuery(query: unknown): query is Record<string, any> {
  if (!query || typeof query !== "object" || Array.isArray(query)) return false
  const q = query as Record<string, unknown>
  if (q.match !== undefined && q.match !== "any" && q.match !== "all") return false
  return [q.tag, q.tags].every((value) => value === undefined ||
    (typeof value === "string" && value.trim().length > 0) ||
    (Array.isArray(value) && value.length > 0 && value.every((tag) => typeof tag === "string" && tag.trim().length > 0)))
}

export function matchesImageTags(available: string[], wanted: unknown, mode = "any") {
  if (wanted === undefined) return true
  const normalize = (value: string) => value.trim().replace(/^#/, "").toLowerCase()
  const tags = new Set(available.map(normalize))
  const targets = (Array.isArray(wanted) ? wanted : [wanted]).map((value) => normalize(String(value)))
  return mode === "all" ? targets.every((tag) => tags.has(tag)) : targets.some((tag) => tags.has(tag))
}

export function uniqueImageAssets<T extends { asset: string }>(records: T[], resolve: (asset: string) => string): T[] {
  const seen = new Set<string>()
  return records.filter((record) => {
    const key = resolve(record.asset)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
