import { promises as fs } from "node:fs"
import path from "node:path"
import YAML from "yaml"

const contentRoot = path.resolve(process.argv[2] ?? "content")
const DIRECTORY_START = "<!-- CAMPAIGN_DIRECTORY_GENERATED_START -->"
const DIRECTORY_END = "<!-- CAMPAIGN_DIRECTORY_GENERATED_END -->"
const ARCHIVE_START = "<!-- CAMPAIGN_ARCHIVE_GENERATED_START -->"
const ARCHIVE_END = "<!-- CAMPAIGN_ARCHIVE_GENERATED_END -->"
const DEFAULT_SITE_PUBLICATION = "Lantern & Ledger"
const STATUS_GROUPS = [
  { status: "active", title: "Active Campaigns" },
  { status: "upcoming", title: "Upcoming Campaigns" },
  { status: "archived", title: "Archived Campaigns" },
]
const PUBLICATION_CAMPAIGN_ROOTS = new Map([
  ["Lantern & Ledger", path.join(contentRoot, "Lantern and Ledger", "Campaigns")],
  ["Beacon & Bulletin", path.join(contentRoot, "Beacon and Bulletin", "Campaigns")],
])

function parseFrontmatter(text) {
  const match = /^---\s*\r?\n([\s\S]*?)\r?\n---/.exec(text)
  if (!match) return {}
  return YAML.parse(match[1]) ?? {}
}

function normalizeSitePublication(value) {
  const normalized = String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()

  if (normalized === "beacon & bulletin") return "Beacon & Bulletin"
  return DEFAULT_SITE_PUBLICATION
}

function campaignRootForPublication(sitePublication) {
  const root = PUBLICATION_CAMPAIGN_ROOTS.get(sitePublication)
  if (!root) throw new Error(`Unsupported site_publication: ${sitePublication}`)
  return root
}

function relativeContentPath(filePath) {
  return path.relative(contentRoot, filePath).replaceAll(path.sep, "/")
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

function relativeUrl(fromDir, target) {
  let relative = path.posix.relative(fromDir || ".", target)
  if (!relative.startsWith(".")) relative = `./${relative}`
  return encodedPath(relative)
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

function card(campaign, sourceDir, campaignBaseRel, { archived = false, titleLevel = 3 } = {}) {
  const { folder, metadata, name } = campaign
  const slug = campaignSlug(folder)
  const classes = ["campaign-directory__card", `campaign-directory__card--${slug}`]
  if (archived) classes.push("campaign-directory__card--archived")

  const accent = /^#[\da-f]{6}$/i.test(String(metadata.directory_accent ?? ""))
    ? ` style="--campaign-directory-accent: ${metadata.directory_accent}"`
    : ""
  const href = relativeUrl(sourceDir, path.posix.join(campaignBaseRel, folder))
  const image = typeof metadata.directory_image === "string" ? metadata.directory_image : ""
  const imageTarget = image.replace(/^\/+/, "")
  const imageMarkup = imageTarget
    ? `\n<img class="campaign-directory__image" src="${escapeHtml(relativeUrl(sourceDir, imageTarget))}" alt="">`
    : ""
  const status = archived ? "Archived" : metadata.status === "upcoming" ? "Upcoming" : "Active"
  const statusMarkup = `\n<div class="campaign-directory__status">${status}</div>`

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

async function loadCampaigns(sitePublication) {
  const campaignsRoot = campaignRootForPublication(sitePublication)
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
    if (normalizeSitePublication(metadata.site_publication) !== sitePublication) continue
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
  return campaigns
}

function buildDirectory(campaigns, sitePublication, sourceDir, campaignBaseRel) {
  const counts = STATUS_GROUPS.map(({ status }) => {
    const count = campaigns.filter((campaign) => campaign.metadata.status === status).length
    return `${count} ${status === "upcoming" ? "upcoming" : status} campaign${count === 1 ? "" : "s"}`
  })

  const sections = STATUS_GROUPS.map(({ status, title }) => {
    const members = campaigns.filter((campaign) => campaign.metadata.status === status)
    if (members.length === 0) return ""
    const archived = status === "archived"
    const cards = members
      .map((campaign) => card(campaign, sourceDir, campaignBaseRel, { archived, titleLevel: 3 }))
      .join("\n")
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
    `<div class="campaign-directory" data-site-publication="${escapeHtml(sitePublication)}">`,
    campaigns.length > 0
      ? `<p class="campaign-directory__intro">${counts.join(", ")}, preserved below.</p>`
      : '<p class="campaign-directory__empty">No campaigns have been added yet.</p>',
    ...sections,
    '<p><a href="./Archive">Browse the completed campaign chronicles →</a></p>',
    "</div>",
  ].join("\n")
}

function buildArchive(campaigns, sitePublication, sourceDir, campaignBaseRel) {
  const archived = campaigns.filter((campaign) => campaign.metadata.status === "archived")
  const archiveContent =
    archived.length > 0
      ? archived
          .map((campaign) => card(campaign, sourceDir, campaignBaseRel, { archived: true, titleLevel: 2 }))
          .join("\n")
      : '<p class="campaign-directory__empty">No archived campaigns yet.</p>'

  return [
    `<div class="campaign-directory" data-site-publication="${escapeHtml(sitePublication)}">`,
    '<div class="campaign-directory__grid campaign-directory__grid--archived">',
    archiveContent,
    "</div>",
    "</div>",
  ].join("\n")
}

async function findDirectoryTargets(dir = contentRoot) {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const targets = []

  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      targets.push(...(await findDirectoryTargets(full)))
      continue
    }
    if (!entry.isFile() || entry.name.toLowerCase() !== "index.md") continue

    const source = await fs.readFile(full, "utf8")
    if (!source.includes(DIRECTORY_START) || !source.includes(DIRECTORY_END)) continue

    const archiveFile = path.join(path.dirname(full), "Archive.md")
    const archiveSource = await fs.readFile(archiveFile, "utf8")
    if (!archiveSource.includes(ARCHIVE_START) || !archiveSource.includes(ARCHIVE_END)) {
      throw new Error(`${archiveFile} must contain campaign archive generation markers`)
    }

    targets.push({ directoryFile: full, directorySource: source, archiveFile, archiveSource })
  }

  return targets
}

async function main() {
  const targets = await findDirectoryTargets()

  for (const target of targets) {
    const directoryPublication = normalizeSitePublication(
      parseFrontmatter(target.directorySource).site_publication,
    )
    const archivePublication = normalizeSitePublication(
      parseFrontmatter(target.archiveSource).site_publication,
    )

    if (directoryPublication !== archivePublication) {
      throw new Error(
        `${target.directoryFile} and ${target.archiveFile} must use the same site_publication (found ${directoryPublication} and ${archivePublication})`,
      )
    }

    const sourceDir = relativeContentPath(path.dirname(target.directoryFile))
    const campaignBaseRel = relativeContentPath(campaignRootForPublication(directoryPublication))
    const campaigns = await loadCampaigns(directoryPublication)
    const outputs = [
      {
        filePath: target.directoryFile,
        source: target.directorySource,
        startMarker: DIRECTORY_START,
        endMarker: DIRECTORY_END,
        generated: buildDirectory(campaigns, directoryPublication, sourceDir, campaignBaseRel),
      },
      {
        filePath: target.archiveFile,
        source: target.archiveSource,
        startMarker: ARCHIVE_START,
        endMarker: ARCHIVE_END,
        generated: buildArchive(campaigns, directoryPublication, sourceDir, campaignBaseRel),
      },
    ]

    for (const { filePath, source, startMarker, endMarker, generated } of outputs) {
      const newline = source.includes("\r\n") ? "\r\n" : "\n"
      const updated = replaceGeneratedBlock(
        source,
        startMarker,
        endMarker,
        generated,
        filePath,
        newline,
      )
      await fs.writeFile(filePath, updated, "utf8")
    }

    const archivedCount = campaigns.filter((campaign) => campaign.metadata.status === "archived").length
    console.log(
      `Generated ${directoryPublication} campaign directory and archive from ${campaigns.length} campaign roots (${archivedCount} archived)`,
    )
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
