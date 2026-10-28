import { promises as fs } from "node:fs"
import path from "node:path"
import { execFileSync } from "node:child_process"

const CONTENT_ROOT = path.resolve(process.argv[2] ?? "content")
const LANTERN_ROOT = "Lantern and Ledger"
const INDEX_REL = `${LANTERN_ROOT}/Articles.md`
const INDEX_FILE = path.join(CONTENT_ROOT, INDEX_REL)
const INDEX_DIR = path.posix.dirname(INDEX_REL)
const HOME_FILE = path.join(CONTENT_ROOT, LANTERN_ROOT, "index.md")
const START = "<!-- PUBLIC_ARTICLES_START -->"
const END = "<!-- PUBLIC_ARTICLES_END -->"
const HOME_LINK_START = "<!-- PUBLIC_ARTICLES_LINK_START -->"
const HOME_LINK_END = "<!-- PUBLIC_ARTICLES_LINK_END -->"
const HOMEPAGE_RECENTS_START = "<!-- HOMEPAGE_RECENTS_START -->"
const IGNORED_DIRS = new Set([".git", ".obsidian", "private", "templates", "image metadata"])
const EXCLUDED_TYPES = new Set(["index", "reference", "timeline-metadata"])

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
    const field = /^([A-Za-z0-9_-]+):\s*(.*?)\s*$/.exec(line)
    if (!field) continue

    let value = field[2].replace(/^['"]|['"]$/g, "")
    if (/^(true|false)$/i.test(value)) value = value.toLowerCase() === "true"
    fm[field[1].toLowerCase()] = value
  }

  return fm
}

function isLanternLedger(value) {
  const normalized = String(value ?? "Lantern & Ledger")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()

  return normalized === "lantern & ledger" || normalized === "lantern and ledger"
}

function gitCreatedDate(rel) {
  try {
    const output = execFileSync("git", ["log", "--follow", "--format=%aI", "--", rel], {
      cwd: CONTENT_ROOT,
      encoding: "utf8",
    }).trim()
    const oldest = output.split(/\r?\n/).filter(Boolean).at(-1)
    if (!oldest) return null
    const date = new Date(oldest)
    return Number.isNaN(date.valueOf()) ? null : date
  } catch {
    return null
  }
}

function parseDate(value) {
  if (!value || typeof value !== "string") return null
  const date = new Date(value)
  return Number.isNaN(date.valueOf()) ? null : date
}

function cleanDescription(value) {
  return String(value ?? "")
    .trim()
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2")
    .replace(/\[\[([^\]]+)\]\]/g, (_, target) => target.split("/").at(-1) ?? target)
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_`]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

function descriptionFromBody(text) {
  const body = text
    .replace(/^---\s*\n[\s\S]*?\n---\s*/m, "")
    .replace(/<!--[\s\S]*?-->/g, "")

  for (const paragraph of body.split(/\n\s*\n/)) {
    const raw = paragraph.trim()
    if (!raw || /^(?:#{1,6}\s|!\[|>|```|~~~|<)/.test(raw)) continue

    const cleaned = cleanDescription(raw)
    if (cleaned.length < 60) continue
    if (/^(?:by|published|updated)\b/i.test(cleaned)) continue
    return cleaned.length > 220 ? `${cleaned.slice(0, 217).trimEnd()}…` : cleaned
  }

  return ""
}

function titleFromFrontmatter(fm, rel) {
  return String(fm.title || path.basename(rel, path.extname(rel))).trim()
}

function campaignFromRel(rel) {
  return /^Lantern and Ledger\/Campaigns\/([^/]+)\//i.exec(rel)?.[1] ?? ""
}

function typeLabel(value) {
  return String(value ?? "")
    .trim()
    .split(/[-_]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

function formatDate(date) {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "America/New_York",
  }).format(date)
}

function linkTo(rel) {
  const withoutExtension = rel.replace(/\.md$/i, "")
  let relative = path.posix.relative(INDEX_DIR, withoutExtension)
  if (!relative.startsWith(".")) relative = `./${relative}`
  return encodeURI(relative)
}

function render(items) {
  const lines = [START]

  if (items.length === 0) {
    lines.push("_No spoiler-free articles have been published yet._")
  } else {
    for (const item of items) {
      lines.push(`### [${item.title}](${linkTo(item.rel)})`)
      const meta = [item.campaign, item.type, item.date ? `Published ${formatDate(item.date)}` : ""]
        .filter(Boolean)
        .join(" · ")
      if (meta) lines.push(`*${meta}*`)
      if (item.description) lines.push("", item.description)
      lines.push("")
    }
  }

  lines.push(END)
  return lines.join("\n")
}

function renderHomeLink() {
  return [
    HOME_LINK_START,
    '<p class="public-articles-link"><a href="./Articles">Browse spoiler-free Lantern & Ledger articles →</a></p>',
    HOME_LINK_END,
  ].join("\n")
}

let indexText = await fs.readFile(INDEX_FILE, "utf8")
const items = []

for (const file of await walk(CONTENT_ROOT)) {
  if (path.resolve(file) === path.resolve(INDEX_FILE)) continue

  const rel = path.relative(CONTENT_ROOT, file).replace(/\\/g, "/")
  const text = await fs.readFile(file, "utf8")
  const fm = parseFrontmatter(text)
  const type = String(fm.type ?? "").trim().toLowerCase()

  if (fm.draft === true || fm.publish === false || fm.unlisted === true) continue
  if (fm.spoiler !== false) continue
  if (!isLanternLedger(fm.site_publication)) continue
  if (EXCLUDED_TYPES.has(type)) continue

  items.push({
    rel,
    title: titleFromFrontmatter(fm, rel),
    campaign: campaignFromRel(rel),
    type: typeLabel(type),
    description:
      cleanDescription(fm.card_description ?? fm.description ?? fm.summary ?? fm.excerpt) ||
      descriptionFromBody(text),
    date: parseDate(fm.date ?? fm.created ?? fm.article_release_date) ?? gitCreatedDate(rel),
  })
}

items.sort((a, b) => {
  const aTime = a.date?.valueOf() ?? 0
  const bTime = b.date?.valueOf() ?? 0
  return bTime - aTime || a.title.localeCompare(b.title)
})

const block = render(items)
const existing = new RegExp(`${START}[\\s\\S]*?${END}`, "m")
if (existing.test(indexText)) {
  indexText = indexText.replace(existing, block)
} else {
  indexText = `${indexText.trimEnd()}\n\n${block}\n`
}

await fs.writeFile(INDEX_FILE, indexText, "utf8")

let homeText = await fs.readFile(HOME_FILE, "utf8")
const homeLink = renderHomeLink()
const existingHomeLink = new RegExp(`${HOME_LINK_START}[\\s\\S]*?${HOME_LINK_END}\\n*`, "m")
homeText = homeText.replace(existingHomeLink, "")

if (homeText.includes(HOMEPAGE_RECENTS_START)) {
  homeText = homeText.replace(HOMEPAGE_RECENTS_START, `${homeLink}\n\n${HOMEPAGE_RECENTS_START}`)
} else {
  homeText = `${homeText.trimEnd()}\n\n${homeLink}\n`
}

await fs.writeFile(HOME_FILE, homeText, "utf8")
console.log(`Generated ${items.length} spoiler-free Lantern & Ledger article entries in ${INDEX_REL}`)
