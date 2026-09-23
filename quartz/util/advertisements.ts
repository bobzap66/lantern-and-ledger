import fs from "node:fs"
import path from "node:path"
import YAML from "yaml"

export type AdvertisementRecord = {
  sourcePath: string
  title: string
  asset: string
  caption?: string
  advertiser?: string
  advertiserRecord?: string
  headline: string
  copy: string
  locations: string[]
  publicationDate: string
  limitedRun: boolean
  runStartDate?: string
  runEndDate?: string
}

export type AdvertisementSelection = {
  pageDate: string
  pageLocations: string[]
  seed: string
  pinned?: string
}

const GOLARION_MONTHS = [
  "abadius",
  "calistril",
  "pharast",
  "gozran",
  "desnus",
  "sarenith",
  "erastus",
  "arodus",
  "rova",
  "lamashan",
  "neth",
  "kuthona",
]

const catalogCache = new Map<string, AdvertisementRecord[]>()

function list(value: unknown): string[] {
  if (value == null) return []
  return (Array.isArray(value) ? value : [value]).map((item) => String(item).trim()).filter(Boolean)
}

export function semanticName(value: string) {
  const trimmed = value.trim()
  const wiki = /^\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|([^\]]+))?\]\]$/.exec(trimmed)
  const name = wiki ? (wiki[2] ?? path.basename(wiki[1])) : trimmed
  return name
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
}

export function parseGolarionDate(value: unknown): number | undefined {
  const text = String(value ?? "").trim()
  const match = /^(\d+)-([A-Za-z]+|\d{1,2})(?:-(\d{1,2}))?$/.exec(text)
  if (!match) return undefined

  const year = Number(match[1])
  const numericMonth = /^\d+$/.test(match[2]) ? Number(match[2]) : undefined
  const month = numericMonth ?? GOLARION_MONTHS.indexOf(match[2].toLowerCase()) + 1
  const day = match[3] ? Number(match[3]) : 1
  if (!Number.isInteger(year) || month < 1 || month > 12 || day < 1 || day > 30) {
    return undefined
  }

  return year * 360 + (month - 1) * 30 + (day - 1)
}

function readFrontmatter(filePath: string): Record<string, unknown> | undefined {
  try {
    const source = fs.readFileSync(filePath, "utf8")
    const match = /^---\s*\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(source)
    return match ? (YAML.parse(match[1]) as Record<string, unknown>) : undefined
  } catch {
    return undefined
  }
}

export function readAdvertisementCatalog(vaultRoot: string): AdvertisementRecord[] {
  const root = path.resolve(vaultRoot)
  const cached = catalogCache.get(root)
  if (cached) return cached

  const directory = path.join(root, "Image Metadata", "Advertisements")
  if (!fs.existsSync(directory)) return []

  const records = fs
    .readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".md"))
    .flatMap((entry): AdvertisementRecord[] => {
      const sourcePath = path.join(directory, entry.name)
      const fm = readFrontmatter(sourcePath)
      if (!fm || String(fm.type ?? "").toLowerCase() !== "image") return []

      const asset = String(fm.asset ?? "")
        .replaceAll("\\", "/")
        .replace(/^\/+/, "")
      const publicationDate = String(fm.publication_date ?? "").trim()
      const copy = String(fm.advertisement_copy ?? "").trim()
      if (!asset || !publicationDate || !copy || parseGolarionDate(publicationDate) == null)
        return []

      const limitedRun = fm.limited_run === true || String(fm.limited_run).toLowerCase() === "true"
      const runStartDate = String(fm.run_start_date ?? "").trim() || undefined
      const runEndDate = String(fm.run_end_date ?? "").trim() || undefined
      if (
        limitedRun &&
        (parseGolarionDate(runStartDate) == null || parseGolarionDate(runEndDate) == null)
      ) {
        return []
      }

      return [
        {
          sourcePath,
          title: String(fm.title ?? path.basename(entry.name, ".md")),
          asset,
          caption: typeof fm.caption === "string" ? fm.caption.trim() : undefined,
          advertiser: typeof fm.advertiser === "string" ? fm.advertiser.trim() : undefined,
          advertiserRecord:
            typeof fm.advertiser_record === "string" ? fm.advertiser_record.trim() : undefined,
          headline: String(
            fm.advertisement_headline ?? fm.advertiser ?? fm.title ?? "Advertisement",
          ).trim(),
          copy,
          locations: list(fm.locations ?? fm.location),
          publicationDate,
          limitedRun,
          runStartDate,
          runEndDate,
        },
      ]
    })
    .sort((a, b) => a.title.localeCompare(b.title))

  catalogCache.set(root, records)
  return records
}

export function stableHash(value: string) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function locationMatches(advertisement: AdvertisementRecord, pageLocations: string[]) {
  if (advertisement.locations.length === 0) return true
  const wanted = new Set(pageLocations.map(semanticName).filter(Boolean))
  if (wanted.size === 0) return false
  return advertisement.locations.some((location) => wanted.has(semanticName(location)))
}

export function eligibleAdvertisements(
  records: AdvertisementRecord[],
  pageDate: string,
  pageLocations: string[],
) {
  const date = parseGolarionDate(pageDate)
  if (date == null) return []

  return records.filter((advertisement) => {
    const publication = parseGolarionDate(advertisement.publicationDate)
    if (
      publication == null ||
      date < publication ||
      !locationMatches(advertisement, pageLocations)
    ) {
      return false
    }
    if (!advertisement.limitedRun) return true

    const start = parseGolarionDate(advertisement.runStartDate)
    const end = parseGolarionDate(advertisement.runEndDate)
    return start != null && end != null && date >= start && date <= end
  })
}

function pinMatches(advertisement: AdvertisementRecord, pinned: string) {
  const wanted = semanticName(pinned)
  return [advertisement.title, advertisement.headline, advertisement.advertiser ?? ""]
    .map(semanticName)
    .includes(wanted)
}

export function selectAdvertisement(
  records: AdvertisementRecord[],
  selection: AdvertisementSelection,
): AdvertisementRecord | undefined {
  const eligible = eligibleAdvertisements(records, selection.pageDate, selection.pageLocations)
  if (eligible.length === 0) return undefined

  if (selection.pinned) {
    const pinned = eligible.find((advertisement) => pinMatches(advertisement, selection.pinned!))
    if (pinned) return pinned
  }

  const limited = eligible.filter((advertisement) => advertisement.limitedRun)
  const ordinary = eligible.filter((advertisement) => !advertisement.limitedRun)
  let pool = eligible
  if (limited.length > 0 && ordinary.length > 0) {
    pool = stableHash(`${selection.seed}|limited-run-bucket`) % 4 < 3 ? limited : ordinary
  } else if (limited.length > 0) {
    pool = limited
  } else if (ordinary.length > 0) {
    pool = ordinary
  }

  return pool[stableHash(`${selection.seed}|advertisement`) % pool.length]
}

export function pageAdvertisementLocations(frontmatter: Record<string, unknown>, slug = "") {
  const values = [
    ...list(frontmatter.location),
    ...list(frontmatter.locations),
    ...list(frontmatter.dateline),
    ...list(frontmatter.bureau),
    ...list(frontmatter.publication_location),
    ...list(frontmatter.advertisement_locations),
  ]
  const campaign = semanticName(String(frontmatter.campaign ?? ""))
  if (values.length === 0 && campaign === "kingmaker") values.push("Thumpington")
  const type = semanticName(String(frontmatter.type ?? ""))
  if (
    ["location", "landmark", "settlement", "building", "business"].includes(type) ||
    slug.toLowerCase().includes("/settlements/")
  ) {
    values.push(String(frontmatter.title ?? ""))
  }
  return Array.from(
    new Map(values.filter(Boolean).map((value) => [semanticName(value), value])).values(),
  )
}
