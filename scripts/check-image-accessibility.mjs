import { promises as fs } from "node:fs"
import path from "node:path"
import YAML from "yaml"

const vaultRoot = path.resolve(process.argv[2] ?? "content")
const metadataRoot = path.join(vaultRoot, "Image Metadata")

async function walk(directory) {
  const files = []
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue
    const fullPath = path.join(directory, entry.name)
    if (entry.isDirectory()) files.push(...(await walk(fullPath)))
    else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) files.push(fullPath)
  }
  return files
}

function frontmatter(source) {
  const match = /^---\s*\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(source)
  return match ? YAML.parse(match[1]) : undefined
}

function relative(filePath) {
  return path.relative(vaultRoot, filePath).split(path.sep).join("/")
}

const failures = []
let imageRecords = 0
let explicitAltRecords = 0
let captionFallbackRecords = 0

for (const filePath of await walk(metadataRoot)) {
  const metadata = frontmatter(await fs.readFile(filePath, "utf8"))
  if (!metadata || String(metadata.type ?? "").toLowerCase() !== "image") continue
  imageRecords += 1

  const asset = typeof metadata.asset === "string" ? metadata.asset.trim() : ""
  if (!asset) {
    failures.push(`${relative(filePath)}: missing asset`)
    continue
  }

  const absoluteAsset = path.resolve(vaultRoot, asset.replaceAll("/", path.sep))
  const insideVault = absoluteAsset === vaultRoot || absoluteAsset.startsWith(vaultRoot + path.sep)
  if (!insideVault) {
    failures.push(`${relative(filePath)}: asset resolves outside the vault (${asset})`)
  } else {
    try {
      await fs.access(absoluteAsset)
    } catch {
      failures.push(`${relative(filePath)}: asset does not exist (${asset})`)
    }
  }

  const alt = typeof metadata.alt === "string" ? metadata.alt.trim() : ""
  const caption = typeof metadata.caption === "string" ? metadata.caption.trim() : ""
  if (alt) explicitAltRecords += 1
  else if (caption) captionFallbackRecords += 1
  else failures.push(`${relative(filePath)}: requires alt or caption text`)
}

console.log(
  JSON.stringify(
    {
      imageRecords,
      explicitAltRecords,
      captionFallbackRecords,
      failures: failures.length,
    },
    null,
    2,
  ),
)

if (failures.length > 0) {
  for (const failure of failures) console.error(`- ${failure}`)
  process.exitCode = 1
}
