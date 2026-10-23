export const DEFAULT_SITE_PUBLICATION = "Lantern & Ledger"

export type SitePublication = {
  frontmatterValue: string
  key: string
  title: string
  homeSlug: string
  archiveLabel: string
  wordmarkSubtitle: string
}

export type SitePublicationBoundary = {
  path: string
  publication: string
}

type SitePublicationFile = {
  slug?: string
  frontmatter?: Record<string, unknown>
}

type SitePublicationExplorerNode = {
  slugSegment?: string
  slugSegments?: string[]
  isFolder: boolean
}

const SITE_PUBLICATIONS: Record<string, SitePublication> = {
  "lantern & ledger": {
    frontmatterValue: "Lantern & Ledger",
    key: "lantern-and-ledger",
    title: "The Lantern and Ledger",
    homeSlug: "",
    archiveLabel: "THE LANTERN AND LEDGER · ARCHIVES",
    wordmarkSubtitle: "Light for the Present. Record for the Future.",
  },
  "beacon & bulletin": {
    frontmatterValue: "Beacon & Bulletin",
    key: "beacon-and-bulletin",
    title: "Beacon & Bulletin",
    homeSlug: "beacon-and-bulletin",
    archiveLabel: "BEACON & BULLETIN · ARCHIVES",
    wordmarkSubtitle: "Current Signals. Lasting Record.",
  },
}

function normalizeSitePublication(value: unknown) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
}

function simplifyPublicationSlug(value: unknown) {
  const slug = String(value ?? "").replace(/^\/+|\/+$/g, "")
  if (slug === "index") return ""
  return slug.endsWith("/index") ? slug.slice(0, -"/index".length) : slug
}

export function getSitePublication(
  frontmatter: Record<string, unknown> | undefined,
): SitePublication {
  const requested = normalizeSitePublication(frontmatter?.site_publication)
  return (
    SITE_PUBLICATIONS[requested] ??
    SITE_PUBLICATIONS[normalizeSitePublication(DEFAULT_SITE_PUBLICATION)]
  )
}

export function getSitePublicationBoundaries(
  files: readonly SitePublicationFile[],
): SitePublicationBoundary[] {
  const publicationByPath = new Map<string, string>()

  for (const file of files) {
    if (!file.slug) continue
    const path = simplifyPublicationSlug(file.slug)
    publicationByPath.set(path, getSitePublication(file.frontmatter).key)
  }

  const rootPublication = publicationByPath.get("") ?? getSitePublication(undefined).key
  if (!publicationByPath.has("")) publicationByPath.set("", rootPublication)

  const nearestAncestorPublication = (path: string) => {
    const parts = path.split("/").filter(Boolean)
    while (parts.length > 0) {
      parts.pop()
      const publication = publicationByPath.get(parts.join("/"))
      if (publication) return publication
    }
    return rootPublication
  }

  return [...publicationByPath.entries()]
    .filter(
      ([path, publication]) => path === "" || nearestAncestorPublication(path) !== publication,
    )
    .map(([path, publication]) => ({ path, publication }))
    .sort((a, b) => a.path.localeCompare(b.path))
}

// This function is serialized by the Explorer plugin and reconstructed in the browser.
// Keep all runtime logic self-contained: it must not close over imports or module constants.
export function sitePublicationExplorerFilter(node: SitePublicationExplorerNode) {
  if (String(node.slugSegment ?? "").toLowerCase() === "tags") return false

  try {
    const body = document.querySelector("#quartz-body")
    const context = document.querySelector("#site-publication-explorer-context")
    const currentPublication = body?.getAttribute("data-site-publication")
    const rawBoundaries = context?.getAttribute("data-publication-boundaries")

    // Fail open. If publication context is unavailable or malformed, preserve the
    // stock Explorer instead of risking an empty navigation tree.
    if (!currentPublication || !rawBoundaries) return true

    const parsed = JSON.parse(rawBoundaries)
    if (!Array.isArray(parsed) || parsed.length === 0) return true

    const boundaries = parsed
      .map((boundary) => ({
        path: String(boundary?.path ?? "")
          .replace(/^\/+|\/+$/g, "")
          .toLowerCase(),
        publication: String(boundary?.publication ?? "").toLowerCase(),
      }))
      .filter((boundary) => boundary.publication.length > 0)
      .sort((a, b) => b.path.length - a.path.length)

    if (boundaries.length === 0) return true

    const path = (Array.isArray(node.slugSegments)
      ? node.slugSegments.filter(Boolean).join("/")
      : String(node.slugSegment ?? "")
    )
      .replace(/^\/+|\/+$/g, "")
      .toLowerCase()

    const publicationForPath = (value: string) => {
      const boundary = boundaries.find(
        (candidate) =>
          candidate.path === "" ||
          value === candidate.path ||
          value.startsWith(`${candidate.path}/`),
      )
      return boundary?.publication ?? "lantern-and-ledger"
    }

    const normalizedPublication = currentPublication.toLowerCase()

    if (!node.isFolder) {
      return publicationForPath(path) === normalizedPublication
    }

    if (publicationForPath(path) === normalizedPublication) return true

    const prefix = path ? `${path}/` : ""
    return boundaries.some(
      (boundary) =>
        boundary.publication === normalizedPublication &&
        (boundary.path === path || boundary.path.startsWith(prefix)),
    )
  } catch {
    return true
  }
}
