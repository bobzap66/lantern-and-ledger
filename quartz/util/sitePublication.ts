export const DEFAULT_SITE_PUBLICATION = "Lantern & Ledger"

export type SitePublication = {
  frontmatterValue: string
  key: string
  title: string
  homeSlug: string
  archiveLabel: string
  searchLabel: string
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
  slug?: string
  slugSegment?: string
  isFolder: boolean
}

const SITE_PUBLICATIONS: Record<string, SitePublication> = {
  "greene gaming": {
    frontmatterValue: "Greene Gaming",
    key: "greene-gaming",
    title: "Greene Gaming",
    homeSlug: "",
    archiveLabel: "GREENE GAMING",
    searchLabel: "Greene Gaming",
    wordmarkSubtitle: "Campaigns, chronicles, and actual play.",
  },
  "lantern & ledger": {
    frontmatterValue: "Lantern & Ledger",
    key: "lantern-and-ledger",
    title: "The Lantern and Ledger",
    homeSlug: "lantern-and-ledger",
    archiveLabel: "THE LANTERN AND LEDGER · ARCHIVES",
    searchLabel: "Lantern & Ledger Archive",
    wordmarkSubtitle: "Light for the Present. Record for the Future.",
  },
  "beacon & bulletin": {
    frontmatterValue: "Beacon & Bulletin",
    key: "beacon-and-bulletin",
    title: "Beacon & Bulletin",
    homeSlug: "beacon-and-bulletin",
    archiveLabel: "BEACON & BULLETIN · ARCHIVES",
    searchLabel: "Beacon & Bulletin Archive",
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

export function getSitePublicationForPath(
  slug: string,
  boundaries: readonly SitePublicationBoundary[],
): string {
  const path = simplifyPublicationSlug(slug).toLowerCase()
  let publication = boundaries.find((boundary) => boundary.path === "")?.publication ?? ""
  let bestBoundaryLength = -1

  for (const boundary of boundaries) {
    const boundaryPath = boundary.path.replace(/^\/+|\/+$/g, "").toLowerCase()
    const matchesPath =
      boundaryPath === "" || path === boundaryPath || path.startsWith(`${boundaryPath}/`)

    if (matchesPath && boundaryPath.length > bestBoundaryLength) {
      publication = boundary.publication
      bestBoundaryLength = boundaryPath.length
    }
  }

  return publication || getSitePublication(undefined).key
}

// This function is serialized by the Explorer plugin and reconstructed in the browser.
// Keep all runtime logic self-contained and avoid nested/local functions: bundlers may
// rewrite those with helpers that are unavailable inside Explorer's reconstructed callback.
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

    let sourcePath = String(node.slug ?? node.slugSegment ?? "").replace(/^\/+|\/+$/g, "")
    if (sourcePath === "index") sourcePath = ""
    if (sourcePath.endsWith("/index")) sourcePath = sourcePath.slice(0, -"/index".length)
    const path = sourcePath.toLowerCase()
    const normalizedPublication = currentPublication.toLowerCase()

    let ownPublication = "lantern-and-ledger"
    let bestBoundaryLength = -1
    let hasCurrentPublicationDescendant = false
    let isDirectPublicationBoundary = false

    for (const rawBoundary of parsed) {
      const boundaryPath = String(rawBoundary?.path ?? "")
        .replace(/^\/+|\/+$/g, "")
        .toLowerCase()
      const publication = String(rawBoundary?.publication ?? "").toLowerCase()
      if (!publication) continue

      const matchesPath =
        boundaryPath === "" || path === boundaryPath || path.startsWith(`${boundaryPath}/`)

      if (matchesPath && boundaryPath.length > bestBoundaryLength) {
        ownPublication = publication
        bestBoundaryLength = boundaryPath.length
      }

      if (node.isFolder && boundaryPath.length > 0 && boundaryPath === path) {
        isDirectPublicationBoundary = true
      }

      if (
        node.isFolder &&
        publication === normalizedPublication &&
        (boundaryPath === path ||
          (path ? boundaryPath.startsWith(`${path}/`) : boundaryPath.length > 0))
      ) {
        hasCurrentPublicationDescendant = true
      }
    }

    // Greene Gaming is the parent publication. Its Explorer should expose the two
    // direct publication roots as destinations without expanding their full trees.
    if (normalizedPublication === "greene-gaming") {
      if (!node.isFolder) return ownPublication === normalizedPublication
      return ownPublication === normalizedPublication || isDirectPublicationBoundary
    }

    if (!node.isFolder) return ownPublication === normalizedPublication
    return ownPublication === normalizedPublication || hasCurrentPublicationDescendant
  } catch {
    return true
  }
}
