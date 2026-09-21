import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { FullSlug, resolveRelative, simplifySlug } from "../util/path"

type SessionFile = QuartzComponentProps["allFiles"][number]

type SessionSeries = {
  root: FullSlug
  archiveTitle: string
  ariaLabel: string
}

type WikiLink = {
  target: string
  label?: string
}

type SessionNavigationOptions = {
  mode?: "article" | "archive"
}

const SEASON_OF_GHOSTS_ROOT = "campaigns/season-of-ghosts/session-notes"
const auditedFileSets = new WeakSet<object>()

function isSessionNote(file: SessionFile) {
  return String(file.frontmatter?.type ?? "").trim().toLowerCase() === "session-note"
}

function parseWikiLink(value: unknown): WikiLink | undefined {
  const raw = String(value ?? "").trim()
  const match = /^\[\[([^\]|]+)(?:\|([^\]]+))?\]\]$/.exec(raw)
  if (!match) return undefined

  return {
    target: match[1].trim(),
    label: match[2]?.trim(),
  }
}

function slugLikePath(value: string) {
  return value
    .replace(/\\/g, "/")
    .replace(/\.md$/i, "")
    .replace(/\/index$/i, "")
    .split("/")
    .map((segment) =>
      segment
        .trim()
        .toLowerCase()
        .replace(/[’']/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, ""),
    )
    .filter(Boolean)
    .join("/")
}

function archiveRootFor(file: SessionFile) {
  if (!file.slug) return undefined

  const slug = simplifySlug(file.slug)
  const sessionNotesMarker = "/session-notes"
  const sessionNotesIndex = slug.indexOf(sessionNotesMarker)

  if (sessionNotesIndex >= 0) {
    return slug.slice(0, sessionNotesIndex + sessionNotesMarker.length) as FullSlug
  }

  const parent = parseWikiLink(file.frontmatter?.parent)
  if (!parent?.target || parent.target.startsWith(".")) return undefined

  const parentSlug = slugLikePath(parent.target)
  return parentSlug ? (parentSlug as FullSlug) : undefined
}

function campaignLabelFor(file: SessionFile) {
  const campaign = parseWikiLink(file.frontmatter?.campaign)
  return campaign?.label?.trim()
}

function archiveTitleFor(file: SessionFile, root: FullSlug, allFiles: SessionFile[]) {
  const explicitSeries = String(file.frontmatter?.series ?? "").trim()
  if (explicitSeries) return explicitSeries

  const archiveFile = allFiles.find(
    (candidate) => candidate.slug && simplifySlug(candidate.slug) === root,
  )
  const archiveTitle = String(archiveFile?.frontmatter?.title ?? "").trim()

  if (archiveTitle) {
    if (archiveTitle.toLowerCase() === "session notes") {
      const campaign = campaignLabelFor(file)
      return campaign ? `${campaign} Session Notes` : archiveTitle
    }
    return archiveTitle
  }

  const parent = parseWikiLink(file.frontmatter?.parent)
  if (parent?.label) return parent.label

  return "Session Archive"
}

function sessionSeries(file: SessionFile, allFiles: SessionFile[]): SessionSeries | undefined {
  if (!file.slug || !isSessionNote(file)) return undefined

  const root = archiveRootFor(file)
  if (!root) return undefined

  const archiveTitle = archiveTitleFor(file, root, allFiles)
  return {
    root,
    archiveTitle,
    ariaLabel: `${archiveTitle} navigation`,
  }
}

function explicitSeriesOrder(file: SessionFile) {
  const value = Number(file.frontmatter?.series_order)
  return Number.isFinite(value) ? value : undefined
}

function sessionNumber(file: SessionFile) {
  const direct = String(file.frontmatter?.session_number ?? "").trim()
  const directMatch = /^(\d+)([a-z]?)$/i.exec(direct)
  if (directMatch) {
    const suffix = directMatch[2] ? directMatch[2].toLowerCase().charCodeAt(0) - 96 : 0
    return Number(directMatch[1]) * 100 + suffix
  }

  const title = String(file.frontmatter?.title ?? "")
  const titleMatch = /\bsession\s+(\d+)([a-z]?)\b/i.exec(title)
  if (titleMatch) {
    const suffix = titleMatch[2] ? titleMatch[2].toLowerCase().charCodeAt(0) - 96 : 0
    return Number(titleMatch[1]) * 100 + suffix
  }

  const slug = simplifySlug(file.slug ?? "")
  const slugMatch = /(?:^|\/)session-(\d+)([a-z]?)(?:-|$)/i.exec(slug)
  if (slugMatch) {
    const suffix = slugMatch[2] ? slugMatch[2].toLowerCase().charCodeAt(0) - 96 : 0
    return Number(slugMatch[1]) * 100 + suffix
  }

  return undefined
}

function normalizeDateOrder(value: unknown) {
  const raw = String(value ?? "").trim()
  const match = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(raw)
  if (!match) return undefined

  return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`
}

function chronologicalOrder(file: SessionFile) {
  const fields = [
    file.frontmatter?.publication_date,
    file.frontmatter?.campaign_date_start,
    file.frontmatter?.campaign_date,
    file.frontmatter?.session_date,
    file.frontmatter?.article_release_date,
  ]

  for (const value of fields) {
    const normalized = normalizeDateOrder(value)
    if (normalized) return normalized
  }

  const basename = simplifySlug(file.slug ?? "").split("/").at(-1) ?? ""
  return normalizeDateOrder(basename)
}

function titleFor(file: SessionFile) {
  return String(file.frontmatter?.title ?? simplifySlug(file.slug!).split("/").at(-1) ?? "Session")
}

function compareSessions(a: SessionFile, b: SessionFile) {
  const explicitA = explicitSeriesOrder(a)
  const explicitB = explicitSeriesOrder(b)
  if (explicitA !== undefined || explicitB !== undefined) {
    if (explicitA === undefined) return 1
    if (explicitB === undefined) return -1
    if (explicitA !== explicitB) return explicitA - explicitB
  }

  const numberA = sessionNumber(a)
  const numberB = sessionNumber(b)
  if (numberA !== undefined || numberB !== undefined) {
    if (numberA === undefined) return 1
    if (numberB === undefined) return -1
    if (numberA !== numberB) return numberA - numberB
  }

  const dateA = chronologicalOrder(a)
  const dateB = chronologicalOrder(b)
  if (dateA || dateB) {
    if (!dateA) return 1
    if (!dateB) return -1
    const dateDiff = dateA.localeCompare(dateB)
    if (dateDiff !== 0) return dateDiff
  }

  return titleFor(a).localeCompare(titleFor(b))
}

function sessionsForRoot(root: FullSlug, allFiles: SessionFile[]) {
  return allFiles
    .filter((file) => sessionSeries(file, allFiles)?.root === root)
    .sort(compareSessions)
}

function auditSessionNavigation(allFiles: SessionFile[]) {
  if (auditedFileSets.has(allFiles)) return
  auditedFileSets.add(allFiles)

  const sessionNotes = allFiles.filter(isSessionNote)
  const bySeries = new Map<string, SessionFile[]>()

  for (const file of sessionNotes) {
    const series = sessionSeries(file, allFiles)
    const slug = simplifySlug(file.slug ?? "unknown-session-note")

    if (!series) {
      console.warn(
        `[SessionNavigation] ${slug} is type: session-note but no series archive could be determined. ` +
          `Use a Session Notes path or an absolute parent wikilink.`,
      )
      continue
    }

    const archiveExists = allFiles.some(
      (candidate) => candidate.slug && simplifySlug(candidate.slug) === series.root,
    )
    if (!archiveExists) {
      console.warn(
        `[SessionNavigation] ${slug} resolves to archive ${series.root}, but that archive page was not found.`,
      )
    }

    const existing = bySeries.get(series.root) ?? []
    existing.push(file)
    bySeries.set(series.root, existing)

    if (
      explicitSeriesOrder(file) === undefined &&
      sessionNumber(file) === undefined &&
      chronologicalOrder(file) === undefined
    ) {
      console.warn(
        `[SessionNavigation] ${slug} has no series_order, session number, or sortable date; ` +
          `navigation order will fall back to the article title.`,
      )
    }
  }

  for (const [root, files] of bySeries) {
    const seenNumbers = new Map<number, string>()
    for (const file of files) {
      const number = sessionNumber(file)
      if (number === undefined) continue

      const slug = simplifySlug(file.slug ?? "unknown-session-note")
      const previousSlug = seenNumbers.get(number)
      if (previousSlug) {
        console.warn(
          `[SessionNavigation] Duplicate session number in ${root}: ${previousSlug} and ${slug}.`,
        )
      } else {
        seenNumbers.set(number, slug)
      }
    }
  }
}

function archiveAction(
  currentSlug: FullSlug,
  file: SessionFile,
  eyebrow: string,
  cta: string,
  extraClass = "",
) {
  if (!file.slug) return null

  const href = resolveRelative(currentSlug, simplifySlug(file.slug) as FullSlug)
  return (
    <a href={href} class={`series-archive-action internal ${extraClass}`.trim()}>
      <span class="series-archive-action__eyebrow">{eyebrow}</span>
      <span class="series-archive-action__title">{titleFor(file)}</span>
      <span class="series-archive-action__cta">{cta} <span aria-hidden="true">→</span></span>
    </a>
  )
}

const articleCss = `
body[data-slug^="${SEASON_OF_GHOSTS_ROOT}/"] .related-records__card[href$="/session-notes"],
body[data-slug^="${SEASON_OF_GHOSTS_ROOT}/"] .related-records__card[href$="/session-notes/"] {
  display: none;
}

body[data-slug^="${SEASON_OF_GHOSTS_ROOT}/"] .related-records__grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.session-navigation {
  margin: 2.25rem 0 0.75rem;
  padding-top: 1.25rem;
  border-top: 1px solid var(--campaign-page-rule, var(--lightgray));
}

.session-nav-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(11rem, 0.9fr) minmax(0, 1fr);
  gap: 0.8rem;
  align-items: stretch;
}

.session-nav-item,
.session-nav-back {
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
  transition: border-color 120ms ease, transform 120ms ease, box-shadow 120ms ease;
}

.session-nav-item:hover,
.session-nav-back:hover {
  transform: translateY(-1px);
  border-color: var(--campaign-page-accent, var(--secondary));
  box-shadow: 0 0.16rem 0.45rem color-mix(in srgb, var(--dark) 10%, transparent);
}

.session-nav-next { text-align: right; }
.session-nav-back { text-align: center; }

.session-nav-label {
  color: var(--campaign-page-accent, var(--gray));
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.065em;
  text-transform: uppercase;
}

.session-nav-title {
  margin-top: 0.18rem;
  font-family: var(--headerFont);
  font-size: 0.94rem;
  font-weight: 700;
  line-height: 1.25;
}

.session-nav-item.is-empty {
  visibility: hidden;
}

@media (max-width: 700px) {
  body[data-slug^="${SEASON_OF_GHOSTS_ROOT}/"] .related-records__grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .session-nav-grid {
    grid-template-columns: 1fr 1fr;
  }

  .session-nav-back {
    grid-column: 1 / -1;
    grid-row: 1;
  }

  .session-nav-previous { grid-column: 1; }
  .session-nav-next { grid-column: 2; }
}
`

const archiveCss = `
.series-archive-actions {
  margin: 0.75rem 0 1.75rem;
  padding: 1rem;
  border: 1px solid var(--campaign-page-rule, var(--lightgray));
  border-radius: 0.7rem;
  background: color-mix(in srgb, var(--light) 97%, var(--lightgray) 3%);
}

.series-archive-actions__heading {
  margin: 0 0 0.2rem;
  font-family: var(--headerFont);
  font-size: 1.05rem;
  font-weight: 700;
}

.series-archive-actions__intro {
  margin: 0 0 0.8rem;
  color: var(--gray);
  font-size: 0.9rem;
  line-height: 1.4;
}

.series-archive-actions__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.8rem;
}

.series-archive-action {
  display: flex;
  min-width: 0;
  flex-direction: column;
  justify-content: center;
  padding: 0.85rem 0.95rem;
  border: 1px solid var(--campaign-page-rule, var(--lightgray));
  border-radius: 0.55rem;
  background: color-mix(in srgb, var(--light) 94%, var(--lightgray) 6%);
  color: inherit;
  text-decoration: none;
  transition: border-color 120ms ease, transform 120ms ease, box-shadow 120ms ease;
}

.series-archive-action:hover {
  transform: translateY(-1px);
  border-color: var(--campaign-page-accent, var(--secondary));
  box-shadow: 0 0.16rem 0.45rem color-mix(in srgb, var(--dark) 10%, transparent);
}

.series-archive-action--single {
  grid-column: 1 / -1;
}

.series-archive-action__eyebrow {
  color: var(--campaign-page-accent, var(--gray));
  font-size: 0.69rem;
  font-weight: 700;
  letter-spacing: 0.065em;
  text-transform: uppercase;
}

.series-archive-action__title {
  margin-top: 0.2rem;
  font-family: var(--headerFont);
  font-size: 1rem;
  font-weight: 700;
  line-height: 1.3;
}

.series-archive-action__cta {
  margin-top: 0.4rem;
  color: var(--secondary);
  font-size: 0.78rem;
  font-weight: 700;
}

@media (max-width: 700px) {
  .series-archive-actions__grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .series-archive-action--single {
    grid-column: auto;
  }
}
`

export default ((options?: SessionNavigationOptions) => {
  const mode = options?.mode ?? "article"

  const SessionNavigation: QuartzComponent = ({
    fileData,
    allFiles,
    displayClass,
  }: QuartzComponentProps) => {
    auditSessionNavigation(allFiles)

    if (!fileData.slug) return null

    if (mode === "archive") {
      const archiveSlug = simplifySlug(fileData.slug) as FullSlug
      const sessions = sessionsForRoot(archiveSlug, allFiles)
      if (sessions.length === 0) return null

      const first = sessions[0]
      const latest = sessions[sessions.length - 1]
      const isSingleEntry = first.slug === latest.slug

      return (
        <section
          class={`series-archive-actions ${displayClass ?? ""}`.trim()}
          aria-label="Series reading shortcuts"
        >
          <div class="series-archive-actions__heading">Read the Series</div>
          <p class="series-archive-actions__intro">
            Start with the first entry, or jump directly to the most recent one.
          </p>
          <div class="series-archive-actions__grid">
            {isSingleEntry ? (
              archiveAction(archiveSlug, first, "Read the series", "Open entry", "series-archive-action--single")
            ) : (
              <>
                {archiveAction(archiveSlug, first, "Start from the beginning", "Read first entry")}
                {archiveAction(archiveSlug, latest, "Latest entry", "Jump to latest")}
              </>
            )}
          </div>
        </section>
      )
    }

    const series = sessionSeries(fileData as SessionFile, allFiles)
    if (!series) return null

    const currentSlug = simplifySlug(fileData.slug)
    const sessions = sessionsForRoot(series.root, allFiles)

    const currentIndex = sessions.findIndex(
      (file) => file.slug && simplifySlug(file.slug) === currentSlug,
    )
    if (currentIndex === -1) return null

    const previous = currentIndex > 0 ? sessions[currentIndex - 1] : undefined
    const next = currentIndex < sessions.length - 1 ? sessions[currentIndex + 1] : undefined

    const item = (file: SessionFile | undefined, direction: "previous" | "next") => {
      if (!file?.slug) {
        return (
          <span class={`session-nav-item session-nav-${direction} is-empty`} aria-hidden="true" />
        )
      }

      const href = resolveRelative(fileData.slug!, simplifySlug(file.slug) as FullSlug)
      return (
        <a href={href} class={`session-nav-item session-nav-${direction} internal`}>
          <span class="session-nav-label">
            {direction === "previous" ? "← Previous" : "Next →"}
          </span>
          <span class="session-nav-title">{titleFor(file)}</span>
        </a>
      )
    }

    return (
      <nav
        class={`session-navigation ${displayClass ?? ""}`.trim()}
        aria-label={series.ariaLabel}
      >
        <div class="session-nav-grid">
          {item(previous, "previous")}
          <a
            href={resolveRelative(fileData.slug, series.root)}
            class="session-nav-back internal"
          >
            <span class="session-nav-label">Series Archive</span>
            <span class="session-nav-title">{series.archiveTitle}</span>
          </a>
          {item(next, "next")}
        </div>
      </nav>
    )
  }

  SessionNavigation.css = mode === "archive" ? archiveCss : articleCss

  return SessionNavigation
}) satisfies QuartzComponentConstructor<SessionNavigationOptions | undefined>
