import { getSitePublication } from "./sitePublication"

export type ExplorerCampaign = {
  path: string
  publication: string
  status: "active" | "upcoming" | "archived"
}

type ExplorerCampaignFile = {
  slug?: string
  frontmatter?: Record<string, unknown>
}

export function getExplorerCampaigns(files: readonly ExplorerCampaignFile[]): ExplorerCampaign[] {
  const campaigns: ExplorerCampaign[] = []

  for (const file of files) {
    const status = String(file.frontmatter?.status ?? "").toLowerCase()
    if (status !== "active" && status !== "upcoming" && status !== "archived") continue
    if (String(file.frontmatter?.type ?? "").toLowerCase() !== "campaign") continue

    const path = String(file.slug ?? "")
      .replace(/^\/+|\/+$/g, "")
      .replace(/\/index$/i, "")
      .toLowerCase()
    if (!/(^|\/)campaigns\/[^/]+$/.test(path)) continue

    campaigns.push({
      path,
      publication: getSitePublication(file.frontmatter).key,
      status,
    })
  }

  return campaigns.sort((a, b) => a.path.localeCompare(b.path))
}
