import fs from "node:fs"
import path from "node:path"
import YAML from "yaml"

// Add searchable tags only from fields documented as visible depictions.
// Existing tags and narrative text are preserved. No filename/content inference.
const root = path.resolve(process.argv[2] ?? "content")
const write = process.argv.includes("--write")
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(dir, entry.name)
    return entry.isDirectory() ? walk(file) : entry.name.endsWith(".md") ? [file] : []
  }).sort()
}
const list = (value) => value == null ? [] : Array.isArray(value) ? value : [value]
function slug(value) {
  const wiki = String(value).match(/^\[\[([^|\]]+)(?:\|([^\]]+))?\]\]$/)
  const name = wiki ? (wiki[2] ?? path.posix.basename(wiki[1])) : String(value)
  return name.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase()
    .replace(/[’']/g, "").replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "")
}
const changes = []
const vocabulary = new Map()
for (const file of walk(path.join(root, "Image Metadata"))) {
  const original = fs.readFileSync(file, "utf8")
  const match = /^(\uFEFF?---\r?\n)([\s\S]*?)(\r?\n---(?:\r?\n|$))/.exec(original)
  if (!match) throw new Error(`Missing frontmatter: ${file}`)
  const doc = YAML.parseDocument(match[2])
  if (doc.errors.length) throw new Error(`${file}: ${doc.errors[0].message}`)
  const fm = doc.toJS()
  if (fm.type !== "image") continue
  const existing = [...list(fm.tag), ...list(fm.tags)]
  const tags = [...existing]
  for (const [prefix, values] of [
    ["subject", [...list(fm.player_character ?? fm.player_characters ?? fm.character ?? fm.characters), ...list(fm.npc ?? fm.npcs)]],
    ["location", list(fm.location ?? fm.locations)],
  ]) {
    for (const value of values) {
      const name = slug(value)
      if (!name) continue
      const tag = `${prefix}/${name}`
      if (!tags.includes(tag)) tags.push(tag)
    }
  }
  for (const tag of new Set(tags)) vocabulary.set(tag, (vocabulary.get(tag) ?? 0) + 1)
  if (tags.length === existing.length) continue
  // Replacing the YAML value by source range avoids reserializing other metadata.
  let frontmatter = match[2]
  const key = fm.tag !== undefined && fm.tags === undefined ? "tag" : "tags"
  const node = doc.get(key, true)
  if (node?.range) {
    const [start, end] = node.range
    const replacement = JSON.stringify(tags)
    frontmatter = frontmatter.slice(0, start) + replacement +
      (frontmatter.slice(start, end).endsWith("\n") ? (original.includes("\r\n") ? "\r\n" : "\n") : "") + frontmatter.slice(end)
  } else {
    const eol = original.includes("\r\n") ? "\r\n" : "\n"
    frontmatter += `${eol}tags: ${JSON.stringify(tags)}`
  }
  const parsed = YAML.parse(frontmatter)
  if (JSON.stringify(parsed[key]) !== JSON.stringify(tags)) throw new Error(`Tag verification failed: ${file}`)
  changes.push([file, match[1] + frontmatter + original.slice(match[1].length + match[2].length)])
}
if (write) for (const [file, content] of changes) fs.writeFileSync(file, content)
console.log(`${write ? "Updated" : "Would update"} ${changes.length} image notes`)
console.log(`${[...vocabulary.keys()].filter((tag) => /^(subject|location)\//.test(tag)).length} subject/location tags`)
if (process.argv.includes("--vocabulary")) {
  console.log([...vocabulary].filter(([tag]) => /^(subject|location)\//.test(tag)).sort().map(([tag, count]) => `${tag}: ${count}`).join("\n"))
}
