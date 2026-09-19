import fs from "node:fs"
import path from "node:path"
import YAML from "yaml"

const root = path.resolve(process.argv[2] ?? "content")
const output = process.argv[3] ? path.resolve(process.argv[3]) : null
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  const file = path.join(dir, entry.name)
  return entry.isDirectory() ? walk(file) : entry.name.endsWith(".md") ? [file] : []
}).sort()
const frontmatter = (text) => YAML.parse(/^\uFEFF?---\r?\n([\s\S]*?)\r?\n---/.exec(text)?.[1] ?? "") ?? {}
const relative = (file) => path.relative(root, file).replaceAll("\\", "/")
const records = walk(path.join(root, "Image Metadata")).map((file) => ({file, ...frontmatter(fs.readFileSync(file, "utf8"))})).filter((fm) => fm.type === "image")
const catalogued = new Set(records.map((record) => path.resolve(root, record.asset)))
const used = new Map(), unresolved = []
for (const file of walk(path.join(root, "Campaigns"))) {
  const text = fs.readFileSync(file, "utf8"), fm = frontmatter(text)
  const refs = []
  for (const key of ["portrait", "cover", "directory_image", "image", "banner", "cover_image", "author_image"]) if (typeof fm[key] === "string") refs.push(fm[key])
  for (const match of text.matchAll(/!\[\[([^\]|]+)(?:\|[^\]]*)?\]\]|!\[[^\]]*\]\(([^\n]+?)\)|<img\b[^>]*\bsrc=["']([^"']+)["']/g)) refs.push(match[1] ?? match[2] ?? match[3])
  for (let ref of refs) {
    ref = ref.trim().replace(/^<([^>]+)>$/, "$1").replace(/\s+"[^"]*"$/, "")
    if (/^(https?:|data:|\/\/)/.test(ref)) continue
    ref = ref.replace(/^!?\[\[([^|\]]+).*$/, "$1")
    try { ref = decodeURIComponent(ref) } catch { unresolved.push({note:relative(file),reference:ref}); continue }
    ref = ref.split("#")[0].split("?")[0]
    if (!/\.(avif|gif|jpe?g|png|svg|webp)$/i.test(ref)) continue
    const target = path.resolve(ref.startsWith("assets/") ? root : path.dirname(file), ref)
    if (!fs.existsSync(target)) { unresolved.push({note:relative(file),reference:ref}); continue }
    if (!used.has(target)) used.set(target, new Set())
    used.get(target).add(relative(file))
  }
}
const missing = [...used].filter(([file]) => !catalogued.has(file)).map(([file, notes]) => ({asset:relative(file),notes:[...notes]})).sort((a,b) => b.notes.length-a.notes.length || a.asset.localeCompare(b.asset))
const tags = new Map()
for (const record of records) for (const tag of record.tags ?? []) tags.set(tag,(tags.get(tag)??0)+1)
const report = {
  scope:"Local raster/SVG image embeds, HTML img sources, and image frontmatter fields in Campaigns; CSS, remote images and dynamic galleries are excluded.",
  records:records.length, referencedAssets:used.size, cataloguedReferencedAssets:used.size-missing.length,
  missingMetadata:missing, unresolvedReferences:unresolved,
  missingAlt:records.filter((record) => !record.alt?.trim()).map((record) => relative(record.file)),
  missingAttribution:records.filter((record) => !record.credit && !record.creator).map((record) => relative(record.file)),
  tagVocabulary:[...tags].sort(([a],[b])=>a.localeCompare(b)).map(([tag,count])=>({tag,count})),
}
if(output)fs.writeFileSync(output,JSON.stringify(report,null,2)+"\n")
console.log(JSON.stringify({records:report.records,referencedAssets:used.size,missingMetadata:missing.length,unresolvedReferences:unresolved.length,missingAlt:report.missingAlt.length,missingAttribution:report.missingAttribution.length},null,2))
