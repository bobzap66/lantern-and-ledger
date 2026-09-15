import { promises as fs } from "node:fs"
import path from "node:path"
import YAML from "yaml"

const CONTENT_ROOT = path.resolve(process.argv[2] ?? "content")
const GENERATED_DATA = path.resolve(process.argv[3] ?? "public/static/golarion-events.json")
const CALENDAR_NAME = "Calendar of Golarion"
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
const DATE_FIELDS = [
  "event_start",
  "event_end",
  "campaign_date_start",
  "campaign_date_end",
  "event_date",
  "campaign_date",
]
const DATE_FIELD_RE = new RegExp(`^(?:${DATE_FIELDS.join("|")})\\s*:`, "m")

function relative(file) {
  return path.relative(CONTENT_ROOT, file).replace(/\\/g, "/")
}

function campaignFromFile(file) {
  const match = /^Campaigns\/([^/]+)\//.exec(relative(file))
  return match?.[1] ?? null
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

function frontmatterBlock(text) {
  return /^---\s*\n([\s\S]*?)\n---/.exec(text)?.[1] ?? null
}

function isLeapYear(year) {
  return year % 8 === 0
}

function monthLength(year, month) {
  return month === 1 && isLeapYear(year) ? 29 : MONTH_LENGTHS[month]
}

function parseDate(value) {
  const match = /^(\-?\d+)-([A-Za-z]+)-(\d{1,2})$/.exec(String(value ?? ""))
  if (!match) return null
  const year = Number(match[1])
  const month = MONTHS.indexOf(match[2])
  const day = Number(match[3])
  if (
    month < 0 ||
    !Number.isInteger(year) ||
    !Number.isInteger(day) ||
    day < 1 ||
    day > monthLength(year, month)
  )
    return null
  return { year, month, day }
}

function increment(map, key, amount = 1) {
  map.set(key, (map.get(key) ?? 0) + amount)
}

const files = await walk(CONTENT_ROOT)
const campaignDirectories = new Set()
const datedFrontmatterFiles = new Map()
const inlineCalendarFiles = new Map()
const parseFailures = []
const dateParseFailures = []

for (const file of files) {
  const campaign = campaignFromFile(file)
  if (!campaign) continue
  campaignDirectories.add(campaign)

  const text = await fs.readFile(file, "utf8")
  if (text.includes(`data-calendar="${CALENDAR_NAME}"`) || text.includes(`data-calendar='${CALENDAR_NAME}'`)) {
    increment(inlineCalendarFiles, campaign)
  }

  const rawFrontmatter = frontmatterBlock(text)
  if (rawFrontmatter === null) continue

  let fm
  try {
    fm = YAML.parse(rawFrontmatter) ?? {}
  } catch (error) {
    parseFailures.push({
      file: relative(file),
      message: error.message,
      hasCampaignDateField: DATE_FIELD_RE.test(rawFrontmatter),
    })
    continue
  }

  const presentDateFields = DATE_FIELDS.filter((field) => fm[field] !== undefined && fm[field] !== null && fm[field] !== "")
  if (!presentDateFields.length) continue
  increment(datedFrontmatterFiles, campaign)

  for (const field of presentDateFields) {
    if (!parseDate(fm[field])) {
      dateParseFailures.push({ file: relative(file), field, value: String(fm[field]) })
    }
  }
}

const payload = JSON.parse(await fs.readFile(GENERATED_DATA, "utf8"))
const generatedCampaignRows = new Map()
const generatedAllCampaignRows = new Map()
const generatedKinds = new Map()

for (const event of payload.events ?? []) {
  if (!event.campaign) continue
  increment(generatedAllCampaignRows, event.campaign)
  if (event.kind === "campaign-event") increment(generatedCampaignRows, event.campaign)
  const kindKey = `${event.campaign}\u0000${event.kind ?? "unknown"}`
  increment(generatedKinds, kindKey)
}

const registeredCampaignIds = new Set((payload.campaigns ?? []).map((campaign) => campaign.id))
const campaignNames = new Set([
  ...campaignDirectories,
  ...generatedAllCampaignRows.keys(),
  ...registeredCampaignIds,
])

console.log("\nGolarion calendar diagnostics")
console.log("Campaign ingestion by campaign:")
for (const campaign of [...campaignNames].sort((a, b) => a.localeCompare(b))) {
  const kindCounts = [...generatedKinds.entries()]
    .filter(([key]) => key.startsWith(`${campaign}\u0000`))
    .map(([key, count]) => `${key.split("\u0000")[1]}=${count}`)
    .sort()
    .join(", ")
  console.log(
    `- ${campaign}: generated campaign-event rows=${generatedCampaignRows.get(campaign) ?? 0}; ` +
      `all generated rows with campaign=${generatedAllCampaignRows.get(campaign) ?? 0}; ` +
      `dated frontmatter files=${datedFrontmatterFiles.get(campaign) ?? 0}; ` +
      `inline calendar files=${inlineCalendarFiles.get(campaign) ?? 0}; ` +
      `registered campaign=${registeredCampaignIds.has(campaign) ? "yes" : "no"}` +
      (kindCounts ? `; kinds: ${kindCounts}` : ""),
  )
}

const relevantParseFailures = parseFailures.filter((failure) => failure.hasCampaignDateField)
if (relevantParseFailures.length) {
  console.warn("\nFrontmatter YAML failures in files containing campaign date fields:")
  for (const failure of relevantParseFailures) {
    console.warn(`- ${failure.file}: ${failure.message}`)
  }
} else {
  console.log("\nNo frontmatter YAML failures were found in files containing campaign date fields.")
}

if (dateParseFailures.length) {
  console.warn("\nCampaign date fields rejected by the generator's date format:")
  for (const failure of dateParseFailures) {
    console.warn(`- ${failure.file}: ${failure.field}=${JSON.stringify(failure.value)}`)
  }
} else {
  console.log("No campaign date fields were rejected by the generator's date format.")
}

const otherParseFailures = parseFailures.length - relevantParseFailures.length
if (otherParseFailures > 0) {
  console.warn(`${otherParseFailures} additional Markdown file(s) have YAML parse failures but no recognized campaign date fields.`)
}
