import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import SessionNavigation from "./SessionNavigation"
import { simplifySlug } from "../util/path"

const SEASON_OF_GHOSTS_ROOT = "campaigns/season-of-ghosts/session-notes"
const KINGMAKER_ROOT = "campaigns/kingmaker/session-notes"

function canonicalSlug(value: string) {
  return String(simplifySlug(value as any)).replace(/\/index$/i, "")
}

function sessionNumber(file: QuartzComponentProps["allFiles"][number]) {
  const direct = String(file.frontmatter?.session_number ?? "").trim()
  if (/^\d+$/.test(direct)) return Number(direct)

  const title = String(file.frontmatter?.title ?? "")
  const match = /\bsession\s+(\d+)\b/i.exec(title)
  return match ? Number(match[1]) : Number.POSITIVE_INFINITY
}

function titleFor(file: QuartzComponentProps["allFiles"][number]) {
  return String(file.frontmatter?.title ?? "Session")
}

function hrefFor(root: string, file: QuartzComponentProps["allFiles"][number]) {
  if (!file.slug) return "#"
  const target = canonicalSlug(file.slug)
  const prefix = `${root}/`
  return target.startsWith(prefix) ? `./${target.slice(prefix.length)}` : "#"
}

function sessionsForRoot(root: string, allFiles: QuartzComponentProps["allFiles"]) {
  return allFiles
    .filter((file) => {
      if (!file.slug) return false
      if (String(file.frontmatter?.type ?? "").trim().toLowerCase() !== "session-note") return false
      return canonicalSlug(file.slug).startsWith(`${root}/`)
    })
    .sort((a, b) => sessionNumber(a) - sessionNumber(b))
}

export default (() => {
  const genericArchiveActions = SessionNavigation({ mode: "archive" })

  const ArchiveReadingActions: QuartzComponent = (props: QuartzComponentProps) => {
    const { fileData, allFiles, displayClass } = props
    if (!fileData.slug) return null

    const currentSlug = canonicalSlug(fileData.slug)
    const isSeasonOfGhosts = currentSlug === SEASON_OF_GHOSTS_ROOT
    const isKingmaker = currentSlug === KINGMAKER_ROOT

    if (!isSeasonOfGhosts && !isKingmaker) {
      return genericArchiveActions(props)
    }

    const root = isSeasonOfGhosts ? SEASON_OF_GHOSTS_ROOT : KINGMAKER_ROOT
    const sessions = sessionsForRoot(root, allFiles)
    if (sessions.length === 0) return genericArchiveActions(props)

    const first = sessions[0]
    const current = sessions[sessions.length - 1]
    const intro = isSeasonOfGhosts
      ? "Start with the first testimony, or continue with the campaign's current chapter."
      : "Start with the first session, or continue with the campaign's current chapter."
    const ariaLabel = isSeasonOfGhosts
      ? "Oral History reading shortcuts"
      : "Kingmaker session reading shortcuts"

    return (
      <section
        class={`series-archive-actions ${displayClass ?? ""}`.trim()}
        aria-label={ariaLabel}
      >
        <div class="series-archive-actions__heading">Read the Series</div>
        <p class="series-archive-actions__intro">{intro}</p>
        <div class="series-archive-actions__grid">
          <a href={hrefFor(root, first)} class="series-archive-action internal">
            <span class="series-archive-action__eyebrow">Start from the beginning</span>
            <span class="series-archive-action__title">{titleFor(first)}</span>
            <span class="series-archive-action__cta">Read first entry <span aria-hidden="true">→</span></span>
          </a>
          <a href={hrefFor(root, current)} class="series-archive-action internal">
            <span class="series-archive-action__eyebrow">Current chapter</span>
            <span class="series-archive-action__title">{titleFor(current)}</span>
            <span class="series-archive-action__cta">Continue reading <span aria-hidden="true">→</span></span>
          </a>
        </div>
      </section>
    )
  }

  ArchiveReadingActions.css = genericArchiveActions.css
  return ArchiveReadingActions
}) satisfies QuartzComponentConstructor
