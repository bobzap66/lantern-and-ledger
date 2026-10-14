import { promises as fs } from "node:fs"
import path from "node:path"
import YAML from "yaml"

const contentRoot = path.resolve(process.argv[2] ?? "content")
const campaignsRoot = path.join(contentRoot, "Campaigns")
const TOTAL_MARKER = "<!-- VIGNETTE_TOTAL -->"
const COUNT_MARKER = /<!-- VIGNETTE_COUNT:(.+?) -->/g

function parseFrontmatter(text) {
  const match = /^---\s*\r?\n([\s\S]*?)\r?\n---/.exec(text)
  if (!match) return {}
  return YAML.parse(match[1]) ?? {}
}

async function walk(directory) {
  let entries
  try {
    entries = await fs.readdir(directory, { withFileTypes: true })
  } catch (error) {
    if (error.code === "ENOENT") return []
    throw error
  }

  const files = []
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name)
    if (entry.isDirectory()) files.push(...(await walk(fullPath)))
    else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) files.push(fullPath)
  }
  return files
}

async function countVignettes(directory) {
  const files = await walk(directory)
  let count = 0
  for (const filePath of files) {
    if (path.basename(filePath).toLowerCase() === "index.md") continue
    const metadata = parseFrontmatter(await fs.readFile(filePath, "utf8"))
    if (metadata.type === "vignette" && metadata.draft !== true && metadata.publish !== false)
      count++
  }
  return count
}

function pieceLabel(count) {
  return `${count} ${count === 1 ? "piece" : "pieces"}`
}

async function generateIndex(indexPath, vignetteRoot) {
  const directory = path.dirname(indexPath)
  const source = await fs.readFile(indexPath, "utf8")
  const newline = source.includes("\r\n") ? "\r\n" : "\n"
  let updated = source

  if (updated.includes(TOTAL_MARKER)) {
    const count = await countVignettes(directory)
    const label = ["Vignettes", "Character Vignettes", "GM Vignettes"].includes(
      path.basename(directory),
    )
      ? "The archive contains"
      : "The chapter archive contains"
    updated = updated.replaceAll(TOTAL_MARKER, `${label} **${pieceLabel(count)}**.`)
  }

  const markers = [...updated.matchAll(COUNT_MARKER)]
  for (const marker of markers) {
    const target = marker[1].trim()
    if (!target.startsWith("./"))
      throw new Error(`${indexPath} has invalid vignette count target: ${target}`)
    const targetDirectory = path.resolve(directory, target.slice(2))
    const relativeTarget = path.relative(vignetteRoot, targetDirectory)
    if (relativeTarget.startsWith("..") || path.isAbsolute(relativeTarget)) {
      throw new Error(`${indexPath} vignette count target escapes ${vignetteRoot}: ${target}`)
    }
    const stat = await fs.stat(targetDirectory).catch(() => null)
    if (!stat?.isDirectory())
      throw new Error(`${indexPath} vignette count target is not a directory: ${target}`)
    const count = await countVignettes(targetDirectory)
    updated = updated.replace(marker[0], `— ${pieceLabel(count)}`)
  }

  if (updated !== source) {
    await fs.writeFile(indexPath, updated, "utf8")
    return 1
  }
  return 0
}

async function main() {
  let campaigns
  try {
    campaigns = await fs.readdir(campaignsRoot, { withFileTypes: true })
  } catch {
    throw new Error(`Campaign content directory not found: ${campaignsRoot}`)
  }

  let updatedCount = 0
  let indexCount = 0
  for (const campaign of campaigns) {
    if (!campaign.isDirectory()) continue
    const vignetteRoot = path.join(campaignsRoot, campaign.name, "Vignettes")
    const vignetteFiles = await walk(vignetteRoot)
    for (const indexPath of vignetteFiles.filter(
      (filePath) => path.basename(filePath).toLowerCase() === "index.md",
    )) {
      indexCount++
      updatedCount += await generateIndex(indexPath, vignetteRoot)
    }
  }

  console.log(`Generated vignette counts in ${updatedCount} of ${indexCount} vignette indexes`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
