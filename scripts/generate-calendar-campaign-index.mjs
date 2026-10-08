import { promises as fs } from "node:fs"
import path from "node:path"
import YAML from "yaml"

const contentRoot = path.resolve(process.argv[2] ?? "content")
const calendarFile = path.join(contentRoot, "Calendar.md")
const campaignsRoot = path.join(contentRoot, "Campaigns")
const START = "<!-- CALENDAR_CAMPAIGN_INDEX_START -->"
const END = "<!-- CALENDAR_CAMPAIGN_INDEX_END -->"
const CALENDAR_NAME = "Calendar of Golarion"
const MONTHS = [
  "Abadius",
  "Calistril",
  "Pharast",
  "Gozran",
  "Desnus",
  "Sarenith",
  "Erastus",
  "Arodus",
  "Rova",
  "Lamashan",
  "Neth",
  "Kuthona",
]

function parseFrontmatter(text) {
  const match = /^---\s*\r?\n([\s\S]*?)\r?\n---/.exec(text)
  if (!match) return {}
  return YAML.parse(match[1]) ?? {}
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
}

function encodedPath(value) {
  return value.split("/").map(encodeURIComponent).join("/")
}

function formatCampaignDate(value) {
  if (typeof value !== "string") return ""
  const match = /^(\d{4})-([A-Za-z]+)-(\d{1,2})$/.exec(value.trim())
  if (!match) return value
  const month = MONTHS.find((item) => item.toLowerCase() === match[2].toLowerCase())
  if (!month) return value
  return `${Number(match[3])} ${month} ${match[1]} AR`
}

async function findTimeline(campaignDir) {
  const entries = await fs.readdir(campaignDir, { withFileTypes: true })
  const matches = []
  for (const entry of entries) {
    const fullPath = path.join(campaignDir, entry.name)
    if (entry.isDirectory() && entry.name !== ".obsidian" && entry.name !== ".git") {
      matches.push(...(await findTimeline(fullPath)))
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
      const text = await fs.readFile(fullPath, "utf8")
      if (parseFrontmatter(text).type === "timeline") {
        matches.push(path.relative(contentRoot, fullPath).replaceAll(path.sep, "/"))
      }
    }
  }
  return matches
}

function card(campaign, timeline) {
  const { name, metadata, relativeDir } = campaign
  const rawDate =
    metadata.status === "archived"
      ? metadata.current_date ?? metadata.campaign_date_end
      : metadata.current_date
  const date = formatCampaignDate(rawDate)
  const dateLabel =
    metadata.status === "archived"
      ? "Campaign concluded"
      : metadata.status === "active"
        ? "Current campaign date"
        : ""
  const startYear = Number(metadata.campaign_start_year)
  const target = timeline ?? relativeDir
  const href = `./${encodedPath(target.replace(/\.md$/i, ""))}`
  const linkLabel = timeline ? `View ${name} timeline` : `Browse ${name}`

  return [
    "  <section class=\"campaign-archive-group\">",
    `    <h3>${escapeHtml(name)}</h3>`,
    ...(Number.isInteger(startYear) && startYear > 0
      ? [`    <p><strong>Campaign began · ${startYear} AR</strong></p>`]
      : []),
    ...(date && dateLabel
      ? [`    <p><strong>${dateLabel} · ${escapeHtml(date)}</strong></p>`]
      : []),
    `    <p>${escapeHtml(metadata.directory_summary)}</p>`,
    `    <p><a href=\"${href}\">${escapeHtml(linkLabel)}</a></p>`,
    "  </section>",
  ].join("\n")
}

async function main() {
  const entries = await fs.readdir(campaignsRoot, { withFileTypes: true })
  const campaigns = []
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const indexPath = path.join(campaignsRoot, entry.name, "index.md")
    let text
    try {
      text = await fs.readFile(indexPath, "utf8")
    } catch {
      continue
    }
    const metadata = parseFrontmatter(text)
    if (metadata.type !== "campaign" || metadata.calendar !== CALENDAR_NAME) continue
    if (!metadata.status || !metadata.directory_summary) {
      throw new Error(`${indexPath} needs status and directory_summary metadata`)
    }
    const relativeDir = path.relative(contentRoot, path.dirname(indexPath)).replaceAll(path.sep, "/")
    const timelines = await findTimeline(path.dirname(indexPath))
    campaigns.push({
      name: metadata.title ?? entry.name,
      metadata,
      relativeDir,
      timeline: timelines.sort()[0],
    })
  }

  if (campaigns.length === 0) throw new Error(`No ${CALENDAR_NAME} campaign indexes found`)

  campaigns.sort((a, b) => {
    const aYear = Number(a.metadata.campaign_start_year)
    const bYear = Number(b.metadata.campaign_start_year)
    const aStart = Number.isInteger(aYear) && aYear > 0 ? aYear : Number.MIN_SAFE_INTEGER
    const bStart = Number.isInteger(bYear) && bYear > 0 ? bYear : Number.MIN_SAFE_INTEGER
    return bStart - aStart || a.name.localeCompare(b.name)
  })

  const statusGroups = [
    { status: "active", title: "Active Campaigns" },
    { status: "upcoming", title: "Upcoming Campaigns" },
    { status: "archived", title: "Archived Campaigns" },
  ]
  const generated = statusGroups
    .map(({ status, title }) => {
      const members = campaigns.filter((campaign) => campaign.metadata.status === status)
      if (members.length === 0) return ""
      return [
        `### ${title}`,
        "",
        '<div class="campaign-archive-grid">',
        members.map((campaign) => card(campaign, campaign.timeline)).join("\n\n"),
        "</div>",
      ].join("\n")
    })
    .filter(Boolean)
    .join("\n\n")

  const source = await fs.readFile(calendarFile, "utf8")
  const start = source.indexOf(START)
  const end = source.indexOf(END)
  if (start < 0 || end < start) {
    throw new Error(`${calendarFile} must contain ${START} and ${END} markers`)
  }
  const updated = `${source.slice(0, start + START.length)}\n\n${generated}\n\n${source.slice(end)}`
  await fs.writeFile(calendarFile, updated, "utf8")
  console.log(`Generated calendar campaign index for ${campaigns.length} campaigns in ${calendarFile}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
