import { promises as fs } from "node:fs"
import path from "node:path"
import { execFileSync } from "node:child_process"
import YAML from "yaml"
import { isPublicEditorial, normalizeAuthor, authorKey, parseDisplayDate, typeLabel, renderReadingRoom } from "./reading-room-helpers.mjs"

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

function parseFrontmatter(source) {
  const match = /^---\s*\r?\n([\s\S]*?)\r?\n---/.exec(source)
  return match ? (YAML.parse(match[1]) ?? {}) : {}
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


function linkTo(rel, indexRel) {
  const withoutExtension = rel.replace(/\.md$/i, "")
  const indexDir = path.posix.dirname(indexRel)
  let relative = path.posix.relative(indexDir, withoutExtension)
  if (!relative.startsWith(".")) relative = `./${relative}`
  return relative
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
    '<section class="greene-reading-room">',
    '  <span class="greene-reading-eyebrow">Spoiler-free reading</span>',
    '  <h2>Stories before the spoilers</h2>',
    '  <p>Browse public-facing features and dispatches from either side of Greene Gaming without opening campaign-spoiler archives.</p>',
    '  <div class="greene-article-links">',
    '    <a class="greene-article-link greene-article-link--lantern" href="./lantern-and-ledger/articles/"><strong>Lantern &amp; Ledger</strong><span>Browse Pathfinder articles →</span></a>',
    '    <a class="greene-article-link greene-article-link--beacon" href="./beacon-and-bulletin/articles/"><strong>Beacon &amp; Bulletin</strong><span>Browse Starfinder articles →</span></a>',
    "  </div>",
    "</section>",
    HOME_LINK_END,
  ].join("\n")
}

const files = await walk(CONTENT_ROOT)

for (const publication of PUBLICATIONS) {
  const indexFile = path.join(CONTENT_ROOT, publication.indexRel)
  let indexText = await fs.readFile(indexFile, "utf8")
  const items = []
  const authorProfiles = new Map()

  // Resolve byline aliases to existing staff profiles, never synthetic profiles.
  for (const file of files) {
    const rel = path.relative(CONTENT_ROOT, file).replaceAll("\\", "/")
    const fm = parseFrontmatter(await fs.readFile(file, "utf8"))
    if (!isPublication(fm.site_publication, publication)) continue
    if (fm.draft === true || fm.publish === false || fm.unlisted === true) continue
    if (!["author", "contributor"].includes(String(fm.type ?? "").toLowerCase())) continue
    for (const name of [fm.title, ...(Array.isArray(fm.aliases) ? fm.aliases : [])]) {
      const key = authorKey(name)
      if (key) authorProfiles.set(key, rel)
    }
  }

  for (const file of files) {
    if (path.resolve(file) === path.resolve(indexFile)) continue

    const rel = path.relative(CONTENT_ROOT, file).replace(/\\/g, "/")
    const text = await fs.readFile(file, "utf8")
    const fm = parseFrontmatter(text)
    const type = String(fm.type ?? "")
      .trim()
      .toLowerCase()

    if (!isPublicEditorial(fm, isPublication(fm.site_publication, publication))) continue

    items.push({
      rel,
      title: titleFromFrontmatter(fm, rel),
      campaign: campaignFromRel(rel, publication),
      type: typeLabel(type, fm.format),
      author: normalizeAuthor(fm.author ?? fm.correspondent ?? fm.editorial_author ?? ""),
      authorProfileRel: authorProfiles.get(authorKey(fm.author ?? fm.correspondent ?? fm.editorial_author ?? "")) || "",
      description:
        cleanDescription(fm.card_description ?? fm.description ?? fm.summary ?? fm.excerpt) ||
        descriptionFromBody(text),
      date:
        parseDisplayDate(fm.article_release_date ?? fm.created ?? fm.date ?? fm.session_date) ??
        gitCreatedDate(rel),
    })
  }

  items.sort((a, b) => {
    const aTime = a.date?.valueOf() ?? 0
    const bTime = b.date?.valueOf() ?? 0
    return bTime - aTime || a.title.localeCompare(b.title)
  })

  indexText = replaceMarkedBlock(indexText, START, END, [START, renderReadingRoom(items, publication.indexRel, publication.name), END].join("\n"))
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
