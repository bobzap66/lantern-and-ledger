import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import SessionNavigation from "./SessionNavigation"

type ArchiveFile = QuartzComponentProps["allFiles"][number]

// Reusable archive contract: an index declares series_archive, series_root,
// series_status, and series_entry_noun. Entries and chapter pages are then
// discovered from their existing type/series_root metadata with no campaign-specific code.
function text(value: unknown) {
  return typeof value === "string" ? value.trim() : String(value ?? "").trim()
}

function normalized(value: unknown) {
  return text(value).toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim()
}

function canonicalSlug(value: unknown) {
  return text(value)
    .replace(/^\/+|\/+$/g, "")
    .replace(/\/index$/i, "")
}

function truthy(value: unknown) {
  return value === true || normalized(value) === "true"
}

function optionalNumber(value: unknown) {
  if (value === undefined || value === null || text(value) === "") return undefined
  const number = Number(value)
  return Number.isFinite(number) ? number : undefined
}

function sessionToken(file: ArchiveFile) {
  const direct = text(file.frontmatter?.session_number)
  if (/^\d+[a-z]?$/i.test(direct)) return direct.toUpperCase()
  return /\bsession\s+(\d+[a-z]?)\b/i.exec(text(file.frontmatter?.title))?.[1]?.toUpperCase()
}

function sessionOrder(file: ArchiveFile) {
  const token = sessionToken(file)
  if (!token) return undefined
  const match = /^(\d+)([A-Z]?)$/.exec(token)
  if (!match) return undefined
  const suffix = match[2] ? match[2].charCodeAt(0) - 64 : 0
  return Number(match[1]) * 100 + suffix
}

function explicitOrder(file: ArchiveFile) {
  const raw = file.frontmatter?.series_order
  if (raw === undefined || raw === null || text(raw) === "") return undefined
  const value = Number(raw)
  return Number.isFinite(value) ? value : undefined
}

function dateKey(file: ArchiveFile) {
  const publication = text(file.frontmatter?.publication_date)
  const publicationMatch = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(publication)
  if (publicationMatch) {
    return `${publicationMatch[1]}-${publicationMatch[2].padStart(2, "0")}-${publicationMatch[3].padStart(2, "0")}`
  }

  const basename = canonicalSlug(file.slug).split("/").at(-1) ?? ""
  return /^(\d{4}-\d{2}-\d{2})/.exec(basename)?.[1]
}

function compareEntries(a: ArchiveFile, b: ArchiveFile) {
  const explicitA = explicitOrder(a)
  const explicitB = explicitOrder(b)
  if (explicitA !== undefined || explicitB !== undefined) {
    if (explicitA === undefined) return 1
    if (explicitB === undefined) return -1
    if (explicitA !== explicitB) return explicitA - explicitB
  }

  const sessionA = sessionOrder(a)
  const sessionB = sessionOrder(b)
  if (sessionA !== undefined || sessionB !== undefined) {
    if (sessionA === undefined) return 1
    if (sessionB === undefined) return -1
    if (sessionA !== sessionB) return sessionA - sessionB
  }

  const dateA = dateKey(a)
  const dateB = dateKey(b)
  if (dateA || dateB) {
    if (!dateA) return 1
    if (!dateB) return -1
    const dateDiff = dateA.localeCompare(dateB)
    if (dateDiff !== 0) return dateDiff
  }

  return text(a.frontmatter?.title).localeCompare(text(b.frontmatter?.title))
}

function entriesForRoot(root: string, allFiles: ArchiveFile[]) {
  return allFiles
    .filter((file) => {
      if (!file.slug || normalized(file.frontmatter?.type) !== "session note") return false
      return canonicalSlug(file.slug).startsWith(`${root}/`)
    })
    .sort(compareEntries)
}

function chaptersForRoot(root: string, allFiles: ArchiveFile[]) {
  return allFiles
    .filter((file) => {
      if (!file.slug || normalized(file.frontmatter?.type) !== "series chapter") return false
      return canonicalSlug(file.frontmatter?.series_root) === root
    })
    .sort((a, b) => {
      const orderA = optionalNumber(a.frontmatter?.chapter_order) ?? Number.POSITIVE_INFINITY
      const orderB = optionalNumber(b.frontmatter?.chapter_order) ?? Number.POSITIVE_INFINITY
      if (orderA !== orderB) return orderA - orderB
      return text(a.frontmatter?.title).localeCompare(text(b.frontmatter?.title))
    })
}

function titleFor(file: ArchiveFile) {
  return text(file.frontmatter?.title) || "Archive entry"
}

function hrefFor(root: string, file: ArchiveFile) {
  if (!file.slug) return "#"
  const target = canonicalSlug(file.slug)
  const prefix = `${root}/`
  return target.startsWith(prefix) ? `./${target.slice(prefix.length)}` : "#"
}

function archiveAction(root: string, file: ArchiveFile, eyebrow: string, cta: string) {
  return (
    <a href={hrefFor(root, file)} class="series-archive-action internal">
      <span class="series-archive-action__eyebrow">{eyebrow}</span>
      <span class="series-archive-action__title">{titleFor(file)}</span>
      <span class="series-archive-action__cta">{cta} <span aria-hidden="true">→</span></span>
    </a>
  )
}

export default (() => {
  const legacyArchiveActions = SessionNavigation({ mode: "archive" })

  const ArchiveReadingActions: QuartzComponent = (props: QuartzComponentProps) => {
    const { fileData, allFiles, displayClass } = props
    const root = canonicalSlug(fileData.frontmatter?.series_root)
    const isSeriesArchive = truthy(fileData.frontmatter?.series_archive) || Boolean(root)

    if (!isSeriesArchive || !root) return legacyArchiveActions(props)

    const entries = entriesForRoot(root, allFiles)
    if (entries.length === 0) return legacyArchiveActions(props)

    const chapters = chaptersForRoot(root, allFiles)
    const complete = normalized(fileData.frontmatter?.series_status) === "complete"
    const availableChapters = chapters.filter(
      (chapter) => normalized(chapter.frontmatter?.chapter_status) !== "upcoming",
    )
    const chapter = complete
      ? availableChapters.at(-1)
      : chapters.find((candidate) => truthy(candidate.frontmatter?.current_chapter)) ??
        availableChapters.at(-1)

    const first = entries[0]
    const latest = entries.at(-1)!
    const noun = text(fileData.frontmatter?.series_entry_noun) || "entry"
    const latestLabel = complete ? `Final ${noun}` : `Most recent ${noun}`
    const latestCta = complete ? `Read final ${noun}` : `Read latest ${noun}`
    const chapterLabel = complete ? "Final chapter" : "Current chapter"
    const intro = chapter
      ? complete
        ? `Start with the first ${noun}, browse the final chapter, or jump directly to the final ${noun}.`
        : `Start with the first ${noun}, browse the current chapter, or jump directly to the most recent ${noun}.`
      : complete
        ? `Start with the first ${noun}, or jump directly to the final ${noun}.`
        : `Start with the first ${noun}, or jump directly to the most recent ${noun}.`

    return (
      <section
        class={`series-archive-actions ${chapter ? "series-archive-actions--three" : ""} ${displayClass ?? ""}`.trim()}
        aria-label="Series reading shortcuts"
        data-series-root={root}
        data-series-entry-count={String(entries.length)}
      >
        <div class="series-archive-actions__heading">Read the Series</div>
        <p class="series-archive-actions__intro">{intro}</p>
        <div class="series-archive-actions__grid">
          {archiveAction(root, first, "Start from the beginning", `Read first ${noun}`)}
          {chapter && archiveAction(root, chapter, chapterLabel, complete ? "Browse final chapter" : "Browse current chapter")}
          {archiveAction(root, latest, latestLabel, latestCta)}
        </div>
      </section>
    )
  }

  ArchiveReadingActions.css = `${legacyArchiveActions.css ?? ""}
.series-archive-actions--three .series-archive-actions__grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

@media (max-width: 850px) {
  .series-archive-actions--three .series-archive-actions__grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
`

  return ArchiveReadingActions
}) satisfies QuartzComponentConstructor
