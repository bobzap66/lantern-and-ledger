import { promises as fs } from "node:fs"
import path from "node:path"
import YAML from "yaml"

const contentRoot = path.resolve(process.argv[2] ?? "content")
const outputPath = path.resolve("quartz/static/preferences-campaigns.json")

const PUBLICATIONS = [
  {
    key: "lantern-and-ledger",
    title: "Lantern & Ledger",
    frontmatter: "Lantern & Ledger",
    campaignRoot: path.join(contentRoot, "Lantern and Ledger", "Campaigns"),
  },
  {
    key: "beacon-and-bulletin",
    title: "Beacon & Bulletin",
    frontmatter: "Beacon & Bulletin",
    campaignRoot: path.join(contentRoot, "Beacon and Bulletin", "Campaigns"),
  },
]

function parseFrontmatter(text) {
  const match = /^---\s*\r?\n([\s\S]*?)\r?\n---/.exec(text)
  if (!match) return {}
  return YAML.parse(match[1]) ?? {}
}

function normalizePublication(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
}

async function loadPublicationCampaigns(publication) {
  let entries
  try {
    entries = await fs.readdir(publication.campaignRoot, { withFileTypes: true })
  } catch (error) {
    if (error?.code === "ENOENT") return []
    throw error
  }

  const campaigns = []
  for (const entry of entries) {
    if (!entry.isDirectory()) continue

    const indexPath = path.join(publication.campaignRoot, entry.name, "index.md")
    let text
    try {
      text = await fs.readFile(indexPath, "utf8")
    } catch (error) {
      if (error?.code === "ENOENT") continue
      throw error
    }

    const metadata = parseFrontmatter(text)
    if (metadata.type !== "campaign" || metadata.draft === true || metadata.publish === false) continue
    if (normalizePublication(metadata.site_publication) !== normalizePublication(publication.frontmatter)) {
      continue
    }

    const id = typeof metadata.campaign_id === "string" ? metadata.campaign_id.trim() : ""
    if (!id) throw new Error(`${indexPath} needs stable campaign_id metadata`)

    const name = String(metadata.title ?? entry.name).trim()
    campaigns.push({
      id,
      name,
      status: String(metadata.status ?? "").trim().toLowerCase(),
    })
  }

  campaigns.sort((a, b) => a.name.localeCompare(b.name))
  return campaigns
}

const publications = []
for (const publication of PUBLICATIONS) {
  publications.push({
    key: publication.key,
    title: publication.title,
    campaigns: await loadPublicationCampaigns(publication),
  })
}

await fs.mkdir(path.dirname(outputPath), { recursive: true })
await fs.writeFile(outputPath, `${JSON.stringify({ publications }, null, 2)}\n`, "utf8")

const campaignCount = publications.reduce((sum, publication) => sum + publication.campaigns.length, 0)
console.log(`Generated reader preferences for ${campaignCount} campaigns across ${publications.length} publications.`)
