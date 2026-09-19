import fs from "node:fs"
import path from "node:path"
import YAML from "yaml"

const root = path.resolve(process.argv[2] ?? "content")
const write = process.argv.includes("--write")
const check = process.argv.includes("--check")
const listFields = new Set(["player_characters", "npcs", "subjects", "campaign", "groups", "locations", "events", "tags", "sessions", "articles"])
function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name)
    return entry.isDirectory() ? walk(file) : entry.name.endsWith(".md") ? [file] : []
  }).sort()
}
function read(file) {
  const text = fs.readFileSync(file, "utf8")
  const match = /^(\uFEFF?---\r?\n)([\s\S]*?)(\r?\n---(?:\r?\n|$))/.exec(text)
  if (!match) throw new Error(`Missing frontmatter: ${file}`)
  const doc = YAML.parseDocument(match[2])
  if (doc.errors.length) throw new Error(`${file}: ${doc.errors[0].message}`)
  return { text, match, doc, fm: doc.toJS() }
}
function resolveNote(base) {
  return [base, `${base}.md`, path.join(base, "index.md")].find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile())
}
const notes = walk(path.join(root, "Campaigns")).map((file) => ({file, fm: read(file).fm}))
// Explicit, verified moves whose new names differ from the old target.
const moved = new Map(Object.entries({
  "Campaigns/Abomination Vaults/Session Notes/2025-01-08 to 2025-09-22 - On the Reconstruction of the Missing Months": "Campaigns/Abomination Vaults/Chronicles of the New Roseguard/4722-01-05 - On the Reconstruction of an Incomplete Record",
  "Campaigns/Claws of the Tyrant/Articles/What the Road Told Them": "Campaigns/Claws of the Tyrant/Articles/A Doll, A Doe, A Ghost of Sorrow",
  "Campaigns/Kingmaker/NPCs/Hooktongue": "Campaigns/Kingmaker/Reference/Hooktongue",
  "Campaigns/Kingmaker/Vignettes/Intelligence Reports/Thresholders": "Campaigns/Kingmaker/Vignettes/Intelligence Reports/2026-09-14 - The Thresholders",
}))
const pending = [], errors = [], assets = new Map()
let count = 0, repaired = 0, lists = 0
for (const file of walk(path.join(root, "Image Metadata"))) {
  const {text, match, doc, fm} = read(file)
  if (fm.type !== "image") continue
  count++
  const relative = path.relative(root, file).replaceAll("\\", "/")
  const asset = typeof fm.asset === "string" ? path.resolve(root, fm.asset) : ""
  if (!asset.startsWith(root + path.sep) || !fs.existsSync(asset) || !fs.statSync(asset).isFile()) errors.push(`${relative}: invalid asset ${fm.asset}`)
  assets.set(asset, [...(assets.get(asset) ?? []), relative])
  const edits = []
  for (const pair of doc.contents.items) {
    const key = pair.key.value
    if (!listFields.has(key) || pair.value == null) continue
    let changed = false
    const original = fm[key]
    const values = Array.isArray(original) ? original : [original]
    if (!Array.isArray(original)) { changed = true; lists++ }
    const updated = values.map((value) => {
      if (typeof value !== "string") { errors.push(`${relative}: non-string ${key}`); return value }
      const wiki = /^\[\[([^|#\]]+)(#[^|\]]+)?(?:\|([^\]]+))?\]\]$/.exec(value)
      if (!wiki) return value
      const target = path.resolve(wiki[1].startsWith(".") ? path.dirname(file) : root, wiki[1])
      if (resolveNote(target)) return value
      const old = path.relative(root, target).replaceAll("\\", "/")
      let replacement = moved.has(old) ? resolveNote(path.join(root, moved.get(old))) : undefined
      if (!replacement && old.startsWith("Campaigns/Claws of the Tyrant/Characters/")) {
        const candidates = notes.filter((note) => note.file.startsWith(path.join(root, "Campaigns/Claws of the Tyrant/Characters") + path.sep) && path.basename(note.file, ".md") === path.basename(target))
        if (candidates.length === 1) replacement = candidates[0].file
      }
      if (!replacement && old.startsWith("Campaigns/Abomination Vaults/Session Notes/") && wiki[3]) {
        const candidates = notes.filter((note) => note.file.startsWith(path.join(root, "Campaigns/Abomination Vaults/Chronicles of the New Roseguard") + path.sep) && note.fm.title === wiki[3])
        if (candidates.length === 1) replacement = candidates[0].file
      }
      if (!replacement) { errors.push(`${relative}: unresolved ${key}: ${value}`); return value }
      changed = true; repaired++
      const canonical = path.relative(root, replacement).replaceAll("\\", "/").replace(/\.md$/, "")
      return `[[${canonical}${wiki[2] ?? ""}|${wiki[3] ?? path.basename(target)}]]`
    })
    if (changed) {
      const [start, end] = pair.value.range
      const eol = text.includes("\r\n") ? "\r\n" : "\n"
      edits.push({ start, end, value: JSON.stringify(updated) + (match[2].slice(start, end).endsWith("\n") ? eol : "") })
    }
  }
  let fmText = match[2]
  for (const edit of edits.sort((a,b) => b.start - a.start)) fmText = fmText.slice(0, edit.start) + edit.value + fmText.slice(edit.end)
  if (edits.length) {
    YAML.parse(fmText)
    pending.push({ file, text: match[1] + fmText + text.slice(match[1].length + match[2].length) })
  }
}
const duplicates = [...assets.values()].filter((files) => files.length > 1)
console.log(`${count} image records checked; ${duplicates.length} assets have multiple records (preserved)`)
if (errors.length) { console.error(errors.join("\n")); process.exitCode = 1 }
else {
  if (write) for (const item of pending) fs.writeFileSync(item.file, item.text)
  console.log(`${write ? "Updated" : "Would update"} ${pending.length} notes; ${repaired} broken links repaired; ${lists} scalar fields converted to lists`)
  if (check && pending.length) process.exitCode = 1
}
