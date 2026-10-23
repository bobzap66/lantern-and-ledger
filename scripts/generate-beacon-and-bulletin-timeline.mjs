import { promises as fs } from "node:fs"
import path from "node:path"

const CONTENT_ROOT = path.resolve(process.argv[2] ?? "content")
const MANIFEST = path.join(
  CONTENT_ROOT,
  "Meta/Timeline Sources/Beacon and Bulletin/beacon-and-bulletin-history.json",
)
const STATIC_OUTPUT = path.resolve("quartz/static/beacon-and-bulletin-events.json")
const PUBLIC_OUTPUT = path.resolve("public/static/beacon-and-bulletin-events.json")

async function readJson(file, label) {
  let text
  try {
    text = await fs.readFile(file, "utf8")
  } catch (error) {
    throw new Error(`${label}: could not read ${file}: ${error.message}`)
  }
  try {
    return JSON.parse(text)
  } catch (error) {
    throw new Error(`${label}: invalid JSON in ${file}: ${error.message}`)
  }
}

async function loadEvents() {
  const manifest = await readJson(MANIFEST, "Beacon & Bulletin timeline manifest")
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    throw new Error(`Beacon & Bulletin timeline manifest must be an object: ${MANIFEST}`)
  }
  if (manifest.schemaVersion !== 1) {
    throw new Error(
      `Beacon & Bulletin timeline manifest has unsupported schemaVersion: ${manifest.schemaVersion}`,
    )
  }
  if (!Array.isArray(manifest.parts) || manifest.parts.length === 0) {
    throw new Error(
      `Beacon & Bulletin timeline manifest must contain at least one part: ${MANIFEST}`,
    )
  }

  const events = []
  for (const [partIndex, partName] of manifest.parts.entries()) {
    if (typeof partName !== "string" || !partName.trim()) {
      throw new Error(
        `Beacon & Bulletin timeline manifest part ${partIndex + 1} must be a path string`,
      )
    }
    const partPath = path.resolve(path.dirname(MANIFEST), partName)
    if (path.relative(path.dirname(MANIFEST), partPath).startsWith("..")) {
      throw new Error(
        `Beacon & Bulletin timeline part ${partIndex + 1} escapes the source directory`,
      )
    }
    const part = await readJson(partPath, `Beacon & Bulletin timeline part ${partIndex + 1}`)
    if (!part || typeof part !== "object" || Array.isArray(part) || !Array.isArray(part.events)) {
      throw new Error(
        `Beacon & Bulletin timeline part ${partIndex + 1} must contain an events array`,
      )
    }
    events.push(...part.events)
  }

  if (manifest.eventCount !== events.length) {
    throw new Error(
      `Beacon & Bulletin timeline manifest eventCount is ${manifest.eventCount}, but parts contain ${events.length}`,
    )
  }

  const ids = new Set()
  for (const [index, event] of events.entries()) {
    const label = `Beacon & Bulletin event ${index + 1}`
    if (!event || typeof event !== "object" || Array.isArray(event))
      throw new Error(`${label} must be an object`)
    for (const field of ["id", "title", "dateLabel"]) {
      if (typeof event[field] !== "string" || !event[field].trim())
        throw new Error(`${label} needs a non-empty ${field}`)
    }
    if (!Number.isFinite(event.sortOrder))
      throw new Error(`${label} needs a finite numeric sortOrder`)
    if (ids.has(event.id)) throw new Error(`${label} duplicates id ${JSON.stringify(event.id)}`)
    ids.add(event.id)
    if (event.description !== undefined && typeof event.description !== "string") {
      throw new Error(`${label} description must be a string`)
    }
    if (event.citation !== undefined && typeof event.citation !== "string") {
      throw new Error(`${label} citation must be a string`)
    }
    if (
      event.verification !== undefined &&
      !["official-paizo-source"].includes(event.verification)
    ) {
      throw new Error(
        `${label} has unsupported verification status ${JSON.stringify(event.verification)}`,
      )
    }
    const sources = event.sources ?? (event.source ? [event.source] : [])
    if (
      !Array.isArray(sources) ||
      sources.some((source) => typeof source !== "string" || !source.trim())
    ) {
      throw new Error(`${label} sources must be an array of non-empty strings`)
    }
    if (sources.some((source) => /^\s*javascript:/i.test(source))) {
      throw new Error(`${label} sources cannot use javascript: URLs`)
    }
  }

  return events.sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id))
}

const events = await loadEvents()
const payload = {
  title: "Beacon & Bulletin Timeline",
  description: "Publication-wide Starfinder chronology",
  events,
}
const output = `${JSON.stringify(payload, null, 2)}\n`
for (const target of [STATIC_OUTPUT, PUBLIC_OUTPUT]) {
  await fs.mkdir(path.dirname(target), { recursive: true })
  await fs.writeFile(target, output, "utf8")
}
console.log(`Generated ${events.length} Beacon & Bulletin timeline events`)
