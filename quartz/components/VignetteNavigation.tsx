import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { FullSlug, resolveRelative, simplifySlug } from "../util/path"
import { vignetteDate } from "../util/vignettes"

function wikilinkTarget(value: unknown) {
  if (typeof value !== "string") return ""
  const text = value.trim()
  const match = text.match(/^\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]$/)
  return (match ? match[1] : text).replaceAll("\\", "/").replace(/\.md$/i, "")
}

function normalizedTitle(value: unknown) {
  return String(value ?? "")
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase()
}

function vignetteDirectory(slug: string) {
  const simplified = simplifySlug(slug)
  const parts = simplified.split("/").filter(Boolean)
  if (parts.length < 2) return ""
  return parts.slice(0, -1).join("/")
}

function isVignettePage(file: QuartzComponentProps["allFiles"][number]) {
  if (!file.slug) return false
  const slug = simplifySlug(file.slug)
  if (!slug.includes("/vignettes/")) return false
  return String(file.frontmatter?.type ?? "").toLowerCase() === "vignette"
}

function dateRank(frontmatter: Record<string, any> | undefined) {
  const date = vignetteDate(frontmatter ?? {})
  return date.sortGroup * 10_000_000_000 + date.rank
}

function explicitSeries(
  fileData: QuartzComponentProps["fileData"],
  allFiles: QuartzComponentProps["allFiles"],
) {
  const currentTitle = normalizedTitle(fileData.frontmatter?.title)
  if (!currentTitle) return undefined

  for (const archive of allFiles) {
    const configuredEntries = archive.frontmatter?.series_entries
    if (!Array.isArray(configuredEntries)) continue

    const orderedTitles = configuredEntries.map(normalizedTitle).filter(Boolean)
    if (!orderedTitles.includes(currentTitle)) continue

    const siblings = orderedTitles
      .map((title) =>
        allFiles.find((file) => file.slug && normalizedTitle(file.frontmatter?.title) === title),
      )
      .filter(
        (file): file is QuartzComponentProps["allFiles"][number] => Boolean(file?.slug),
      )

    return { archive, siblings }
  }

  return undefined
}

function inferredArchive(
  fileData: QuartzComponentProps["fileData"],
  allFiles: QuartzComponentProps["allFiles"],
) {
  if (!fileData.slug) return undefined
  const current = simplifySlug(fileData.slug)
  const parts = current.split("/")
  if (parts.length < 2) return undefined
  const directory = parts.slice(0, -1).join("/")
  const characterSegment = directory.split("/").at(-1)
  if (!characterSegment) return undefined

  const candidates = [directory, `${directory}/index`, `${directory}/${characterSegment}`]
  for (const candidate of candidates) {
    const match = allFiles.find(
      (file) =>
        file.slug &&
        (String(file.slug) === candidate || String(simplifySlug(file.slug)) === candidate),
    )
    if (match?.slug) return match
  }
  return undefined
}

export default (() => {
  const VignetteNavigation: QuartzComponent = ({
    fileData,
    allFiles,
    displayClass,
  }: QuartzComponentProps) => {
    if (!fileData.slug) return null

    const configuredSeries = explicitSeries(fileData, allFiles)
    const standardVignette = isVignettePage(
      fileData as QuartzComponentProps["allFiles"][number],
    )
    if (!configuredSeries && !standardVignette) return null

    const fm = fileData.frontmatter ?? {}
    const group = vignetteDirectory(fileData.slug)

    const siblings = configuredSeries
      ? configuredSeries.siblings
      : allFiles
          .filter((file) => isVignettePage(file))
          .filter((file) => file.slug && vignetteDirectory(file.slug) === group)
          .filter((file) => file.slug)
          .sort((a, b) => {
            const dateDiff = dateRank(a.frontmatter) - dateRank(b.frontmatter)
            if (dateDiff !== 0) return dateDiff
            const aTitle = String(a.frontmatter?.title ?? simplifySlug(a.slug!))
            const bTitle = String(b.frontmatter?.title ?? simplifySlug(b.slug!))
            return aTitle.localeCompare(bTitle)
          })

    const currentSlug = simplifySlug(fileData.slug)
    const currentIndex = siblings.findIndex(
      (file) => file.slug && simplifySlug(file.slug) === currentSlug,
    )
    if (currentIndex === -1) return null

    const previous = currentIndex > 0 ? siblings[currentIndex - 1] : undefined
    const next = currentIndex < siblings.length - 1 ? siblings[currentIndex + 1] : undefined

    const configuredParent = wikilinkTarget(fm.parent)
    const parentMatch = configuredParent
      ? allFiles.find(
          (file) =>
            file.slug &&
            (simplifySlug(file.slug) === configuredParent ||
              simplifySlug(file.slug).endsWith(`/${configuredParent}`)),
        )
      : undefined
    const archive = configuredSeries?.archive ?? parentMatch ?? inferredArchive(fileData, allFiles)
    const archiveSlug = archive?.slug ? simplifySlug(archive.slug) : undefined

    const characterName =
      String(fm.character ?? "Character")
        .replace(/^\[\[/, "")
        .replace(/\]\]$/, "")
        .split("|")
        .at(-1)
        ?.trim() || "Character"
    const archiveTitle = String(archive?.frontmatter?.title ?? `${characterName} Vignettes`)
    const archiveLabel = String(
      archive?.frontmatter?.series_navigation_label ?? "Vignette Archive",
    )

    const item = (file: (typeof siblings)[number] | undefined, direction: "previous" | "next") => {
      if (!file?.slug)
        return (
          <span class={`vignette-nav-item vignette-nav-${direction} is-empty`} aria-hidden="true" />
        )
      const title = String(
        file.frontmatter?.title ?? simplifySlug(file.slug).split("/").at(-1) ?? "Vignette",
      )
      const date = String(
        file.frontmatter?.date ?? file.frontmatter?.campaign_date_name ?? "",
      ).trim()
      const href = resolveRelative(fileData.slug!, simplifySlug(file.slug) as FullSlug)
      return (
        <a href={href} class={`vignette-nav-item vignette-nav-${direction} internal`}>
          <span class="vignette-nav-label">
            {direction === "previous" ? "← Previous" : "Next →"}
          </span>
          <span class="vignette-nav-title">{title}</span>
          {date && <span class="vignette-nav-date">{date}</span>}
        </a>
      )
    }

    return (
      <nav
        class={`vignette-navigation ${displayClass ?? ""}`.trim()}
        aria-label={configuredSeries ? `${archiveTitle} navigation` : "Vignette navigation"}
        data-series-navigation={configuredSeries ? "explicit" : "vignette"}
      >
        <div class="vignette-nav-grid">
          {item(previous, "previous")}
          {archiveSlug ? (
            <a
              href={resolveRelative(fileData.slug, archiveSlug as FullSlug)}
              class="vignette-nav-back internal"
            >
              <span class="vignette-nav-label">{archiveLabel}</span>
              <span class="vignette-nav-title">Back to {archiveTitle}</span>
            </a>
          ) : (
            <span class="vignette-nav-back is-empty" aria-hidden="true" />
          )}
          {item(next, "next")}
        </div>
      </nav>
    )
  }

  VignetteNavigation.css = `
.vignette-navigation {
  margin: 2.25rem 0 0.75rem;
  padding-top: 1.25rem;
  border-top: 1px solid var(--lightgray);
}

.vignette-nav-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(11rem, 0.9fr) minmax(0, 1fr);
  gap: 0.8rem;
  align-items: stretch;
}

.vignette-nav-item,
.vignette-nav-back {
  display: flex;
  min-width: 0;
  flex-direction: column;
  justify-content: center;
  padding: 0.75rem 0.85rem;
  border: 1px solid var(--lightgray);
  border-radius: 0.55rem;
  background: color-mix(in srgb, var(--light) 94%, var(--lightgray) 6%);
  color: inherit;
  text-decoration: none;
}

.vignette-nav-item:hover,
.vignette-nav-back:hover {
  border-color: var(--secondary);
}

.vignette-nav-next { text-align: right; }
.vignette-nav-back { text-align: center; }

.vignette-nav-label {
  color: var(--gray);
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.065em;
  text-transform: uppercase;
}

.vignette-nav-title {
  margin-top: 0.18rem;
  font-family: var(--headerFont);
  font-size: 0.94rem;
  font-weight: 700;
  line-height: 1.25;
}

.vignette-nav-date {
  margin-top: 0.18rem;
  color: var(--gray);
  font-size: 0.74rem;
}

.vignette-nav-item.is-empty,
.vignette-nav-back.is-empty {
  visibility: hidden;
}

@media (max-width: 700px) {
  .vignette-nav-grid {
    grid-template-columns: 1fr 1fr;
  }

  .vignette-nav-back {
    grid-column: 1 / -1;
    grid-row: 1;
  }

  .vignette-nav-previous { grid-column: 1; }
  .vignette-nav-next { grid-column: 2; }
}
`

  return VignetteNavigation
}) satisfies QuartzComponentConstructor
