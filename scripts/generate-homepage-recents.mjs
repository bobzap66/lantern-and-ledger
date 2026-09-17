import "./generate-campaign-directory.mjs"
import "./generate-campaign-timelines.mjs"
import { promises as fs } from "node:fs"
import path from "node:path"
import { execFileSync } from "node:child_process"

const CONTENT_ROOT = path.resolve(process.argv[2] ?? "content")
const INDEX_FILE = path.join(CONTENT_ROOT, "index.md")
const COUNT = 3

const HOME_START = "<!-- HOMEPAGE_RECENTS_START -->"
const HOME_END = "<!-- HOMEPAGE_RECENTS_END -->"
const CAMPAIGN_START = "<!-- CAMPAIGN_RECENTS_START -->"
const CAMPAIGN_END = "<!-- CAMPAIGN_RECENTS_END -->"

const IGNORED_DIRS = new Set([".git", ".obsidian", "private", "templates", "image metadata"])
const MAINTENANCE_COMMIT = /(autolink|wikilink|link conversion|resolver|homepage navigation|one-shot|migration|maintenance|script|quartz|workflow)/i
const HIDDEN_RECENT_PATHS = ["campaigns/abomination vaults/reconstruction/"]
const HOME_EDITORIAL_FOLDERS = new Set([
  "session notes",
  "vignettes",
  "articles",
  "chapters",
  "campaign history",
  "chronicles of the new roseguard",
])
const HOME_EDITORIAL_TYPES = new Set([
  "article",
  "campaign-chapter",
  "chronicle",
  "newspaper",
  "report",
  "session",
  "vignette",
])
const RECENT_TYPE_LABELS = new Map([
  ["article", "Article"],
  ["campaign-chapter", "Campaign Chapter"],
  ["campaign-summary", "Campaign Summary"],
  ["chronicle", "Chronicle"],
  ["landmark", "Landmark"],
  ["newspaper", "Newspaper"],
  ["person", "Person"],
  ["report", "Report"],
  ["session", "Session"],
  ["settlement", "Settlement"],
  ["timeline", "Timeline"],
  ["timeline-metadata", "Timeline Metadata"],
  ["vignette", "Vignette"],
])

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    if (entry.isDirectory() && IGNORED_DIRS.has(entry.name.toLowerCase())) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) files.push(...(await walk(full)))
    else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) files.push(full)
  }
  return files
}

function parseFrontmatter(text) {
  const match = /^---\s*\n([\s\S]*?)\n---/.exec(text)
  if (!match) return {}
  const fm = {}
  for (const line of match[1].split(/\r?\n/)) {
    const m = /^([A-Za-z0-9_-]+):\s*(.*?)\s*$/.exec(line)
    if (!m) continue
    let value = m[2].replace(/^['"]|['"]$/g, "")
    if (/^(true|false)$/i.test(value)) value = value.toLowerCase() === "true"
    fm[m[1].toLowerCase()] = value
  }
  return fm
}

function gitHistory(rel) {
  try {
    const output = execFileSync(
      "git",
      ["log", "--follow", "--format=%aI%x09%s", "--", rel],
      { cwd: CONTENT_ROOT, encoding: "utf8" },
    ).trim()
    if (!output) return []
    return output.split(/\r?\n/).map((line) => {
      const tab = line.indexOf("\t")
      return {
        date: new Date(tab >= 0 ? line.slice(0, tab) : line),
        message: tab >= 0 ? line.slice(tab + 1) : "",
      }
    }).filter((entry) => !Number.isNaN(entry.date.valueOf()))
  } catch {
    return []
  }
}

function parseDate(value) {
  if (!value || typeof value !== "string") return null
  const date = new Date(value)
  return Number.isNaN(date.valueOf()) ? null : date
}

function linkFrom(baseDir, targetRel) {
  const withoutExtension = targetRel.replace(/\.md$/i, "")
  let relative = path.posix.relative(baseDir || ".", withoutExtension)
  if (!relative.startsWith(".")) relative = `./${relative}`
  return relative
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
}

function formatDate(date) {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "America/New_York",
  }).format(date)
}

function campaignFromRel(rel) {
  return /^Campaigns\/([^/]+)\//i.exec(rel)?.[1] ?? ""
}

function recentTypeLabel(note) {
  const segments = note.rel.toLowerCase().split("/")

  if (segments.includes("characters")) return "Character"
  if (segments.includes("npcs")) return "NPC"
  if (segments.includes("chronicles of the new roseguard")) return "Chronicle"
  if (segments.includes("session notes")) return "Session Report"
  if (segments.includes("vignettes")) return "Vignette"
  if (segments.includes("campaign history")) return "Campaign History"

  const type = String(note.type ?? "").trim().toLowerCase()
  if (!type) return ""
  if (RECENT_TYPE_LABELS.has(type)) return RECENT_TYPE_LABELS.get(type)

  return type
    .split(/[-_]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

function isHomepageEditorial(note) {
  if (!note.campaign) return false
  const type = String(note.type ?? "").toLowerCase()
  if (HOME_EDITORIAL_TYPES.has(type)) return true

  const segments = note.rel.toLowerCase().split("/")
  return segments.some((segment) => HOME_EDITORIAL_FOLDERS.has(segment))
}

function chooseRecents(pool, excluded = new Set()) {
  const brandNew = [...pool]
    .filter((note) => !excluded.has(note.rel))
    .sort((a, b) => b.created - a.created || a.title.localeCompare(b.title))
    .slice(0, COUNT)

  const brandNewPaths = new Set([...excluded, ...brandNew.map((note) => note.rel)])
  const recentlyUpdated = [...pool]
    .filter((note) => !brandNewPaths.has(note.rel))
    .sort((a, b) => b.modified - a.modified || a.title.localeCompare(b.title))
    .slice(0, COUNT)

  return { brandNew, recentlyUpdated }
}

function renderHomeSection(title, items, dateField, baseDir) {
  const lines = [
    '<section class="home-recent-column">',
    `<h3>${escapeHtml(title)}</h3>`,
    '<div class="home-recent-list">',
  ]

  if (items.length === 0) {
    lines.push('<p class="home-recent-empty">Nothing here yet.</p>')
  } else {
    for (const item of items) {
      const date = item[dateField]
      const href = encodeURI(linkFrom(baseDir, item.rel))
      const typeLabel = recentTypeLabel(item)
      const meta = [
        `<span class="home-recent-campaign">${escapeHtml(item.campaign)}</span>`,
        typeLabel ? `<span class="home-recent-type">${escapeHtml(typeLabel)}</span>` : "",
      ].filter(Boolean).join('<span class="home-recent-separator" aria-hidden="true">·</span>')

      lines.push(
        `<a class="home-recent-card" href="${escapeHtml(href)}">`,
        `<span class="home-recent-meta">${meta}</span>`,
        `<span class="home-recent-title">${escapeHtml(item.title)}</span>`,
        `<time class="home-recent-date" datetime="${escapeHtml(date.toISOString())}">${escapeHtml(formatDate(date))}</time>`,
        "</a>",
      )
    }
  }

  lines.push("</div>", "</section>")
  return lines.join("\n")
}

function renderCampaignSection(title, items, dateField, baseDir) {
  const lines = [
    '<section class="campaign-recent-column">',
    `<h3>${escapeHtml(title)}</h3>`,
    '<div class="campaign-recent-list">',
  ]

  if (items.length === 0) {
    lines.push('<p class="campaign-recent-empty">Nothing here yet.</p>')
  } else {
    for (const item of items) {
      const date = item[dateField]
      const href = encodeURI(linkFrom(baseDir, item.rel))
      const typeLabel = recentTypeLabel(item)

      lines.push(
        `<a class="campaign-recent-card" href="${escapeHtml(href)}">`,
        typeLabel ? `<span class="campaign-recent-type">${escapeHtml(typeLabel)}</span>` : "",
        `<span class="campaign-recent-title">${escapeHtml(item.title)}</span>`,
        `<time class="campaign-recent-date" datetime="${escapeHtml(date.toISOString())}">${escapeHtml(formatDate(date))}</time>`,
        "</a>",
      )
    }
  }

  lines.push("</div>", "</section>")
  return lines.join("\n")
}

function renderBlock(start, end, recents, baseDir) {
  if (start === HOME_START) {
    return [
      start,
      '<section class="home-recents" aria-labelledby="whats-new">',
      '<h2 id="whats-new">What\'s New</h2>',
      '<div class="home-recent-columns">',
      renderHomeSection("Brand New", recents.brandNew, "created", baseDir),
      renderHomeSection("Recently Revised", recents.recentlyUpdated, "modified", baseDir),
      "</div>",
      "</section>",
      end,
    ].join("\n")
  }

  return [
    start,
    '<section class="campaign-recents" aria-labelledby="campaign-whats-new">',
    '<h2 id="campaign-whats-new">What\'s New</h2>',
    '<div class="campaign-recent-columns">',
    renderCampaignSection("Brand New", recents.brandNew, "created", baseDir),
    renderCampaignSection("Recently Updated", recents.recentlyUpdated, "modified", baseDir),
    "</div>",
    "</section>",
    end,
  ].join("\n")
}

async function injectBlock(file, start, end, block, preferredMarker = null) {
  let text = await fs.readFile(file, "utf8")
  const existing = new RegExp(`${start}[\\s\\S]*?${end}\\n*`, "m")
  text = text.replace(existing, "")

  if (preferredMarker && text.includes(preferredMarker)) {
    text = text.replace(preferredMarker, `${block}\n\n${preferredMarker}`)
  } else {
    const firstSection = /^##\s+/m.exec(text)
    if (firstSection) {
      text = `${text.slice(0, firstSection.index).trimEnd()}\n\n${block}\n\n${text.slice(firstSection.index)}`
    } else {
      text = `${text.trimEnd()}\n\n${block}\n`
    }
  }

  await fs.writeFile(file, text, "utf8")
}

const notes = []
const campaigns = []

for (const file of await walk(CONTENT_ROOT)) {
  const rel = path.relative(CONTENT_ROOT, file).replace(/\\/g, "/")
  const relLower = rel.toLowerCase()
  if (HIDDEN_RECENT_PATHS.some((prefix) => relLower.startsWith(prefix))) continue

  const text = await fs.readFile(file, "utf8")
  const fm = parseFrontmatter(text)

  if (String(fm.type ?? "").toLowerCase() === "campaign") {
    const match = /^Campaigns\/([^/]+)\/[^/]+\.md$/i.exec(rel)
    if (match) campaigns.push({ file, rel, dir: path.posix.dirname(rel), title: String(fm.title || match[1]) })
  }

  if (rel.toLowerCase() === "index.md") continue
  if (fm.draft === true || fm.publish === false || String(fm.type ?? "").toLowerCase() === "index") continue

  const history = gitHistory(rel)
  if (history.length === 0) continue

  const explicitCreated = parseDate(fm.created ?? fm.date)
  const explicitModified = parseDate(fm.modified ?? fm.updated)
  const created = explicitCreated ?? history.at(-1).date
  const meaningful = history.find((entry) => !MAINTENANCE_COMMIT.test(entry.message))
  const modified = explicitModified ?? meaningful?.date ?? history[0].date

  const title = String(fm.title || path.basename(rel, path.extname(rel))).trim()
  notes.push({
    rel,
    title,
    type: String(fm.type ?? ""),
    campaign: campaignFromRel(rel),
    created,
    modified,
  })
}

const homeRecents = chooseRecents(notes.filter(isHomepageEditorial))
await injectBlock(
  INDEX_FILE,
  HOME_START,
  HOME_END,
  renderBlock(HOME_START, HOME_END, homeRecents, "."),
  "<!-- HOMEPAGE_RECENTS -->",
)

console.log("Homepage recents generated")
console.log("Brand New:", homeRecents.brandNew.map((note) => `${note.campaign}: ${note.title}`).join(", "))
console.log("Recently Revised:", homeRecents.recentlyUpdated.map((note) => `${note.campaign}: ${note.title}`).join(", "))

for (const campaign of campaigns) {
  const prefix = `${campaign.dir}/`
  const pool = notes.filter((note) => note.rel.startsWith(prefix))
  const recents = chooseRecents(pool, new Set([campaign.rel]))
  const block = renderBlock(CAMPAIGN_START, CAMPAIGN_END, recents, campaign.dir)
  await injectBlock(campaign.file, CAMPAIGN_START, CAMPAIGN_END, block)
  console.log(`${campaign.title} recents generated`)
  console.log("  Brand New:", recents.brandNew.map((note) => note.title).join(", "))
  console.log("  Recently Updated:", recents.recentlyUpdated.map((note) => note.title).join(", "))
}
