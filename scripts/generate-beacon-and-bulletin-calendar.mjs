import { promises as fs } from "node:fs"
import path from "node:path"
import YAML from "yaml"
import prettier from "prettier"
import { simplifySlug, slugifyFilePath } from "@quartz-community/utils"

const CONTENT_ROOT = path.resolve(process.argv[2] ?? "content")
const OUTPUT_ROOT = path.resolve(process.argv[3] ?? "public")
const CAMPAIGNS_ROOT = path.join(CONTENT_ROOT, "Campaigns")
const CALENDAR_NAME = "Calendar of Pact Worlds"
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
const WEEKDAYS = [
  "Firstday",
  "Seconday",
  "Thirday",
  "Fourthday",
  "Fifthday",
  "Sixthday",
  "Seventhday",
]
const STATIC_OUTPUT = path.resolve("quartz/static/beacon-and-bulletin-calendar.json")
const PUBLIC_OUTPUT = path.join(OUTPUT_ROOT, "static", "beacon-and-bulletin-calendar.json")
const HISTORY_SOURCE = path.resolve("quartz/static/beacon-and-bulletin-events.json")
const HOLIDAY_SOURCE = path.join(
  CONTENT_ROOT,
  "Meta",
  "Timeline Sources",
  "Beacon and Bulletin",
  "beacon-and-bulletin-holidays.json",
)

async function walk(dir) {
  const out = []
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    if (entry.name === ".git" || entry.name === ".obsidian") continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...(await walk(full)))
    else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) out.push(full)
  }
  return out
}

function parseFrontmatter(text, file) {
  const match = /^---\s*\r?\n([\s\S]*?)\r?\n---/.exec(text)
  if (!match) return {}
  try {
    return YAML.parse(match[1]) ?? {}
  } catch (error) {
    throw new Error(`Invalid frontmatter in ${file}: ${error.message}`)
  }
}

function parseDate(value, label) {
  const match = /^(\d+)-([A-Za-z]+|\d{1,2})-(\d{1,2})$/.exec(String(value ?? "").trim())
  if (!match)
    throw new Error(
      `${label}: expected Pact date YEAR-MONTH-DAY, received ${JSON.stringify(value)}`,
    )
  const year = Number(match[1])
  const month = /^\d+$/.test(match[2])
    ? Number(match[2]) - 1
    : MONTHS.findIndex((monthName) => monthName.toLowerCase() === match[2].toLowerCase())
  const day = Number(match[3])
  if (month < 0 || month >= MONTHS.length)
    throw new Error(`${label}: unknown Pact month in ${JSON.stringify(value)}`)
  const maxDay = MONTH_LENGTHS[month] + (month === 1 && year % 4 === 0 ? 1 : 0)
  if (day < 1 || day > maxDay)
    throw new Error(`${label}: day ${day} is invalid for ${MONTHS[month]} ${year} AG`)
  return { year, month, monthName: MONTHS[month], day }
}

function sourceSlug(file) {
  const rel = path.relative(CONTENT_ROOT, file).replace(/\\/g, "/").replace(/\.md$/i, "")
  return simplifySlug(slugifyFilePath(`${rel}.md`))
}

function parseKeyValueLines(text) {
  const values = {}
  for (const line of text.split(/\r?\n/)) {
    const match = /^([A-Za-z0-9 _-]+):\s*(.*?)\s*$/.exec(line)
    if (!match) continue
    values[match[1].trim().toLowerCase().replaceAll(" ", "_")] = match[2]
      .trim()
      .replace(/^['"]|['"]$/g, "")
  }
  return values
}

function labelFor(date) {
  return `${date.day} ${date.monthName} ${date.year} AG`
}

async function loadCampaignsAndEvents() {
  const files = await walk(CAMPAIGNS_ROOT)
  const indexFiles = files.filter((file) => path.basename(file).toLowerCase() === "index.md")
  const campaigns = []
  const events = []
  const eventKeys = new Set()

  for (const file of indexFiles) {
    const relative = path.relative(CONTENT_ROOT, file).replace(/\\/g, "/")
    const match = /^Campaigns\/([^/]+)\/index\.md$/i.exec(relative)
    if (!match) continue
    const text = await fs.readFile(file, "utf8")
    const metadata = parseFrontmatter(text, file)
    const publication = String(metadata.site_publication ?? "")
      .trim()
      .toLowerCase()
    if (
      metadata.type !== "campaign" ||
      publication !== "beacon & bulletin" ||
      metadata.calendar !== CALENDAR_NAME
    )
      continue

    const id = match[1]
    const campaign = {
      id,
      name: metadata.title || id,
      status: metadata.status || "active",
      currentDate: metadata.current_date
        ? parseDate(metadata.current_date, `${file} current_date`)
        : null,
      source: sourceSlug(file),
    }
    campaigns.push(campaign)

    const campaignRoot = path.dirname(file)
    const campaignFiles = files.filter((candidate) =>
      candidate.startsWith(`${campaignRoot}${path.sep}`),
    )
    for (const sourceFile of campaignFiles) {
      const sourceText = await fs.readFile(sourceFile, "utf8")
      const sourceMetadata = parseFrontmatter(sourceText, sourceFile)
      if (sourceMetadata.draft === true || sourceMetadata.publish === false) continue

      const candidates = []
      const inlineDate =
        sourceMetadata.event_date ||
        sourceMetadata.campaign_date ||
        sourceMetadata.event_start ||
        sourceMetadata.campaign_date_start
      if (inlineDate) {
        candidates.push({
          date: inlineDate,
          endDate: sourceMetadata.event_end || sourceMetadata.campaign_date_end || inlineDate,
          title:
            sourceMetadata.calendar_event_name ||
            sourceMetadata.title ||
            path.basename(sourceFile, ".md"),
          description: sourceMetadata.calendar_description || sourceMetadata.summary || "",
        })
      }

      const commentPattern = /<!--\s*timeline-event\s*\r?\n([\s\S]*?)\r?\n\s*-->/gi
      for (const comment of sourceText.matchAll(commentPattern)) {
        const event = parseKeyValueLines(comment[1])
        if (event.date && event.title) {
          candidates.push({
            date: event.date,
            endDate: event.end || event.date,
            title: event.calendar_event_name || event.title,
            description: event.calendar_description || event.summary || "",
          })
        }
      }

      for (const candidate of candidates) {
        const start = parseDate(candidate.date, `${sourceFile} event date`)
        const end = parseDate(candidate.endDate, `${sourceFile} event end date`)
        const key = `${id}|${start.year}|${start.month}|${start.day}|${candidate.title.toLowerCase()}`
        if (eventKeys.has(key)) continue
        eventKeys.add(key)
        events.push({
          ...start,
          datePrecision: "day",
          dateLabel: labelFor(start),
          name: candidate.title,
          description: candidate.description,
          campaign: id,
          kind: "campaign-event",
          visibility: "campaign-only",
          source: sourceSlug(sourceFile),
          ...(end.year !== start.year || end.month !== start.month || end.day !== start.day
            ? { isMultiDay: true, rangeStart: start, rangeEnd: end }
            : {}),
        })
      }
    }
  }

  if (campaigns.length === 0)
    throw new Error(`No ${CALENDAR_NAME} Beacon & Bulletin campaigns found under ${CAMPAIGNS_ROOT}`)
  campaigns.sort((a, b) => a.name.localeCompare(b.name))
  events.sort(
    (a, b) => a.year - b.year || a.month - b.month || a.day - b.day || a.name.localeCompare(b.name),
  )
  return { campaigns, events }
}

const { campaigns, events } = await loadCampaignsAndEvents()
const history = JSON.parse(await fs.readFile(HISTORY_SOURCE, "utf8"))
if (!Array.isArray(history.events))
  throw new Error(`Timeline history source has no events array: ${HISTORY_SOURCE}`)
const historicalEvents = history.events.map((event, index) => {
  if (!event.id || !Number.isInteger(event.sortOrder) || !event.title)
    throw new Error(`Invalid Pact history event at ${HISTORY_SOURCE} events[${index}]`)
  return {
    id: event.id,
    year: event.sortOrder,
    datePrecision: "year",
    dateLabel: event.dateLabel,
    name: event.title,
    description: event.description ?? "",
    kind: "historical",
    visibility: "public",
    verification: event.verification,
    citation: event.citation,
    source: "beacon-and-bulletin/timeline",
  }
})
const holidayData = JSON.parse(await fs.readFile(HOLIDAY_SOURCE, "utf8"))
if (!Array.isArray(holidayData.events))
  throw new Error(`Pact observance source has no events array: ${HOLIDAY_SOURCE}`)
const mod = (value, divisor) => ((value % divisor) + divisor) % divisor
const weekdayAt = (year, month, day) => {
  const anchor = { year: 325, weekday: 2 }
  const leapDays = Math.floor((year - 1) / 4) - Math.floor((anchor.year - 1) / 4)
  let days = (year - anchor.year) * 365 + leapDays + day - 1
  for (let index = 0; index < month; index += 1)
    days += MONTH_LENGTHS[index] + (index === 1 && year % 4 === 0 ? 1 : 0)
  return mod(anchor.weekday + days, WEEKDAYS.length)
}
const holidayEvents = holidayData.events.map((holiday, index) => {
  if (
    !holiday.id ||
    !holiday.name ||
    !Number.isInteger(holiday.month) ||
    holiday.month < 0 ||
    holiday.month >= 12
  )
    throw new Error(`Invalid Pact observance at ${HOLIDAY_SOURCE} events[${index}]`)
  let day = holiday.day
  if (holiday.datePrecision === "weekday-rule") {
    if (!Number.isInteger(holiday.weekday) || !["last"].includes(holiday.occurrence))
      throw new Error(`Unsupported weekday rule for ${holiday.name} in ${HOLIDAY_SOURCE}`)
    const year = 325
    day = MONTH_LENGTHS[holiday.month] + (holiday.month === 1 && year % 4 === 0 ? 1 : 0)
    while (weekdayAt(year, holiday.month, day) !== holiday.weekday) day -= 1
  }
  if (
    holiday.datePrecision === "day" &&
    (!Number.isInteger(day) || day < 1 || day > MONTH_LENGTHS[holiday.month])
  )
    throw new Error(`Invalid fixed date for ${holiday.name} in ${HOLIDAY_SOURCE}`)
  return {
    id: holiday.id,
    ...(Number.isInteger(holiday.year) ? { year: holiday.year } : {}),
    month: holiday.month,
    monthName: MONTHS[holiday.month],
    ...(Number.isInteger(day) ? { day } : {}),
    datePrecision: holiday.datePrecision,
    ...(holiday.durationDays ? { durationDays: holiday.durationDays } : {}),
    name: holiday.name,
    description: holiday.description ?? "",
    kind: "holiday",
    visibility: "public",
    recurrence: holiday.recurrence ?? (Number.isInteger(holiday.year) ? undefined : "yearly"),
    citation: holidayData.citation,
    source: "beacon-and-bulletin/calendar",
  }
})
const formatJson = (value) =>
  prettier.format(`${JSON.stringify(value, null, 2)}\n`, { parser: "json" })
await fs.writeFile(
  path.resolve("quartz/static/beacon-and-bulletin-holidays.json"),
  await formatJson(holidayData),
  "utf8",
)
const payload = {
  calendar: CALENDAR_NAME,
  months: MONTHS,
  monthLengths: MONTH_LENGTHS,
  weekdays: WEEKDAYS,
  leapRule: { interval: 4, month: 1 },
  weekdayAnchor: { year: 325, month: 0, day: 1, weekday: 2 },
  campaigns,
  events: [...historicalEvents, ...holidayEvents, ...events].sort(
    (a, b) =>
      a.year - b.year ||
      (a.month ?? -1) - (b.month ?? -1) ||
      (a.day ?? -1) - (b.day ?? -1) ||
      a.name.localeCompare(b.name),
  ),
}
const output = await formatJson(payload)
for (const target of [STATIC_OUTPUT, PUBLIC_OUTPUT]) {
  await fs.mkdir(path.dirname(target), { recursive: true })
  await fs.writeFile(target, output, "utf8")
}
console.log(
  `Generated Pact calendar data for ${campaigns.length} Beacon & Bulletin campaigns and ${events.length} campaign events`,
)
