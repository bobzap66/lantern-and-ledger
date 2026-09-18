import { promises as fs } from "node:fs"
import path from "node:path"

const outputRoot = path.resolve(process.argv[2] ?? "public")
const imageBase = (process.env.PUBLIC_IMAGE_BASE_URL ?? "").replace(/\/$/, "")

if (!imageBase) {
  throw new Error("PUBLIC_IMAGE_BASE_URL is required")
}

const textExtensions = new Set([
  ".css", ".html", ".js", ".json", ".map", ".svg", ".txt", ".xml",
])

let rewrittenFiles = 0
let rewrittenReferences = 0

async function walk(dir) {
  const files = []
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) files.push(...await walk(full))
    else if (entry.isFile()) files.push(full)
  }
  return files
}

function rewriteAssetUrls(source) {
  let count = 0
  const updated = source.replace(
    /(?:(?:https?:)?\/\/[^"'()\s]+)?(?:\/lantern-and-ledger)?(?:\.{1,2}\/|\/)*assets\/images\/[^"'()\s<>]+/g,
    (match) => {
      const marker = "assets/images/"
      const index = match.indexOf(marker)
      if (index < 0) return match
      count += 1
      return `${imageBase}/${match.slice(index)}`
    },
  )
  return { updated, count }
}

for (const file of await walk(outputRoot)) {
  if (!textExtensions.has(path.extname(file).toLowerCase())) continue
  const original = await fs.readFile(file, "utf8")
  const { updated, count } = rewriteAssetUrls(original)
  if (count && updated !== original) {
    await fs.writeFile(file, updated)
    rewrittenFiles += 1
    rewrittenReferences += count
  }
}

const localImages = path.join(outputRoot, "assets", "images")
await fs.rm(localImages, { recursive: true, force: true })

console.log(JSON.stringify({
  imageBase,
  rewrittenFiles,
  rewrittenReferences,
  removedLocalImageDirectory: "public/assets/images",
}, null, 2))
