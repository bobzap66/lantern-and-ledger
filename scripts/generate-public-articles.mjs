import { promises as fs } from "node:fs"
import path from "node:path"
import { execFileSync } from "node:child_process"

const CONTENT_ROOT = path.resolve(process.argv[2] ?? "content")
const START = "<!-- PUBLIC_ARTICLES_START -->"
const END = "<!-- PUBLIC_ARTICLES_END -->"
const HOME_LINK_START = "<!-- PUBLIC_ARTICLES_LINK_START -->"
const HOME_LINK_END = "<!-- PUBLIC_ARTICLES_LINK_END -->"
const HOMEPAGE_RECENTS_START = "<!-- HOMEPAGE_RECENTS_START -->"
const IGNORED_DIRS = new Set([".git", ".obsidian", "private", "templates", "image metadata"])
const EXCLUDED_TYPES = new Set(["index", "reference", "timeline-metadata", "campaign"])

const PUBLICATIONS = [
  {
    name: "Lantern & Ledger",
    root: "Lantern and Ledger",
    aliases: new Set(["lantern & ledger", "lantern and ledger"]),
    indexRel: "Lantern and Ledger/Articles.md",
    homeRel: "Lantern and Ledger/index.md",
    homeHref: "./articles/",
    homeLabel: "Browse spoiler-free Lantern & Ledger articles →",
  },
  {
    name: "Beacon & Bulletin",
    root: "Beacon and Bulletin",
    aliases: new Set(["beacon & bulletin", "beacon and bulletin"]),
    indexRel: "Beacon and Bulletin/Articles/index.md",
    homeRel: null,
    homeHref: "./articles/",
    homeLabel: "Browse spoiler-free Beacon & Bulletin articles →",
  },
]

const ROOT_HOME_FILE = path.join(CONTENT_ROOT, "index.md")

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
  const match = /^---\s*\r?\n([\s\S]*?)\r?\n---/.exec(text)
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

function normalizePublication(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
}

function isPublication(value, publication) {
  return publication.aliases.has(normalizePublication(value))
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
    .replace(/^---\s*\r?\n[\s\S]*?\r?\n---\s*/m, "")
    .replace(/<!--[\s\S]*?-->/g, "")

  for (const paragraph of body.split(/\r?\n\s*\r?\n/)) {
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

function campaignFromRel(rel, publication) {
  const prefix = `${publication.root}/Campaigns/`
  if (!rel.toLowerCase().startsWith(prefix.toLowerCase())) return ""
  return rel.slice(prefix.length).split("/")[0] ?? ""
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

function linkTo(rel, indexRel) {
  const withoutExtension = rel.replace(/\.md$/i, "")
  const indexDir = path.posix.dirname(indexRel)
  let relative = path.posix.relative(indexDir, withoutExtension)
  if (!relative.startsWith(".")) relative = `./${relative}`
  return relative
}

function render(items, publication) {
  const lines = [START]

  if (items.length === 0) {
    lines.push("_No spoiler-free articles have been published yet._")
  } else {
    for (const item of items) {
      lines.push(`### [[${linkTo(item.rel, publication.indexRel)}|${item.title}]]`)
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

function replaceMarkedBlock(source, startMarker, endMarker, replacement) {
  const existing = new RegExp(`${startMarker}[\\s\\S]*?${endMarker}`, "m")
  if (existing.test(source)) return source.replace(existing, replacement)
  return `${source.trimEnd()}\n\n${replacement}\n`
}

function renderPublicationHomeLink(publication) {
  return [
    HOME_LINK_START,
    `<p class="public-articles-link"><a href="${publication.homeHref}">${publication.homeLabel}</a></p>`,
    HOME_LINK_END,
  ].join("\n")
}

function renderRootHomeLinks() {
  return [
    HOME_LINK_START,
    '<div class="public-articles-links">',
    '  <p class="public-articles-link"><a href="./lantern-and-ledger/articles/">Browse spoiler-free Lantern & Ledger articles →</a></p>',
    '  <p class="public-articles-link"><a href="./beacon-and-bulletin/articles/">Browse spoiler-free Beacon & Bulletin articles →</a></p>',
    "</div>",
    HOME_LINK_END,
  ].join("\n")
}

const files = await walk(CONTENT_ROOT)

for (const publication of PUBLICATIONS) {
  const indexFile = path.join(CONTENT_ROOT, publication.indexRel)
  let indexText = await fs.readFile(indexFile, "utf8")
  const items = []

  for (const file of files) {
    if (path.resolve(file) === path.resolve(indexFile)) continue

    const rel = path.relative(CONTENT_ROOT, file).replace(/\\/g, "/")
    const text = await fs.readFile(file, "utf8")
    const fm = parseFrontmatter(text)
    const type = String(fm.type ?? "")
      .trim()
      .toLowerCase()

    if (fm.draft === true || fm.publish === false || fm.unlisted === true) continue
    if (fm.spoiler !== false) continue
    if (!isPublication(fm.site_publication, publication)) continue
    if (EXCLUDED_TYPES.has(type)) continue

    items.push({
      rel,
      title: titleFromFrontmatter(fm, rel),
      campaign: campaignFromRel(rel, publication),
      type: typeLabel(type),
      description:
        cleanDescription(fm.card_description ?? fm.description ?? fm.summary ?? fm.excerpt) ||
        descriptionFromBody(text),
      date:
        parseDate(fm.date ?? fm.created ?? fm.article_release_date ?? fm.publication_date) ??
        gitCreatedDate(rel),
    })
  }

  items.sort((a, b) => {
    const aTime = a.date?.valueOf() ?? 0
    const bTime = b.date?.valueOf() ?? 0
    return bTime - aTime || a.title.localeCompare(b.title)
  })

  indexText = replaceMarkedBlock(indexText, START, END, render(items, publication))
  await fs.writeFile(indexFile, indexText, "utf8")

  if (publication.homeRel) {
    const homeFile = path.join(CONTENT_ROOT, publication.homeRel)
    let homeText = await fs.readFile(homeFile, "utf8")
    const homeLink = renderPublicationHomeLink(publication)
    const existingHomeLink = new RegExp(`${HOME_LINK_START}[\\s\\S]*?${HOME_LINK_END}\\n*`, "m")
    homeText = homeText.replace(existingHomeLink, "")

    if (homeText.includes(HOMEPAGE_RECENTS_START)) {
      homeText = homeText.replace(HOMEPAGE_RECENTS_START, `${homeLink}\n\n${HOMEPAGE_RECENTS_START}`)
    } else {
      homeText = `${homeText.trimEnd()}\n\n${homeLink}\n`
    }

    await fs.writeFile(homeFile, homeText, "utf8")
  }

  console.log(
    `Generated ${items.length} spoiler-free ${publication.name} article entries in ${publication.indexRel}`,
  )
}

let rootHomeText = await fs.readFile(ROOT_HOME_FILE, "utf8")
rootHomeText = replaceMarkedBlock(
  rootHomeText,
  HOME_LINK_START,
  HOME_LINK_END,
  renderRootHomeLinks(),
)
await fs.writeFile(ROOT_HOME_FILE, rootHomeText, "utf8")
