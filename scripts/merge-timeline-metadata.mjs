import { promises as fs } from "node:fs"
import path from "node:path"
import { simplifySlug, slugifyFilePath } from "@quartz-community/utils"
import YAML from "yaml"

const CONTENT_ROOT = path.resolve(process.argv[2] ?? "content")
const STATIC_OUTPUT = path.resolve("quartz/static/golarion-events.json")
const PUBLIC_OUTPUT = path.resolve("public/static/golarion-events.json")
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
const MONTH_LENGTHS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

function relative(file) {
  return path.relative(CONTENT_ROOT, file).replace(/\\/g, "/")
}

function sourceSlug(file) {
  const rel = relative(file).replace(/\.md$/i, "")
  return simplifySlug(slugifyFilePath(`${rel}.md`))
}

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    if (entry.name === ".git" || entry.name === ".obsidian") continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) files.push(...(await walk(full)))
    else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) files.push(full)
  }
  return files
}

function parseFrontmatter(text) {
  const match = /^---\s*\n([\s\S]*?)\n---/.exec(text)
  if (!match) return {}
  try {
    return YAML.parse(match[1]) ?? {}
  } catch {
    return {}
  }
}

function campaignFromFile(file) {
  const match = /^Campaigns\/([^/]+)\//.exec(relative(file))
  return match?.[1] ?? null
}

function isLeapYear(year) {
  return year % 8 === 0
}

function monthLength(year, month) {
  return month === 1 && isLeapYear(year) ? 29 : MONTH_LENGTHS[month]
}

function parseTimelineDate(value) {
  const text = String(value ?? "").trim()
  const match = /^(\-?\d+)(?:-([A-Za-z]+)(?:-(\d{1,2}))?)?$/.exec(text)
  if (!match) return null

  const year = Number(match[1])
  if (!Number.isInteger(year)) return null
  if (!match[2]) return { year, datePrecision: "year" }

  const month = MONTHS.indexOf(match[2])
  if (month < 0) return null
  const monthPoint = { year, month, monthName: MONTHS[month], datePrecision: "month" }
  if (!match[3]) return monthPoint

  const day = Number(match[3])
  if (!Number.isInteger(day) || day < 1 || day > monthLength(year, month)) return null
  return { ...monthPoint, day, datePrecision: "day" }
}

function serialFloor(point) {
  const month = Number.isInteger(point.month) ? point.month : 0
  const day = Number.isInteger(point.day) ? point.day : 1
  let total = (point.year - 1) * 365 + Math.floor((point.year - 1) / 8)
  for (let index = 0; index < month; index += 1) total += monthLength(point.year, index)
  return total + day - 1
}

function cleanWikiText(value) {
  return String(value ?? "")
    .replace(/!?\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2")
    .replace(/!?\[\[([^\]]+)\]\]/g, (_, target) => target.split("/").pop().split("#")[0])
    .replace(/\*\*/g, "")
    .trim()
}

function normalizedName(value) {
  return cleanWikiText(value).toLocaleLowerCase().replace(/\s+/g, " ")
}

function pointIdentity(point) {
  if (!point) return ""
  return [
    point.datePrecision || (Number.isInteger(point.day) ? "day" : Number.isInteger(point.month) ? "month" : "year"),
    point.year,
    point.month ?? "",
    point.day ?? "",
  ].join(":")
}

function eventIdentity(event) {
  const range = (event.isMultiDay || event.isRange) && event.rangeStart && event.rangeEnd
  const start = range
    ? event.rangeStart
    : {
        year: event.year,
        month: event.month,
        day: event.day,
        datePrecision: event.datePrecision,
      }
  const end = range ? event.rangeEnd : start
  return [
    event.campaign || "",
    normalizedName(event.name),
    pointIdentity(start),
    pointIdentity(end),
  ].join("|")
}

function resolveFirstLink(file, links) {
  const match = /\[\[([^\]]+)\]\]/.exec(String(links ?? ""))
  if (!match) return null
  let target = match[1].split("|")[0].split("#")[0].trim()
  if (!target) return null
  const resolved = target.startsWith(".")
    ? path.resolve(path.dirname(file), target)
    : path.resolve(CONTENT_ROOT, target)
  return sourceSlug(resolved)
}

function metadataFields(block) {
  const fields = { timelineMetadata: true }
  if (block.importance) fields.importance = cleanWikiText(block.importance)
  if (block.label) fields.timelineLabel = cleanWikiText(block.label)
  if (block.date_label) fields.dateLabel = cleanWikiText(block.date_label)
  if (block.links) fields.timelineLinks = String(block.links)
  return fields
}

const files = await walk(CONTENT_ROOT)
const timelineFiles = []
for (const file of files) {
  const text = await fs.readFile(file, "utf8")
  const fm = parseFrontmatter(text)
  if (fm.type === "timeline-metadata" || /<!--\s*timeline-event\b/i.test(text)) {
    timelineFiles.push({ file, text, fm })
  }
}

const payload = JSON.parse(await fs.readFile(PUBLIC_OUTPUT, "utf8"))
const known = new Set((payload.events ?? []).map(eventIdentity))
const additions = []
const counts = new Map()
let rejected = 0

for (const { file, text, fm } of timelineFiles) {
  const campaign = String(fm.campaign || campaignFromFile(file) || "").trim()
  if (!campaign) continue

  const blockRe = /<!--\s*timeline-event\s*\n([\s\S]*?)-->/gi
  let match
  while ((match = blockRe.exec(text)) !== null) {
    let block
    try {
      block = YAML.parse(match[1]) ?? {}
    } catch (error) {
      rejected += 1
      console.warn(`Could not parse timeline event in ${relative(file)}: ${error.message}`)
      continue
    }

    const point = block.date ? parseTimelineDate(block.date) : null
    const start = block.start ? parseTimelineDate(block.start) : point
    const end = block.end ? parseTimelineDate(block.end) : point
    if (!start || !end || serialFloor(end) < serialFloor(start)) {
      rejected += 1
      console.warn(
        `Could not parse timeline date in ${relative(file)} for ${JSON.stringify(block.title || "Untitled event")}`,
      )
      continue
    }

    const name = cleanWikiText(block.calendar_event_name || block.title || "Untitled timeline event")
    const description = cleanWikiText(block.summary || "")
    const category = cleanWikiText(block.calendar_category || "Campaign Timeline")
    const source = resolveFirstLink(file, block.links)
    const isRange = point === null || pointIdentity(start) !== pointIdentity(end)

    const event = {
      ...start,
      name,
      description,
      category,
      campaign,
      kind: "campaign-event",
      source,
      ...metadataFields(block),
      ...(isRange ? { isRange: true, rangeStart: start, rangeEnd: end } : {}),
    }

    const identity = eventIdentity(event)
    if (known.has(identity)) continue
    known.add(identity)
    additions.push(event)
    counts.set(campaign, (counts.get(campaign) ?? 0) + 1)
  }
}

payload.events = [...(payload.events ?? []), ...additions].sort(
  (a, b) =>
    a.year - b.year ||
    (a.month ?? -1) - (b.month ?? -1) ||
    (a.day ?? -1) - (b.day ?? -1) ||
    String(a.name || "").localeCompare(String(b.name || "")),
)

const output = JSON.stringify(payload, null, 2) + "\n"
for (const target of [STATIC_OUTPUT, PUBLIC_OUTPUT]) {
  await fs.mkdir(path.dirname(target), { recursive: true })
  await fs.writeFile(target, output, "utf8")
}

console.log(`Merged ${additions.length} timeline metadata record(s); rejected ${rejected}.`)
for (const [campaign, count] of [...counts.entries()].sort(([a], [b]) => a.localeCompare(b))) {
  console.log(`- ${campaign}: ${count}`)
}
