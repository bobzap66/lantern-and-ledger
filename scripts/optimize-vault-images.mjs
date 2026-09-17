import { promises as fs } from "node:fs"
import path from "node:path"
import sharp from "sharp"

const vaultRoot = path.resolve(process.argv[2] ?? "content")
const apply = process.argv.includes("--apply")
const imageRoot = path.join(vaultRoot, "assets", "images")
const textExtensions = new Set([
  ".canvas",
  ".cjs",
  ".css",
  ".csv",
  ".html",
  ".js",
  ".json",
  ".md",
  ".mjs",
  ".scss",
  ".ts",
  ".tsx",
  ".yaml",
  ".yml",
])
const ignoredDirectories = new Set([".git", ".obsidian", "node_modules", "public", "tmp"])
const minimumWebpBytes = 1024 * 1024
const webpOptions = {
  quality: 88,
  alphaQuality: 100,
  effort: 4,
  smartSubsample: true,
}

async function walk(directory, predicate, output = []) {
  const entries = await fs.readdir(directory, { withFileTypes: true })
  for (const entry of entries) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue
    const fullPath = path.join(directory, entry.name)
    if (entry.isDirectory()) await walk(fullPath, predicate, output)
    else if (entry.isFile() && predicate(fullPath)) output.push(fullPath)
  }
  return output
}

function relative(file) {
  return path.relative(vaultRoot, file).split(path.sep).join("/")
}

function encodedPath(value) {
  return value.split("/").map(encodeURIComponent).join("/")
}

function expectedDimensions(metadata) {
  if ([5, 6, 7, 8].includes(metadata.orientation)) {
    return { width: metadata.height, height: metadata.width }
  }
  return { width: metadata.width, height: metadata.height }
}

function assertMatchingImage(source, sourceMetadata, target, targetMetadata) {
  const expected = expectedDimensions(sourceMetadata)
  if (targetMetadata.width !== expected.width || targetMetadata.height !== expected.height) {
    throw new Error(
      `Dimension mismatch: ${relative(source)} is ${expected.width}x${expected.height}, ` +
        `${relative(target)} is ${targetMetadata.width}x${targetMetadata.height}`,
    )
  }
  if ((targetMetadata.pages ?? 1) !== (sourceMetadata.pages ?? 1)) {
    throw new Error(`Frame-count mismatch: ${relative(source)} and ${relative(target)}`)
  }
}

async function withRetry(operation, attempts = 10) {
  let lastError
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await operation()
    } catch (error) {
      lastError = error
      if (
        !["EACCES", "EBUSY", "EPERM", "UNKNOWN"].includes(error.code) ||
        attempt === attempts - 1
      ) {
        throw error
      }
      await new Promise((resolve) => setTimeout(resolve, 200 * (attempt + 1)))
    }
  }
  throw lastError
}

async function replaceFile(file, output) {
  const optimized = `${file}.optimized-${process.pid}.tmp`
  const original = `${file}.source-${process.pid}.tmp`
  await withRetry(() => fs.writeFile(optimized, output, { flag: "wx" }))
  try {
    await withRetry(() => fs.rename(file, original))
  } catch (error) {
    await withRetry(() => fs.rm(optimized, { force: true }))
    throw error
  }
  try {
    await withRetry(() => fs.rename(optimized, file))
  } catch (error) {
    await withRetry(() => fs.rename(original, file))
    await withRetry(() => fs.rm(optimized, { force: true }))
    throw error
  }
  await withRetry(() => fs.rm(original))
}

function replacementVariants(source, target) {
  const oldRelative = relative(source)
  const newRelative = relative(target)
  return [
    [oldRelative, newRelative],
    [oldRelative.replaceAll("/", "\\"), newRelative.replaceAll("/", "\\")],
    [encodedPath(oldRelative), encodedPath(newRelative)],
  ]
}

const pngFiles = await walk(imageRoot, (file) => path.extname(file).toLowerCase() === ".png")
const replacements = []
let pngBytesRemoved = 0
let convertedPngFiles = 0
let convertedPngBytes = 0
let convertedPngWebpBytes = 0

for (const source of pngFiles) {
  const target = source.slice(0, -path.extname(source).length) + ".webp"
  const sourceStat = await fs.stat(source)
  const sourceMetadata = await sharp(source, { animated: true }).metadata()
  let targetMetadata
  let targetExists = true

  try {
    await fs.access(target)
  } catch (error) {
    if (error.code === "ENOENT") targetExists = false
    else throw error
  }

  if (targetExists) {
    targetMetadata = await sharp(target, { animated: true }).metadata()
  } else {
    const output = await sharp(source, { animated: true }).autoOrient().webp(webpOptions).toBuffer()
    targetMetadata = await sharp(output, { animated: true }).metadata()
    assertMatchingImage(source, sourceMetadata, target, targetMetadata)
    convertedPngFiles += 1
    convertedPngBytes += sourceStat.size
    convertedPngWebpBytes += output.length
    if (apply) await withRetry(() => fs.writeFile(target, output, { flag: "wx" }))
  }

  assertMatchingImage(source, sourceMetadata, target, targetMetadata)
  pngBytesRemoved += sourceStat.size
  replacements.push(...replacementVariants(source, target))
}

const basenameTargets = new Map()
for (const source of pngFiles) {
  const oldName = path.basename(source)
  const newName = path.basename(source, path.extname(source)) + ".webp"
  const existing = basenameTargets.get(oldName.toLowerCase())
  if (existing && existing.toLowerCase() !== newName.toLowerCase()) {
    basenameTargets.set(oldName.toLowerCase(), null)
  } else if (existing !== null) {
    basenameTargets.set(oldName.toLowerCase(), newName)
  }
}
for (const source of pngFiles) {
  const oldName = path.basename(source)
  const newName = basenameTargets.get(oldName.toLowerCase())
  if (newName) replacements.push([oldName, newName])
}

replacements.sort((left, right) => right[0].length - left[0].length)
const textFiles = await walk(vaultRoot, (file) =>
  textExtensions.has(path.extname(file).toLowerCase()),
)
let updatedTextFiles = 0

for (const file of textFiles) {
  const original = await fs.readFile(file, "utf8")
  let updated = original
  for (const [from, to] of replacements) updated = updated.replaceAll(from, to)
  if (updated !== original) {
    updatedTextFiles += 1
    if (apply) await fs.writeFile(file, updated, "utf8")
  }
}

if (apply) {
  for (const source of pngFiles) await withRetry(() => fs.rm(source))
}

const webpFiles = await walk(imageRoot, (file) => path.extname(file).toLowerCase() === ".webp")
let optimizedWebps = 0
const skippedWebps = []
let webpBytesBefore = 0
let webpBytesAfter = 0

for (const file of webpFiles) {
  const stat = await fs.stat(file)
  if (stat.size <= minimumWebpBytes) continue

  const sourceMetadata = await sharp(file, { animated: true }).metadata()
  const output = await sharp(file, { animated: true }).webp(webpOptions).toBuffer()
  const outputMetadata = await sharp(output, { animated: true }).metadata()
  assertMatchingImage(file, sourceMetadata, file, outputMetadata)

  optimizedWebps += 1
  webpBytesBefore += stat.size
  webpBytesAfter += output.length
  if (apply && output.length < stat.size) {
    try {
      await replaceFile(file, output)
    } catch (error) {
      if (!["EACCES", "EBUSY", "EPERM", "UNKNOWN"].includes(error.code)) throw error
      skippedWebps.push(relative(file))
    }
  }
}

const totalSavings = pngBytesRemoved - convertedPngWebpBytes + webpBytesBefore - webpBytesAfter
console.log(
  JSON.stringify(
    {
      mode: apply ? "apply" : "dry-run",
      pngFilesRemoved: pngFiles.length,
      pngMiBRemoved: Number((pngBytesRemoved / 1048576).toFixed(1)),
      pngFilesConverted: convertedPngFiles,
      convertedPngSourceMiB: Number((convertedPngBytes / 1048576).toFixed(1)),
      convertedPngWebpMiB: Number((convertedPngWebpBytes / 1048576).toFixed(1)),
      textFilesUpdated: updatedTextFiles,
      largeWebpsOptimized: optimizedWebps,
      largeWebpsSkipped: skippedWebps.length,
      skippedWebpPaths: skippedWebps,
      largeWebpsBeforeMiB: Number((webpBytesBefore / 1048576).toFixed(1)),
      largeWebpsAfterMiB: Number((webpBytesAfter / 1048576).toFixed(1)),
      estimatedTotalSavingsMiB: Number((totalSavings / 1048576).toFixed(1)),
    },
    null,
    2,
  ),
)
