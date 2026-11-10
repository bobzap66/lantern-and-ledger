import { promises as fs } from "node:fs"
import path from "node:path"
import YAML from "yaml"

const root = path.resolve(process.argv[2] ?? "content")
const strict = process.argv.includes("--strict")
const publications = [
  { name: "Lantern & Ledger", folder: "Lantern and Ledger" },
  { name: "Beacon & Bulletin", folder: "Beacon and Bulletin" },
]
const warnings = []
const errors = []

function frontmatter(source) {
  const match = /^---\s*\r?\n([\s\S]*?)\r?\n---/.exec(source)
  return match ? YAML.parse(match[1]) ?? {} : {}
}

function report(target, message, fatal = false) {
  const destination = fatal ? errors : warnings
  destination.push({ target, message })
}

function text(value) {
  return String(value ?? "").trim()
}

function cardStatuses(source) {
  const cards = new Map()
  const pattern = /<a class="campaign-directory__link" href="[^"]+"[^>]*><\/a>[\s\S]*?<div class="campaign-directory__status">([^<]+)<\/div>[\s\S]*?<h[34] class="campaign-directory__title">([^<]+)<\/h[34]>/g
  for (const match of source.matchAll(pattern)) {
    if (match[2] !== "Campaign Archive") cards.set(match[2], match[1])
  }
  return cards
}

function statusFromCard(label) {
  if (label === "Coming Soon" || label === "Upcoming") return "upcoming"
  return label?.toLowerCase()
}

async function auditPublication({ name, folder }) {
  const base = path.join(root, folder)
  const directory = path.join(base, "Campaigns")
  const [home, index] = await Promise.all([
    fs.readFile(path.join(base, "index.md"), "utf8"),
    fs.readFile(path.join(directory, "index.md"), "utf8"),
  ])
  const homeCards = cardStatuses(home)
  const directoryCards = cardStatuses(index)
  const entries = await fs.readdir(directory, { withFileTypes: true })
  let count = 0

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const file = path.join(directory, entry.name, "index.md")
    const source = await fs.readFile(file, "utf8").catch(() => null)
    if (!source) continue
    const meta = frontmatter(source)
    if (meta.type !== "campaign") continue
    const rel = path.relative(root, file).replaceAll(path.sep, "/")
    if (meta.publish === false && meta.draft !== true) {
      report(rel, "publish: false alone does not prevent Quartz publication; set draft: true for private content")
    }
    if (meta.draft === true || meta.publish === false) continue
    count++

    const campaignName = text(meta.title) || entry.name
    if (meta.site_publication !== name) {
      report(rel, "Campaign site_publication does not match its publication folder", true)
    }
    if (!["active", "upcoming", "archived"].includes(meta.status)) {
      report(rel, "Campaign status must be active, upcoming, or archived", true)
      continue
    }

    const body = source.replace(/^---\s*\r?\n[\s\S]*?\r?\n---/, "")
    const h1Count = (body.match(/^#\s+\S.*$/gm) ?? []).length
      + (body.match(/<h1\b/gi) ?? []).length
    if (h1Count > 1) report(rel, "Multiple H1 headings on campaign landing page")
    if (h1Count === 0) report(rel, "Campaign landing page is missing a visible H1")
    if (meta.hero_image && !text(meta.hero_alt)) {
      report(rel, "hero_image is set without hero_alt")
    }
    if (meta.directory_image && !text(meta.directory_alt)) {
      report(rel, "directory_image is set without directory_alt")
    }

    if (meta.status === "archived") continue
    for (const [surface, cards] of [["homepage", homeCards], ["campaign directory", directoryCards]]) {
      const displayed = statusFromCard(cards.get(campaignName))
      if (!displayed) report(rel, campaignName + " is absent from the generated " + surface)
      else if (displayed !== meta.status) {
        report(rel, surface + " shows " + displayed + " but source metadata says " + meta.status)
      }
    }
  }
  return count
}

let total = 0
for (const publication of publications) total += await auditPublication(publication)

for (const { target, message } of warnings) {
  console.warn("::warning file=" + target + "::" + message)
}
for (const { target, message } of errors) {
  console.error("::error file=" + target + "::" + message)
}
console.log("Publishing preflight checked " + total + " campaigns: "
  + errors.length + " errors and " + warnings.length + " warnings")
if (errors.length || (strict && warnings.length)) process.exitCode = 1
