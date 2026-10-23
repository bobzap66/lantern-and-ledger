export const DEFAULT_SITE_PUBLICATION = "Lantern & Ledger"

export type SitePublication = {
  frontmatterValue: string
  key: string
  title: string
  archiveLabel: string
  wordmarkSubtitle: string
}

const SITE_PUBLICATIONS: Record<string, SitePublication> = {
  "lantern & ledger": {
    frontmatterValue: "Lantern & Ledger",
    key: "lantern-and-ledger",
    title: "The Lantern and Ledger",
    archiveLabel: "THE LANTERN AND LEDGER · ARCHIVES",
    wordmarkSubtitle: "Light for the Present. Record for the Future.",
  },
  "beacon & bulletin": {
    frontmatterValue: "Beacon & Bulletin",
    key: "beacon-and-bulletin",
    title: "Beacon & Bulletin",
    archiveLabel: "BEACON & BULLETIN · ARCHIVES",
    wordmarkSubtitle: "STARFINDER CAMPAIGN ARCHIVE",
  },
}

function normalizeSitePublication(value: unknown) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
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
