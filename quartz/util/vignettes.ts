import fs from "node:fs"
import path from "node:path"
import YAML from "yaml"
import { simplifySlug, slugifyFilePath } from "./path"

export type VignetteNote = {
  absolutePath: string
  relativePath: string
  slug: any
  frontmatter: Record<string, any>
}

export type VignetteDate = {
  iso: string
  year: string
  label: string
  rank: number
  sortGroup: number
  kind: "campaign" | "publication" | "undated"
}

const GOLARION_MONTHS = [
  "Abadius",
  "Calistril",
  "Pharast",
  "Gozran",
  "Desnus",
  "Sarenith",
  "Erastus",
  "Arodus",
  "Rova",
  "Lamashan",
  "Neth",
  "Kuthona",
]

export function normalizeVaultPath(value: string) {
  return value
    .replaceAll("\\", "/")
    .replace(/^\.\//, "")
    .replace(/^\/+|\/+$/g, "")
}

export function wikilinkTarget(value: unknown) {
  if (typeof value !== "string") return ""
  const text = value.trim()
  const match = text.match(/^\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]$/)
  return normalizeVaultPath((match ? match[1] : text).trim().replace(/\.md$/i, ""))
}

export function wikilinkLabel(value: unknown, fallback = "") {
  if (typeof value !== "string") return fallback
  return (
    value.match(/\|([^\]]+)\]\]$/)?.[1]?.trim() ??
    path.posix.basename(wikilinkTarget(value)) ??
    fallback
  )
}

function readFrontmatter(filePath: string): Record<string, any> {
  try {
    const source = fs.readFileSync(filePath, "utf8")
    const match = source.match(/^---\s*\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)
    return match ? (YAML.parse(match[1]) ?? {}) : {}
  } catch {
    return {}
  }
}

function markdownFiles(directory: string): string[] {
  const result: string[] = []
  const visit = (current: string) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue
      const full = path.join(current, entry.name)
      if (entry.isDirectory()) visit(full)
      else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) result.push(full)
    }
  }
  visit(directory)
  return result
}

export function indexVignetteNotes(vaultRoot: string): VignetteNote[] {
  return markdownFiles(vaultRoot).map((absolutePath) => {
    const relativePath = normalizeVaultPath(path.relative(vaultRoot, absolutePath))
    return {
      absolutePath,
      relativePath,
      slug: simplifySlug(slugifyFilePath(relativePath as any)),
      frontmatter: readFrontmatter(absolutePath),
    }
  })
}

export function isCharacterNote(note: VignetteNote) {
  return (
    normalizeVaultPath(note.relativePath).toLowerCase().includes("/characters/") &&
    String(note.frontmatter?.type ?? "").toLowerCase() === "person"
  )
}

export function isVignetteArchive(note: VignetteNote) {
  return (
    normalizeVaultPath(note.relativePath).toLowerCase().includes("/vignettes/") &&
    String(note.frontmatter?.type ?? "").toLowerCase() === "index" &&
    Boolean(note.frontmatter?.character)
  )
}

export function isVignette(note: VignetteNote) {
  return (
    normalizeVaultPath(note.relativePath).toLowerCase().includes("/vignettes/") &&
    String(note.frontmatter?.type ?? "").toLowerCase() === "vignette"
  )
}

export function campaignRoot(relativePath: string) {
  const normalized = normalizeVaultPath(relativePath)
  const match = normalized.match(/^(Campaigns\/[^/]+)(?:\/|$)/i)
  return match?.[1] ?? ""
}

function logicalNotePath(value: string) {
  return normalizeVaultPath(value)
    .replace(/\/index$/i, "")
    .toLowerCase()
}

export function resolvedWikilinkPath(source: VignetteNote, value: unknown) {
  const target = wikilinkTarget(value)
  if (!target) return ""
  if (/^(Campaigns|Atlas|Bestiary|Rules|World)\//i.test(target)) return normalizeVaultPath(target)
  return normalizeVaultPath(
    path.posix.normalize(path.posix.join(path.posix.dirname(source.relativePath), target)),
  )
}

export function archiveForCharacter(character: VignetteNote, allNotes: VignetteNote[]) {
  const configured =
    typeof character.frontmatter?.vignette_index === "string"
      ? normalizeVaultPath(character.frontmatter.vignette_index).toLowerCase()
      : ""
  if (configured) {
    const match = allNotes.find((candidate) => String(candidate.slug).toLowerCase() === configured)
    if (match) return match
  }

  const root = campaignRoot(character.relativePath).toLowerCase()
  const characterPath = logicalNotePath(character.relativePath.replace(/\.md$/i, ""))
  const semanticMatch = allNotes.find((candidate) => {
    if (
      !isVignetteArchive(candidate) ||
      campaignRoot(candidate.relativePath).toLowerCase() !== root
    )
      return false
    return (
      logicalNotePath(resolvedWikilinkPath(candidate, candidate.frontmatter.character)) ===
      characterPath
    )
  })
  if (semanticMatch) return semanticMatch

  const characterName = path.posix.basename(characterPath)
  const expectedDirectory = `${root}/vignettes/${characterName}`
  return allNotes.find(
    (candidate) =>
      isVignetteArchive(candidate) &&
      path.posix.dirname(candidate.relativePath).toLowerCase() === expectedDirectory,
  )
}

export function archiveForVignette(vignette: VignetteNote, allNotes: VignetteNote[]) {
  const directory = path.posix.dirname(normalizeVaultPath(vignette.relativePath)).toLowerCase()
  return allNotes.find(
    (candidate) =>
      isVignetteArchive(candidate) &&
      path.posix.dirname(normalizeVaultPath(candidate.relativePath)).toLowerCase() === directory,
  )
}

export function vignettesForArchive(archive: VignetteNote, allNotes: VignetteNote[]) {
  const directory = path.posix.dirname(normalizeVaultPath(archive.relativePath)).toLowerCase()
  return allNotes.filter(
    (candidate) =>
      isVignette(candidate) &&
      path.posix.dirname(normalizeVaultPath(candidate.relativePath)).toLowerCase() === directory,
  )
}

export function vignetteDate(frontmatter: Record<string, any>, fallbackPath = ""): VignetteDate {
  if (String(frontmatter?.date_status ?? "").toLowerCase() === "uncertain") {
    return {
      iso: "",
      year: "Undated",
      label: "Undated",
      rank: Number.MAX_SAFE_INTEGER,
      sortGroup: 2,
      kind: "undated",
    }
  }

  const raw = String(frontmatter?.date ?? "").trim()
  const filenameMatch = path.posix
    .basename(normalizeVaultPath(fallbackPath))
    .match(/^(\d{4}-\d{2}-\d{2})/)
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : (filenameMatch?.[1] ?? "")
  if (iso) {
    const [year, month, day] = iso.split("-").map(Number)
    const date = new Date(Date.UTC(year, month - 1, day))
    const label = new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    }).format(date)
    return {
      iso,
      year: String(year),
      label,
      rank: year * 10000 + month * 100 + day,
      sortGroup: 1,
      kind: "publication",
    }
  }

  const campaign = String(frontmatter?.campaign_date_name ?? "").trim()
  const dayMatch = campaign.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})\s+AR$/)
  const monthMatch = campaign.match(/^([A-Za-z]+)\s+(\d{4})\s+AR$/)
  const monthNumber = (name: string) =>
    GOLARION_MONTHS.findIndex((month) => month.toLowerCase() === name.toLowerCase()) + 1
  if (dayMatch) {
    const day = Number(dayMatch[1]),
      month = monthNumber(dayMatch[2]),
      year = Number(dayMatch[3])
    if (month)
      return {
        iso: "",
        year: `${year} AR`,
        label: `${dayMatch[2]} ${day}`,
        rank: year * 10000 + month * 100 + day,
        sortGroup: 0,
        kind: "campaign",
      }
  }
  if (monthMatch) {
    const month = monthNumber(monthMatch[1]),
      year = Number(monthMatch[2])
    if (month)
      return {
        iso: "",
        year: `${year} AR`,
        label: monthMatch[1],
        rank: year * 10000 + month * 100,
        sortGroup: 0,
        kind: "campaign",
      }
  }
  return {
    iso: "",
    year: "Undated",
    label: "Undated",
    rank: Number.MAX_SAFE_INTEGER,
    sortGroup: 2,
    kind: "undated",
  }
}

export function compareVignettes(a: VignetteNote, b: VignetteNote) {
  const aDate = vignetteDate(a.frontmatter, a.relativePath)
  const bDate = vignetteDate(b.frontmatter, b.relativePath)
  return (
    aDate.sortGroup - bDate.sortGroup ||
    aDate.rank - bDate.rank ||
    String(a.frontmatter?.title ?? a.relativePath).localeCompare(
      String(b.frontmatter?.title ?? b.relativePath),
    )
  )
}

export function relativeSlugHref(fromRelativePath: string, toSlug: any) {
  const sourceDirectory = path.posix.dirname(normalizeVaultPath(fromRelativePath))
  const directoryIndexPath = sourceDirectory === "." ? "index.md" : `${sourceDirectory}/index.md`
  const fromDirectorySlug = String(
    simplifySlug(slugifyFilePath(directoryIndexPath as any)),
  ).replaceAll("\\", "/")
  const target = String(toSlug).replaceAll("\\", "/")
  let href = path.posix.relative(fromDirectorySlug, target)
  if (!href || href === ".") return "./"
  if (!href.startsWith(".")) href = `./${href}`
  return href
}
