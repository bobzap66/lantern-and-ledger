import { promises as fs } from "node:fs"
import path from "node:path"
import YAML from "yaml"

const contentRoot = path.resolve(process.argv[2] ?? "content")
const campaignsRoot = path.join(contentRoot, "Campaigns")
const directoryFile = path.join(campaignsRoot, "index.md")
const archiveFile = path.join(campaignsRoot, "Archive.md")
const DIRECTORY_START = "<!-- CAMPAIGN_DIRECTORY_GENERATED_START -->"
const DIRECTORY_END = "<!-- CAMPAIGN_DIRECTORY_GENERATED_END -->"
const ARCHIVE_START = "<!-- CAMPAIGN_ARCHIVE_GENERATED_START -->"
const ARCHIVE_END = "<!-- CAMPAIGN_ARCHIVE_GENERATED_END -->"
const STATUS_GROUPS = [
  { status: "active", title: "Active Campaigns" },
  { status: "upcoming", title: "Coming Soon" },
  { status: "archived", title: "Archived Campaigns" },
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

function campaignSlug(value) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

function startYear(campaign) {
  const value = Number(campaign.metadata.campaign_start_year)
  if (Number.isInteger(value) && value > 0) return value
  const dateYear = /^(\d{4})-/.exec(String(campaign.metadata.campaign_date_start ?? ""))?.[1]
  return dateYear ? Number(dateYear) : 0
}

function card(campaign, { archived = false, titleLevel = 3 } = {}) {
  const { folder, metadata, name } = campaign
  const slug = campaignSlug(folder)
  const classes = ["campaign-directory__card", `campaign-directory__card--${slug}`]
  if (archived) classes.push("campaign-directory__card--archived")

  const accent = /^#[\da-f]{6}$/i.test(String(metadata.directory_accent ?? ""))
    ? ` style="--campaign-directory-accent: ${metadata.directory_accent}"`
    : ""
  const href = `./${encodedPath(folder)}`
  const image = typeof metadata.directory_image === "string" ? metadata.directory_image : ""
  const imageMarkup = image
    ? `\n<img class="campaign-directory__image" src="../${escapeHtml(image)}" alt="">`
    : ""
  const status = archived
    ? "Archived"
    : metadata.status === "upcoming"
      ? "Coming Soon"
      : ""
  const statusMarkup = status
    ? `\n<div class="campaign-directory__status">${status}</div>`
    : ""

  return [
    `<div class="${classes.join(" ")}"${accent}>`,
    `<a class="campaign-directory__link" href="${href}" aria-label="Open ${escapeHtml(name)} campaign"></a>`,
    imageMarkup.trimStart(),
    '<div class="campaign-directory__copy">',
    statusMarkup.trimStart(),
    `<div class="campaign-directory__eyebrow">${escapeHtml(metadata.directory_eyebrow)}</div>`,
    `<h${titleLevel} class="campaign-directory__title">${escapeHtml(name)}</h${titleLevel}>`,
    `<p class="campaign-directory__subtitle">${escapeHtml(metadata.directory_summary)}</p>`,
    "</div>",
    "</div>",
  ]
    .filter(Boolean)
    .join("\n")
}

function replaceGeneratedBlock(source, startMarker, endMarker, generated, filePath, newline) {
  const start = source.indexOf(startMarker)
  const end = source.indexOf(endMarker)
  if (start < 0 || end < start) {
    throw new Error(`${filePath} must contain ${startMarker} and ${endMarker}`)
  }
  const normalized = generated.replaceAll("\n", newline)
  return `${source.slice(0, start + startMarker.length)}${newline}${newline}${normalized}${newline}${newline}${source.slice(end)}`
}

async function loadCampaigns() {
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
    if (metadata.type !== "campaign" || metadata.draft === true || metadata.publish === false) continue
    if (!STATUS_GROUPS.some((group) => group.status === metadata.status)) {
      throw new Error(`${indexPath} needs status active, upcoming, or archived`)
    }
    for (const field of ["directory_summary", "directory_eyebrow"]) {
      if (typeof metadata[field] !== "string" || !metadata[field].trim()) {
        throw new Error(`${indexPath} needs ${field} metadata`)
      }
    }

    campaigns.push({
      folder: entry.name,
      name: metadata.title ?? entry.name,
      metadata,
    })
  }

  campaigns.sort((a, b) => startYear(b) - startYear(a) || a.name.localeCompare(b.name))
  if (!campaigns.some((campaign) => campaign.metadata.status === "archived")) {
    throw new Error("No published archived campaigns found")
  }
  return campaigns
}

function buildDirectory(campaigns) {
  const counts = STATUS_GROUPS.map(({ status }) => {
    const count = campaigns.filter((campaign) => campaign.metadata.status === status).length
    return `${count} ${status === "upcoming" ? "upcoming" : status} campaign${count === 1 ? "" : "s"}`
  })

  const sections = STATUS_GROUPS.map(({ status, title }) => {
    const members = campaigns.filter((campaign) => campaign.metadata.status === status)
    if (members.length === 0) return ""
    const archived = status === "archived"
    const cards = members.map((campaign) => card(campaign, { archived, titleLevel: 3 })).join("\n")
    return [
      '<section class="campaign-directory__section">',
      `<h2 class="campaign-directory__section-title">${title}</h2>`,
      `<div class="campaign-directory__grid${archived ? " campaign-directory__grid--archived" : ""}">`,
      cards,
      "</div>",
      "</section>",
    ].join("\n")
  }).filter(Boolean)

  return [
    '<div class="campaign-directory">',
    `<p class="campaign-directory__intro">${counts.join(", ")}, preserved below.</p>`,
    ...sections,
    '<p><a href="./Archive">Browse the completed campaign chronicles →</a></p>',
    "</div>",
  ].join("\n")
}

function buildArchive(campaigns) {
  const archived = campaigns.filter((campaign) => campaign.metadata.status === "archived")
  return [
    '<div class="campaign-directory">',
    '<div class="campaign-directory__grid campaign-directory__grid--archived">',
    archived.map((campaign) => card(campaign, { archived: true, titleLevel: 2 })).join("\n"),
    "</div>",
    "</div>",
  ].join("\n")
}

async function main() {
  const campaigns = await loadCampaigns()
  for (const { filePath, startMarker, endMarker, generated } of [
    {
      filePath: directoryFile,
      startMarker: DIRECTORY_START,
      endMarker: DIRECTORY_END,
      generated: buildDirectory(campaigns),
    },
    {
      filePath: archiveFile,
      startMarker: ARCHIVE_START,
      endMarker: ARCHIVE_END,
      generated: buildArchive(campaigns),
    },
  ]) {
    const source = await fs.readFile(filePath, "utf8")
    const newline = source.includes("\r\n") ? "\r\n" : "\n"
    const updated = replaceGeneratedBlock(source, startMarker, endMarker, generated, filePath, newline)
    await fs.writeFile(filePath, updated, "utf8")
  }

  const archivedCount = campaigns.filter((campaign) => campaign.metadata.status === "archived").length
  console.log(`Generated campaign directory and archive from ${campaigns.length} campaign roots (${archivedCount} archived)`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
