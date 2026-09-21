import { EditorialCard, editorialCardCss } from "./EditorialCard"
import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { FullSlug, resolveRelative, simplifySlug } from "../util/path"

type ArchiveFile = QuartzComponentProps["allFiles"][number]

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : String(value ?? "").trim()
}

function normalized(value: unknown) {
  return text(value).toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim()
}

function canonicalSlug(value: unknown) {
  const raw = text(value)
  if (!raw) return ""
  return String(simplifySlug(raw as FullSlug)).replace(/\/index$/i, "")
}

function optionalNumber(value: unknown) {
  if (value === undefined || value === null || text(value) === "") return undefined
  const number = Number(value)
  return Number.isFinite(number) ? number : undefined
}

function sessionToken(file: ArchiveFile) {
  const direct = text(file.frontmatter?.session_number)
  if (/^\d+[a-z]?$/i.test(direct)) return direct.toUpperCase()

  const title = text(file.frontmatter?.title)
  return /\bsession\s+(\d+[a-z]?)\b/i.exec(title)?.[1]?.toUpperCase()
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
  const values = [file.frontmatter?.publication_date, file.frontmatter?.campaign_date_start]
  for (const value of values) {
    const raw = text(value)
    const match = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(raw)
    if (match) return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`
  }

  const basename = canonicalSlug(file.slug).split("/").at(-1) ?? ""
  return /^(\d{4}-\d{2}-\d{2})/.exec(basename)?.[1]
}

function compareEntries(a: ArchiveFile, b: ArchiveFile) {
  const orderA = explicitOrder(a)
  const orderB = explicitOrder(b)
  if (orderA !== undefined || orderB !== undefined) {
    if (orderA === undefined) return 1
    if (orderB === undefined) return -1
    if (orderA !== orderB) return orderA - orderB
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

function chapterEntries(fileData: QuartzComponentProps["fileData"], allFiles: ArchiveFile[]) {
  const fm = (fileData.frontmatter ?? {}) as Record<string, unknown>
  if (normalized(fm.chapter_status) === "upcoming") return []

  const root = canonicalSlug(fm.series_root)
  if (!root) return []

  const startSession = optionalNumber(fm.chapter_start_session)
  const endSession = optionalNumber(fm.chapter_end_session)
  const startKey = text(fm.chapter_start_key)
  const endKey = text(fm.chapter_end_key)

  return allFiles
    .filter((file) => {
      if (!file.slug || normalized(file.frontmatter?.type) !== "session note") return false
      if (!canonicalSlug(file.slug).startsWith(`${root}/`)) return false

      if (startSession !== undefined || endSession !== undefined) {
        const order = sessionOrder(file)
        if (order === undefined) return false
        const numericSession = Math.floor(order / 100)
        if (startSession !== undefined && numericSession < startSession) return false
        if (endSession !== undefined && numericSession > endSession) return false
      }

      if (startKey || endKey) {
        const key = dateKey(file)
        if (!key) return false
        if (startKey && key.localeCompare(startKey) < 0) return false
        if (endKey && key.localeCompare(endKey) > 0) return false
      }

      return true
    })
    .sort(compareEntries)
}

function chapterPages(root: string, allFiles: ArchiveFile[]) {
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

function displayDate(value: unknown) {
  const raw = text(value)
  const numeric = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(raw)
  if (numeric) {
    const month = GOLARION_MONTHS[Number(numeric[2]) - 1]
    return month ? `${Number(numeric[3])} ${month} ${numeric[1]}` : raw
  }

  const named = /^(\d{4})-([A-Za-z]+)-(\d{1,2})$/.exec(raw)
  if (named) return `${Number(named[3])} ${named[2]} ${named[1]}`
  return raw
}

function descriptionFor(file: ArchiveFile) {
  const fm = file.frontmatter ?? {}
  return (
    text(fm.card_description) ||
    text(fm.description) ||
    text(fm.card_summary) ||
    text(fm.summary) ||
    undefined
  )
}

function titleFor(file: ArchiveFile) {
  return text(file.frontmatter?.title) || canonicalSlug(file.slug).split("/").at(-1) || "Archive entry"
}

export default (() => {
  const ChapterLanding: QuartzComponent = ({ fileData, allFiles, displayClass }: QuartzComponentProps) => {
    const fm = (fileData.frontmatter ?? {}) as Record<string, unknown>
    if (normalized(fm.type) !== "series chapter" || !fileData.slug) return null

    const root = canonicalSlug(fm.series_root)
    if (!root) return null

    const entries = chapterEntries(fileData, allFiles)
    const chapters = chapterPages(root, allFiles)
    const currentSlug = canonicalSlug(fileData.slug)
    const chapterIndex = chapters.findIndex((file) => file.slug && canonicalSlug(file.slug) === currentSlug)
    const previous = chapterIndex > 0 ? chapters[chapterIndex - 1] : undefined
    const next = chapterIndex >= 0 && chapterIndex < chapters.length - 1 ? chapters[chapterIndex + 1] : undefined
    const first = entries[0]
    const latest = entries.at(-1)
    const entryLabel = text(fm.entry_label) || "Entry"
    const entryCta = text(fm.entry_cta) || "Read entry"
    const status = normalized(fm.chapter_status)

    const hrefTo = (file: ArchiveFile) =>
      resolveRelative(fileData.slug!, canonicalSlug(file.slug) as FullSlug)

    const cardFor = (file: ArchiveFile) => {
      const session = sessionToken(file)
      const publicationDate = displayDate(file.frontmatter?.publication_date)
      const eyebrow = session ? `${entryLabel} ${session}` : publicationDate || entryLabel
      const meta = session && publicationDate ? publicationDate : undefined

      return (
        <EditorialCard
          href={hrefTo(file)}
          title={titleFor(file)}
          eyebrow={eyebrow}
          description={descriptionFor(file)}
          meta={meta}
          cta={entryCta}
          className="chapter-entry-card"
        />
      )
    }

    return (
      <section class={`chapter-landing-index ${displayClass ?? ""}`.trim()} aria-label="Chapter entries">
        {entries.length > 0 ? (
          <>
            <div class="chapter-reading-actions">
              <div class="chapter-reading-actions__heading">Read this chapter</div>
              <div class="chapter-reading-actions__grid">
                {first && (
                  <EditorialCard
                    href={hrefTo(first)}
                    title={titleFor(first)}
                    eyebrow="Start chapter"
                    cta={`Read first ${entryLabel.toLowerCase()}`}
                    className="chapter-reading-card"
                  />
                )}
                {latest && latest.slug !== first?.slug && (
                  <EditorialCard
                    href={hrefTo(latest)}
                    title={titleFor(latest)}
                    eyebrow={status === "current" ? "Latest in chapter" : "End of chapter"}
                    cta={status === "current" ? `Read latest ${entryLabel.toLowerCase()}` : `Read final ${entryLabel.toLowerCase()}`}
                    className="chapter-reading-card"
                  />
                )}
              </div>
            </div>

            <div class="chapter-entry-index__header">
              <h2>{text(fm.entries_heading) || "Entries"}</h2>
              <p>{entries.length} {entries.length === 1 ? entryLabel.toLowerCase() : `${entryLabel.toLowerCase()}s`} in this chapter</p>
            </div>
            <div class="chapter-entry-grid">{entries.map(cardFor)}</div>
          </>
        ) : (
          <div class="chapter-entry-index__empty">
            <h2>{text(fm.entries_heading) || "Entries"}</h2>
            <p>{status === "upcoming" ? "This chapter has not yet begun." : "No entries have been filed for this chapter yet."}</p>
          </div>
        )}

        <nav class="chapter-navigation" aria-label="Chapter navigation">
          <div class="chapter-navigation__grid">
            {previous?.slug ? (
              <a href={hrefTo(previous)} class="chapter-navigation__item internal">
                <span class="chapter-navigation__label">← Previous chapter</span>
                <span class="chapter-navigation__title">{titleFor(previous)}</span>
              </a>
            ) : <span class="chapter-navigation__item is-empty" aria-hidden="true" />}

            <a href={resolveRelative(fileData.slug, root as FullSlug)} class="chapter-navigation__item chapter-navigation__archive internal">
              <span class="chapter-navigation__label">Full archive</span>
              <span class="chapter-navigation__title">{text(fm.archive_label) || "All chapters"}</span>
            </a>

            {next?.slug ? (
              <a href={hrefTo(next)} class="chapter-navigation__item chapter-navigation__next internal">
                <span class="chapter-navigation__label">Next chapter →</span>
                <span class="chapter-navigation__title">{titleFor(next)}</span>
              </a>
            ) : <span class="chapter-navigation__item is-empty" aria-hidden="true" />}
          </div>
        </nav>
      </section>
    )
  }

  ChapterLanding.css = `
${editorialCardCss}

.chapter-landing-index {
  margin: 2.2rem 0 0.75rem;
  padding-top: 1.25rem;
  border-top: 1px solid var(--campaign-page-rule, var(--lightgray));
}

.chapter-reading-actions {
  margin-bottom: 2rem;
}

.chapter-reading-actions__heading,
.chapter-entry-index__header h2 {
  margin: 0;
  color: var(--campaign-page-accent, var(--tertiary));
  font-family: var(--bodyFont);
  font-size: 0.74rem;
  font-weight: 700;
  letter-spacing: 0.13em;
  line-height: 1.3;
  text-transform: uppercase;
}

.chapter-reading-actions__grid,
.chapter-entry-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.8rem;
  margin-top: 0.85rem;
}

.chapter-reading-card,
.chapter-entry-card {
  height: 100%;
  box-sizing: border-box;
}

.chapter-entry-index__header p {
  margin: 0.18rem 0 0;
  color: var(--gray);
  font-size: 0.82rem;
  font-style: italic;
}

.chapter-entry-index__empty {
  padding: 0.9rem 1rem;
  border: 1px dashed var(--campaign-page-rule, var(--lightgray));
  border-radius: 0.55rem;
  background: color-mix(in srgb, var(--light) 97%, var(--lightgray) 3%);
}

.chapter-entry-index__empty h2 {
  margin-top: 0;
}

.chapter-entry-index__empty p {
  margin-bottom: 0;
  color: var(--gray);
}

.chapter-navigation {
  margin-top: 2.25rem;
  padding-top: 1.25rem;
  border-top: 1px solid var(--campaign-page-rule, var(--lightgray));
}

.chapter-navigation__grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(11rem, 0.9fr) minmax(0, 1fr);
  gap: 0.8rem;
}

.chapter-navigation__item {
  display: flex;
  min-width: 0;
  flex-direction: column;
  justify-content: center;
  padding: 0.75rem 0.85rem;
  border: 1px solid var(--campaign-page-rule, var(--lightgray));
  border-radius: 0.55rem;
  background: color-mix(in srgb, var(--light) 94%, var(--lightgray) 6%);
  color: inherit;
  text-decoration: none;
}

.chapter-navigation__item:hover {
  border-color: var(--campaign-page-accent, var(--secondary));
}

.chapter-navigation__archive { text-align: center; }
.chapter-navigation__next { text-align: right; }
.chapter-navigation__label {
  color: var(--campaign-page-accent, var(--gray));
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.065em;
  text-transform: uppercase;
}
.chapter-navigation__title {
  margin-top: 0.18rem;
  font-family: var(--headerFont);
  font-size: 0.94rem;
  font-weight: 700;
  line-height: 1.25;
}
.chapter-navigation__item.is-empty { visibility: hidden; }

@media (max-width: 700px) {
  .chapter-reading-actions__grid,
  .chapter-entry-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .chapter-navigation__grid {
    grid-template-columns: 1fr 1fr;
  }

  .chapter-navigation__archive {
    grid-column: 1 / -1;
    grid-row: 1;
  }
}
`

  return ChapterLanding
}) satisfies QuartzComponentConstructor
