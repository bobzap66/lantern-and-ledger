import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { CampaignSpoilerGate } from "./CampaignSpoilerGate"

function campaignKeyFromSlug(slug: string | undefined) {
  if (!slug) return null

  const directMatch = /^campaigns\/([^/]+)(?:\/|$)/i.exec(slug)
  if (!directMatch) return null

  const first = directMatch[1]?.toLowerCase()
  if (!first || first === "index") return null

  if (first === "archived") {
    const archivedKey = /^campaigns\/archived\/([^/]+)(?:\/|$)/i.exec(slug)?.[1]?.toLowerCase()
    return archivedKey && archivedKey !== "index" ? archivedKey : null
  }

  return first
}

function campaignClassFromSlug(slug: string | undefined) {
  const key = campaignKeyFromSlug(slug)
  if (!key) return null

  const safeKey = key
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")

  return safeKey ? `campaign--${safeKey}` : null
}

function isCampaignPage(slug: string | undefined) {
  return Boolean(campaignKeyFromSlug(slug))
}

function normalizeFrontmatterValue(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item ?? "")).join(" ").trim().toLowerCase()
  }

  return String(value ?? "").trim().toLowerCase()
}

function normalizedEditorialValue(value: unknown) {
  return normalizeFrontmatterValue(value).replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim()
}

function campaignLabel(
  frontmatter: Record<string, unknown> | undefined,
  slug: string | undefined,
) {
  const campaignLabels: Record<string, string> = {
    kingmaker: "KINGMAKER",
    "abomination-vaults": "ABOMINATION VAULTS",
    "abomination-vaults-curtains-call": "ABOMINATION VAULTS",
    "season-of-ghosts": "SEASON OF GHOSTS",
    "claws-of-the-tyrant": "CLAWS OF THE TYRANT",
  }

  const key = campaignKeyFromSlug(slug)
  if (key && campaignLabels[key]) return campaignLabels[key]

  const campaign = String(frontmatter?.campaign ?? "").trim()
  return campaign ? campaign.toUpperCase() : null
}

function sessionNumberFromFrontmatter(
  frontmatter: Record<string, unknown> | undefined,
  slug: string | undefined,
) {
  const directValue =
    frontmatter?.session_number ?? frontmatter?.sessionNumber ?? frontmatter?.session
  const direct = String(directValue ?? "").trim()

  if (/^\d+[a-z]?$/i.test(direct)) return direct.toUpperCase()

  const title = String(frontmatter?.title ?? "")
  const titleMatch = /\bsession\s+(\d+[a-z]?)\b/i.exec(title)
  if (titleMatch?.[1]) return titleMatch[1].toUpperCase()

  const slugMatch = /(?:^|\/)session[-_\s]+(\d+[a-z]?)(?:[-_\s/]|$)/i.exec(slug ?? "")
  return slugMatch?.[1]?.toUpperCase() ?? null
}

function articleKicker(
  frontmatter: Record<string, unknown> | undefined,
  slug: string | undefined,
) {
  if (!frontmatter) return null

  const type = normalizedEditorialValue(frontmatter.type)
  const format = normalizedEditorialValue(frontmatter.format)
  const articleType = normalizedEditorialValue(frontmatter.article_type)
  const categoryPath = normalizedEditorialValue(frontmatter.category_path)
  const normalizedSlug = normalizeFrontmatterValue(slug)
  const sessionNumber = sessionNumberFromFrontmatter(frontmatter, slug)
  const isVignette = type === "vignette"

  let label: string | null = null

  if (
    format === "oral history" ||
    type === "oral history" ||
    articleType === "oral history" ||
    categoryPath.includes("oral history")
  ) {
    label = "ORAL HISTORY"
  } else if (
    format === "player fiction" ||
    type === "player fiction" ||
    articleType === "player fiction" ||
    (isVignette && normalizedSlug.includes("/vignettes/character-vignettes/"))
  ) {
    label = "PLAYER FICTION"
  } else if (
    format === "gm fiction" ||
    type === "gm fiction" ||
    articleType === "gm fiction" ||
    (isVignette && normalizedSlug.includes("/vignettes/gm-vignettes/"))
  ) {
    label = "GM FICTION"
  } else if (
    sessionNumber ||
    type === "session" ||
    ((type === "report" || type === "session-note" || type === "session note") &&
      normalizedSlug.includes("/session-notes/"))
  ) {
    label = sessionNumber ? `SESSION ${sessionNumber}` : "SESSION"
  } else if (isVignette) {
    label = "VIGNETTE"
  }

  if (!label) return null

  const campaign = campaignLabel(frontmatter, slug)
  return campaign ? `${label} · ${campaign}` : label
}

function isFormalPublication(
  frontmatter: Record<string, unknown> | undefined,
  slug: string | undefined,
) {
  if (!frontmatter) return false

  const normalize = (value: unknown) => String(value ?? "").trim().toLowerCase()
  const type = normalize(frontmatter.type)
  const articleType = normalize(frontmatter.article_type)
  const publication = normalize(frontmatter.publication)
  const documentStyle = normalize(frontmatter.document_style)
  const normalizedSlug = normalize(slug)

  if (documentStyle === "formal-publication") return true
  if (type === "article" && publication.length > 0) return true

  if (
    type === "vignette" &&
    /^campaigns\/kingmaker\/vignettes\/(?:the-lantern-and-ledger|pitax-gazette|scholarly-journals|intelligence-reports)\//.test(
      normalizedSlug,
    )
  ) {
    return true
  }

  if (
    type === "report" &&
    /^campaigns\/kingmaker\/session-notes\//.test(normalizedSlug)
  ) {
    return true
  }

  const formalTypes = new Set([
    "intelligence-report",
    "intelligence report",
    "intelligence-dossier",
    "intelligence dossier",
    "scholarly-journal",
    "scholarly journal",
    "journal-article",
    "journal article",
    "academic-paper",
    "academic paper",
    "scholarly-article",
    "scholarly article",
  ])

  return formalTypes.has(type) || formalTypes.has(articleType)
}

const Body: QuartzComponent = (props: QuartzComponentProps) => {
  const { children, fileData } = props
  const lockedByDefault = isCampaignPage(fileData.slug)
  const campaignClass = campaignClassFromSlug(fileData.slug)
  const frontmatter = fileData.frontmatter as Record<string, unknown> | undefined
  const formalPublication = isFormalPublication(frontmatter, fileData.slug)
  const kicker = articleKicker(frontmatter, fileData.slug)
  const articleTitle = String(frontmatter?.title ?? "").trim()
  const bodyClasses = [
    campaignClass,
    lockedByDefault ? "campaign-spoiler-pending" : "",
    formalPublication ? "formal-publication" : "",
    kicker ? "has-article-kicker" : "",
  ]
    .filter(Boolean)
    .join(" ")
  const bodyStyle = kicker ? ({ "--article-kicker": JSON.stringify(kicker) } as any) : undefined

  return (
    <div
      id="quartz-body"
      class={bodyClasses || undefined}
      style={bodyStyle}
      data-article-title={kicker && articleTitle ? articleTitle : undefined}
    >
      {kicker && (
        <style>{`
          #quartz-body.has-article-kicker .article-title::before {
            content: var(--article-kicker);
            display: block;
            margin-bottom: 0.5rem;
            font-family: var(--codeFont, var(--bodyFont));
            font-size: 0.72rem;
            font-weight: 600;
            line-height: 1.3;
            letter-spacing: 0.12em;
            text-transform: uppercase;
            color: var(--campaign-page-accent, var(--tertiary));
          }

          @media (max-width: 600px) {
            #quartz-body.has-article-kicker .article-title::before {
              margin-bottom: 0.42rem;
              font-size: 0.68rem;
              letter-spacing: 0.1em;
            }
          }
        `}</style>
      )}
      {formalPublication && (
        <style>{`
          #quartz-body.formal-publication .center article p {
            text-align: justify !important;
            text-justify: inter-word;
            hyphens: auto;
          }
        `}</style>
      )}
      {lockedByDefault && <CampaignSpoilerGate {...props} />}
      {children}
    </div>
  )
}

Body.afterDOMLoaded = `
const normalizeEditorialHeading = (value) =>
  String(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()

const hideDuplicateEditorialTitle = () => {
  const body = document.querySelector("#quartz-body.has-article-kicker[data-article-title]")
  if (!body) return

  const title = normalizeEditorialHeading(body.dataset.articleTitle)
  if (!title) return

  const heading = body.querySelector(".center article > h1:first-child")
  if (!heading) return

  if (normalizeEditorialHeading(heading.textContent) === title) {
    heading.hidden = true
  }
}

document.addEventListener("nav", hideDuplicateEditorialTitle)
hideDuplicateEditorialTitle()
`

export default (() => Body) satisfies QuartzComponentConstructor
