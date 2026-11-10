import path from "node:path"

const EDITORIAL_TYPES = new Set(["article", "vignette", "session-note", "session-report", "chronicle", "news-article", "story", "oral-history", "journal", "journal-entry", "report", "dispatch", "campaign-history"])

export function isPublicEditorial(fm, publicationMatch) {
  const type = String(fm.type ?? "").trim().toLowerCase()
  return publicationMatch && EDITORIAL_TYPES.has(type) && fm.spoiler === false &&
    fm.draft !== true && fm.publish !== false && fm.unlisted !== true && fm.hidden !== true &&
    String(fm.visibility ?? "").toLowerCase() !== "hidden"
}

export function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll("\'", "&#39;")
}

export function parseDisplayDate(value) {
  if (!value) return null
  if (value instanceof Date) return Number.isNaN(value.valueOf()) ? null : value
  if (typeof value !== "string") return null
  const source = value.trim()
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(source) ? source + "T12:00:00Z" : source
  const date = new Date(iso)
  return Number.isNaN(date.valueOf()) ? null : date
}

export function formatDisplayDate(date) {
  return new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "America/New_York" }).format(date)
}

export function dateParts(date) {
  if (!date) return { year: "", iso: "", label: "" }
  return { year: String(date.getUTCFullYear()), iso: date.toISOString().slice(0, 10), label: formatDisplayDate(date) }
}

export function normalizeAuthor(value) {
  let raw = String(value ?? "").trim()
  const link = /^\[\[([^\]]+)\]\]$/.exec(raw)
  if (link) {
    const [target, label] = link[1].split("|", 2)
    raw = label?.trim() || path.posix.basename(target.trim()).replace(/\.md$/i, "")
  }
  return raw.trim()
}

export function authorKey(value) {
  return normalizeAuthor(value).toLocaleLowerCase("en-US").replace(/\s+/g, " ")
}

export function typeLabel(type, format) {
  const fmt = String(format ?? "").toLowerCase().trim()
  if (fmt === "oral-history") return "Oral History"
  if (fmt === "news-article") return "News Article"
  if (fmt === "chronicle") return "Chronicle"
  const raw = String(type ?? "")
  if (raw.toLowerCase() === "session-note" || raw.toLowerCase() === "session-report") return "Session Report"
  return raw.split(/[-_]+/).filter(Boolean).map((word) => word[0].toUpperCase() + word.slice(1)).join(" ")
}

export function relativeStoryHref(rel, indexRel) {
  const target = rel.replace(/\.md$/i, "")
  const indexDir = path.posix.dirname(indexRel)
  let relative = path.posix.relative(indexDir, target)
  if (!relative.startsWith(".")) relative = "./" + relative
  return relative.split("/").map((segment) => segment === "." || segment === ".." ? segment : encodeURIComponent(segment)).join("/")
}

export function renderReadingRoom(items, indexRel, publicationName) {
  const lines = [
    '<section class="editorial-reading-room" aria-label="Browse editorial articles" data-publication="' + escapeHtml(publicationName) + '">',
    '<div class="editorial-reading-room__intro"><p class="editorial-reading-room__eyebrow">The Reading Room</p>',
    '<p>Browse independently published, spoiler-free stories from the archive. Campaign reports with spoilers stay in their protected campaign collections.</p></div>',
    '<div class="editorial-reading-room__filters" role="search" aria-label="Filter articles">',
    '<label><span>Search stories</span><input type="search" class="editorial-reading-room__query" placeholder="Search headlines and descriptions…"></label>',
    '<label><span>Campaign</span><select class="editorial-reading-room__campaign"><option value="">All campaigns</option></select></label>',
    '<label><span>Author</span><select class="editorial-reading-room__author"><option value="">All authors</option></select></label>',
    '<label><span>Type</span><select class="editorial-reading-room__type"><option value="">All types</option></select></label>',
    '<label><span>Year added</span><select class="editorial-reading-room__year"><option value="">All years</option></select></label>',
    '<button type="button" class="editorial-reading-room__reset">Clear filters</button>',
    '</div>',
    '<p class="editorial-reading-room__status" role="status" aria-live="polite">' + items.length + ' public ' + (items.length === 1 ? "story" : "stories") + '</p>',
    '<div class="editorial-reading-room__grid">',
  ]

  for (const item of items) {
    const { year, iso, label } = dateParts(item.date)
    const campaign = item.campaign || "Independent"
    const byline = item.author ? (item.authorProfileRel
      ? '<a href="' + escapeHtml(relativeStoryHref(item.authorProfileRel, indexRel)) + '">' + escapeHtml(item.author) + '</a>'
      : escapeHtml(item.author)) : ""
    const href = escapeHtml(relativeStoryHref(item.rel, indexRel))
    const metaLabel = [campaign, item.type].filter(Boolean).join(" · ")
    const search = [item.title, item.description, item.author, item.campaign, item.type].join(" ").toLowerCase()
    lines.push(
      '<article class="editorial-reading-room__card" data-campaign="' + escapeHtml(campaign) + '" data-author="' + escapeHtml(item.author || "") + '" data-type="' + escapeHtml(item.type) + '" data-year="' + escapeHtml(year) + '" data-search="' + escapeHtml(search) + '">',
      '<p class="editorial-reading-room__category">' + escapeHtml(metaLabel) + '</p>',
      '<h3><a href="' + href + '">' + escapeHtml(item.title) + '</a></h3>',
      item.description ? '<p class="editorial-reading-room__summary">' + escapeHtml(item.description) + '</p>' : "",
      '<div class="editorial-reading-room__foot">',
      byline ? '<span class="editorial-reading-room__byline">By ' + byline + '</span>' : '<span class="editorial-reading-room__byline">From the archive</span>',
      iso ? '<time datetime="' + iso + '">' + escapeHtml(label) + '</time>' : "",
      '</div>',
      '<a class="editorial-reading-room__read" href="' + href + '">Read story <span aria-hidden="true">→</span></a>',
      '</article>',
    )
  }

  lines.push(
    '</div>',
    '<p class="editorial-reading-room__empty" hidden>No articles match those filters. Try another author, campaign, or year.</p>',
    '<p class="editorial-reading-room__notice">Looking for the complete campaign record? Visit the <a href="../campaigns/">campaign directory</a> to browse spoiler-protected stories.</p>',
    '</section>',
  )
  return lines.join("\n")
}
