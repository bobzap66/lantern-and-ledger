import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { FullSlug, resolveRelative, simplifySlug } from "../util/path"

type SessionFile = QuartzComponentProps["allFiles"][number]

const SESSION_ROOT = "campaigns/season-of-ghosts/session-notes"

function isSeasonOfGhostsSession(file: SessionFile) {
  if (!file.slug) return false
  const slug = simplifySlug(file.slug)
  return slug.startsWith(`${SESSION_ROOT}/`)
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

  return Number.POSITIVE_INFINITY
}

function titleFor(file: SessionFile) {
  return String(file.frontmatter?.title ?? simplifySlug(file.slug!).split("/").at(-1) ?? "Session")
}

export default (() => {
  const SessionNavigation: QuartzComponent = ({
    fileData,
    allFiles,
    displayClass,
  }: QuartzComponentProps) => {
    if (!fileData.slug || !isSeasonOfGhostsSession(fileData as SessionFile)) return null

    const currentSlug = simplifySlug(fileData.slug)
    const sessions = allFiles
      .filter(isSeasonOfGhostsSession)
      .sort((a, b) => {
        const numberDiff = sessionNumber(a) - sessionNumber(b)
        if (numberDiff !== 0) return numberDiff
        return titleFor(a).localeCompare(titleFor(b))
      })

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
        aria-label="Oral History session navigation"
      >
        <div class="session-nav-grid">
          {item(previous, "previous")}
          <a
            href={resolveRelative(fileData.slug, SESSION_ROOT as FullSlug)}
            class="session-nav-back internal"
          >
            <span class="session-nav-label">Session Archive</span>
            <span class="session-nav-title">Oral History</span>
          </a>
          {item(next, "next")}
        </div>
      </nav>
    )
  }

  SessionNavigation.css = `
body[data-slug^="${SESSION_ROOT}/"] .related-records__card[href$="/session-notes"],
body[data-slug^="${SESSION_ROOT}/"] .related-records__card[href$="/session-notes/"] {
  display: none;
}

body[data-slug^="${SESSION_ROOT}/"] .related-records__grid {
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
  body[data-slug^="${SESSION_ROOT}/"] .related-records__grid {
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

  return SessionNavigation
}) satisfies QuartzComponentConstructor
