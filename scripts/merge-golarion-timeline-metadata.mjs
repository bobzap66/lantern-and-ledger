import { promises as fs } from "node:fs"
import path from "node:path"
import { simplifySlug, slugifyFilePath } from "@quartz-community/utils"

const CONTENT_ROOT = path.resolve(process.argv[2] ?? "content")
const STATIC_OUTPUT = path.resolve("quartz/static/golarion-events.json")
const PUBLIC_OUTPUT = path.resolve("public/static/golarion-events.json")
const CAMPAIGNS_ROOT = path.join(CONTENT_ROOT, "Campaigns")
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

async function walk(dir) {
  const files = []
  let entries = []
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch {
    return files
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) files.push(...(await walk(full)))
    else if (entry.isFile() && entry.name === "Timeline Metadata.md") files.push(full)
  }
  return files
}

function isLeapYear(year) {
  return year % 8 === 0
}

function monthLength(year, month) {
  return month === 1 && isLeapYear(year) ? 29 : MONTH_LENGTHS[month]
}

function parseFlexibleDate(value) {
  const text = String(value ?? "").trim()
  let match = /^(\-?\d+)$/.exec(text)
  if (match) return { year: Number(match[1]), datePrecision: "year" }

  match = /^(\-?\d+)-([A-Za-z]+)$/.exec(text)
  if (match) {
    const year = Number(match[1])
    const month = MONTHS.indexOf(match[2])
    if (!Number.isInteger(year) || month < 0) return null
    return { year, month, monthName: MONTHS[month], datePrecision: "month" }
  }

  match = /^(\-?\d+)-([A-Za-z]+)-(\d{1,2})$/.exec(text)
  if (!match) return null
  const year = Number(match[1])
  const month = MONTHS.indexOf(match[2])
  const day = Number(match[3])
  if (
    !Number.isInteger(year) ||
    month < 0 ||
    !Number.isInteger(day) ||
    day < 1 ||
    day > monthLength(year, month)
  )
    return null
  return { year, month, monthName: MONTHS[month], day, datePrecision: "day" }
}

function parseBlock(body) {
  const fields = {}
  for (const rawLine of body.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line) continue
    const separator = line.indexOf(":")
    if (separator <= 0) continue
    const key = line.slice(0, separator).trim()
    let value = line.slice(separator + 1).trim()
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    )
      value = value.slice(1, -1)
    fields[key] = value
  }
  return fields
}

function stripWikiLinks(value) {
  return String(value ?? "")
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2")
    .replace(/\[\[([^\]]+)\]\]/g, (_, target) => target.split("/").pop())
    .replace(/\*\*/g, "")
    .trim()
}

function normalizedName(value) {
  return stripWikiLinks(value).toLocaleLowerCase().replace(/\s+/g, " ").trim()
}

function pointKey(point) {
  if (!point) return ""
  return [point.datePrecision || "day", point.year, point.month ?? "", point.day ?? ""].join(":")
}

function eventKey(event) {
  const start = event.rangeStart || {
    year: event.year,
    month: event.month,
    day: event.day,
    datePrecision: event.datePrecision || "day",
  }
  const end = event.rangeEnd || null
  return [event.campaign || "", normalizedName(event.name), pointKey(start), pointKey(end)].join("|")
}

function formatPoint(point) {
  if (point.datePrecision === "year" || !Number.isInteger(point.month)) return `${point.year} AR`
  if (point.datePrecision === "month" || !Number.isInteger(point.day))
    return `${MONTHS[point.month]} ${point.year} AR`
  return `${MONTHS[point.month]} ${point.day}, ${point.year} AR`
}

function formatRange(start, end) {
  if (!end) return formatPoint(start)
  if (
    start.datePrecision === "day" &&
    end.datePrecision === "day" &&
    start.year === end.year &&
    start.month === end.month
  )
    return `${MONTHS[start.month]} ${start.day}–${end.day}, ${start.year} AR`
  if (
    start.datePrecision === "month" &&
    end.datePrecision === "month" &&
    start.year === end.year
  )
    return `${MONTHS[start.month]}–${MONTHS[end.month]} ${start.year} AR`
  return `${formatPoint(start)}–${formatPoint(end)}`
}

function sourceSlug(file) {
  const rel = path.relative(CONTENT_ROOT, file).replace(/\\/g, "/").replace(/\.md$/i, "")
  return simplifySlug(slugifyFilePath(`${rel}.md`))
}

function linkedSource(metadataFile, links) {
  const match = /\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]/.exec(String(links ?? ""))
  if (!match) return null
  const target = match[1].trim()
  const absolute = path.resolve(path.dirname(metadataFile), target)
  return sourceSlug(absolute)
}

function defaultCampaignSource(metadataFile, campaign) {
  const campaignDir = path.dirname(metadataFile)
  return sourceSlug(path.join(campaignDir, `${campaign}.md`))
}

function toTimelineEvent(fields, metadataFile, campaign, campaignSource) {
  const start = parseFlexibleDate(fields.start || fields.date)
  const end = fields.end ? parseFlexibleDate(fields.end) : null
  if (!start) return { error: `unrecognized start/date: ${fields.start || fields.date || "(missing)"}` }
  if (fields.end && !end) return { error: `unrecognized end: ${fields.end}` }

  const title = stripWikiLinks(fields.calendar_event_name || fields.title || "Untitled campaign event")
  const dateLabel = stripWikiLinks(fields.date_label) || formatRange(start, end)
  const source =
    linkedSource(metadataFile, fields.links) ||
    campaignSource ||
    defaultCampaignSource(metadataFile, campaign)

  const event = {
    year: start.year,
    datePrecision: start.datePrecision,
    name: title,
    description: stripWikiLinks(fields.summary || ""),
    category: stripWikiLinks(fields.calendar_category || "Campaign Events"),
    campaign,
    kind: "campaign-event",
    source,
    dateLabel,
    timelineMetadata: true,
    recordType: "milestone",
    ...(fields.importance ? { importance: fields.importance.trim() } : {}),
    ...(fields.label ? { label: stripWikiLinks(fields.label) } : {}),
  }
  if (Number.isInteger(start.month)) {
    event.month = start.month
    event.monthName = MONTHS[start.month]
  }
  if (Number.isInteger(start.day)) event.day = start.day
  if (end) {
    event.isMultiDay = true
    event.rangeStart = start
    event.rangeEnd = end
  }
  return { event }
}

function upgradeToMilestone(existingEvents, milestone) {
  for (const event of existingEvents) {
    event.timelineMetadata = true
    event.recordType = "milestone"
    event.dateLabel = milestone.dateLabel
    if (milestone.description) event.description = milestone.description
    if (milestone.label) event.label = milestone.label
    if (milestone.importance) event.importance = milestone.importance
    if (
      milestone.category &&
      (!event.category ||
        event.category === "Campaign Events" ||
        event.category === "Miscellaneous Events" ||
        event.category === "Session Reports")
    )
      event.category = milestone.category
    if (!event.source && milestone.source) event.source = milestone.source
  }
}

const timelineFiles = await walk(CAMPAIGNS_ROOT)
const payload = JSON.parse(await fs.readFile(STATIC_OUTPUT, "utf8"))
const campaignSources = new Map(
  (payload.campaigns ?? []).map((campaign) => [campaign.id, campaign.source]).filter(([, source]) => source),
)
const existingByKey = new Map()
for (const event of payload.events ?? []) {
  if (event.kind !== "campaign-event") continue
  const key = eventKey(event)
  if (!existingByKey.has(key)) existingByKey.set(key, [])
  existingByKey.get(key).push(event)
}

const addedCounts = new Map()
const upgradedCounts = new Map()
const warnings = []
let added = 0
let upgraded = 0

for (const file of timelineFiles) {
  const text = await fs.readFile(file, "utf8")
  const rel = path.relative(CAMPAIGNS_ROOT, file).replace(/\\/g, "/")
  const campaign = rel.split("/")[0]
  const blockRe = /<!--\s*timeline-event\s*([\s\S]*?)-->/gi
  let match
  let blockNumber = 0
  while ((match = blockRe.exec(text)) !== null) {
    blockNumber += 1
    const fields = parseBlock(match[1])
    const parsed = toTimelineEvent(fields, file, campaign, campaignSources.get(campaign))
    if (parsed.error) {
      warnings.push(`${rel} block ${blockNumber}: ${parsed.error}`)
      continue
    }

    const key = eventKey(parsed.event)
    const existing = existingByKey.get(key)
    if (existing?.length) {
      upgradeToMilestone(existing, parsed.event)
      upgraded += 1
      upgradedCounts.set(campaign, (upgradedCounts.get(campaign) || 0) + 1)
      continue
    }

    payload.events.push(parsed.event)
    existingByKey.set(key, [parsed.event])
    addedCounts.set(campaign, (addedCounts.get(campaign) || 0) + 1)
    added += 1
  }
}

payload.events.sort(
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

console.log(
  `Merged ${added} new campaign timeline metadata records and upgraded ${upgraded} existing event definitions to milestones.`,
)
const campaigns = new Set([...addedCounts.keys(), ...upgradedCounts.keys()])
for (const campaign of [...campaigns].sort((a, b) => a.localeCompare(b))) {
  console.log(
    `  ${campaign}: +${addedCounts.get(campaign) || 0} new; ${upgradedCounts.get(campaign) || 0} upgraded`,
  )
}
if (warnings.length) {
  console.warn(`Skipped ${warnings.length} timeline metadata blocks:`)
  for (const warning of warnings) console.warn(`  ${warning}`)
}
