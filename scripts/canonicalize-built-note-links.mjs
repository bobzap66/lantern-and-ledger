import { promises as fs } from "node:fs"
import path from "node:path"
import { slugifyFilePath } from "@quartz-community/utils"

const outputRoot = path.resolve(process.argv[2] ?? "public")
const deploymentBase = (process.argv[3] ?? "").replace(/^\/+|\/+$/g, "")
const baseRoot = deploymentBase ? `/${deploymentBase}` : ""
const siteOrigin = new URL(process.argv[4] ?? "https://greene-gaming.com").origin
const htmlFiles = []
const outputPaths = new Set()

const publicationOutputRoots = [
  ["Lantern-and-Ledger", "lantern-and-ledger"],
  ["Beacon-and-Bulletin", "beacon-and-bulletin"],
]

async function pathsEqual(left, right) {
  const [leftBuffer, rightBuffer] = await Promise.all([fs.readFile(left), fs.readFile(right)])
  return leftBuffer.equals(rightBuffer)
}

async function mergeDirectory(source, destination) {
  await fs.mkdir(destination, { recursive: true })

  for (const entry of await fs.readdir(source, { withFileTypes: true })) {
    const sourcePath = path.join(source, entry.name)
    const destinationPath = path.join(destination, entry.name)

    if (entry.isDirectory()) {
      await mergeDirectory(sourcePath, destinationPath)
      await fs.rm(sourcePath, { recursive: true, force: true })
      continue
    }

    if (!entry.isFile()) continue

    try {
      await fs.access(destinationPath)
      if (!(await pathsEqual(sourcePath, destinationPath))) {
        throw new Error(
          `Refusing to merge publication output: conflicting files ${sourcePath} and ${destinationPath}`,
        )
      }
      await fs.unlink(sourcePath)
    } catch (error) {
      if (error?.code !== "ENOENT") throw error
      await fs.rename(sourcePath, destinationPath)
    }
  }
}

async function normalizePublicationOutputRoots() {
  for (const [generatedName, canonicalName] of publicationOutputRoots) {
    const generatedPath = path.join(outputRoot, generatedName)
    const canonicalPath = path.join(outputRoot, canonicalName)

    try {
      await fs.access(generatedPath)
    } catch {
      continue
    }

    let canonicalExists = true
    try {
      await fs.access(canonicalPath)
    } catch (error) {
      if (error?.code !== "ENOENT") throw error
      canonicalExists = false
    }

    if (canonicalExists) {
      await mergeDirectory(generatedPath, canonicalPath)
      await fs.rm(generatedPath, { recursive: true, force: true })
      console.log(`Merged publication output root: ${generatedName} -> ${canonicalName}`)
    } else {
      await fs.rename(generatedPath, canonicalPath)
      console.log(`Normalized publication output root: ${generatedName} -> ${canonicalName}`)
    }
  }
}

async function collectOutput(dir) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) await collectOutput(fullPath)
    else if (entry.isFile()) {
      const relative = path.relative(outputRoot, fullPath).split(path.sep).join("/")
      outputPaths.add(`${baseRoot}/${relative}`.replace(/\/{2,}/g, "/"))
      if (entry.name.endsWith(".html")) htmlFiles.push(fullPath)
    }
  }
}

function attributeValue(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}=(?:"([^"]*)"|'([^']*)')`, "i"))
  return match ? (match[1] ?? match[2] ?? "") : null
}

function routeFor(file) {
  const relative = path.relative(outputRoot, file).split(path.sep).join("/")
  if (relative === "index.html") return `${baseRoot}/`
  return `${baseRoot}/${relative.replace(/\.html$/, "").replace(/\/index$/, "/")}`.replace(
    /\/{2,}/g,
    "/",
  )
}

function suffixFor(originalHref) {
  const suffixIndex = originalHref.search(/[?#]/)
  return suffixIndex >= 0 ? originalHref.slice(suffixIndex) : ""
}

function legacyPublicationCandidates(pathname) {
  const candidates = [pathname]

  if (pathname === "/Lantern-and-Ledger" || pathname.startsWith("/Lantern-and-Ledger/")) {
    candidates.push(pathname.replace("/Lantern-and-Ledger", "/lantern-and-ledger"))
  }

  if (pathname === "/Beacon-and-Bulletin" || pathname.startsWith("/Beacon-and-Bulletin/")) {
    candidates.push(pathname.replace("/Beacon-and-Bulletin", "/beacon-and-bulletin"))
  }

  if (pathname === "/campaigns" || pathname.startsWith("/campaigns/")) {
    candidates.push(`/lantern-and-ledger${pathname}`, `/beacon-and-bulletin${pathname}`)
  }

  const lanternCampaignsRoot = "/lantern-and-ledger/campaigns"
  if (pathname === lanternCampaignsRoot || pathname.startsWith(`${lanternCampaignsRoot}/`)) {
    candidates.push(pathname.slice("/lantern-and-ledger".length))
  }

  if (pathname === "/the-lantern-and-ledger" || pathname.startsWith("/the-lantern-and-ledger/")) {
    candidates.push(pathname.replace("/the-lantern-and-ledger", "/lantern-and-ledger"))
  }

  const duplicatedLanternRoot = "/lantern-and-ledger/the-lantern-and-ledger"
  if (pathname === duplicatedLanternRoot || pathname.startsWith(`${duplicatedLanternRoot}/`)) {
    candidates.push(pathname.replace(duplicatedLanternRoot, "/lantern-and-ledger"))
  }

  const misplacedReferencesRoot = "/lantern-and-ledger/external-references"
  if (pathname === misplacedReferencesRoot || pathname.startsWith(`${misplacedReferencesRoot}/`)) {
    candidates.push(pathname.slice("/lantern-and-ledger".length))
  }

  return [...new Set(candidates)]
}

function canonicalSlugHref(dataSlug, originalHref) {
  let slug = dataSlug.replace(/^\/+|\/+$/g, "")
  const suffix = suffixFor(originalHref)

  if (!slug || slug === "index") return `${baseRoot}/${suffix}`.replace(/\/{2,}/g, "/")

  if (slug.endsWith("/index")) {
    slug = slug.slice(0, -"/index".length)
    const pathname = `${baseRoot}/${slug}/`.replace(/\/{2,}/g, "/")
    return `${canonicalRoutePath(pathname)}${suffix}`
  }

  const pathname = `${baseRoot}/${slug}`.replace(/\/{2,}/g, "/")
  return `${canonicalRoutePath(pathname)}${suffix}`
}

await normalizePublicationOutputRoots()
await collectOutput(outputRoot)

const canonicalRoutes = new Map()
for (const file of htmlFiles) {
  const route = routeFor(file)
  canonicalRoutes.set(route.replace(/\/$/, "") || "/", route)
}

function canonicalRoutePath(pathname) {
  for (const candidate of legacyPublicationCandidates(pathname)) {
    const routeKey = candidate.replace(/\/$/, "") || "/"
    const canonical = canonicalRoutes.get(routeKey)
    if (canonical) return canonical
  }
  return pathname
}

function canonicalOutputPath(pathname) {
  for (const candidate of legacyPublicationCandidates(pathname)) {
    if (outputPaths.has(candidate)) return candidate
  }
  return null
}

function canonicalHref(file, originalHref, dataSlug) {
  if (!originalHref || originalHref.startsWith("#")) return originalHref
  if (/^(?:mailto:|tel:|javascript:|data:|blob:|\/\/)/i.test(originalHref)) return originalHref
  if (dataSlug !== null) return canonicalSlugHref(dataSlug, originalHref)

  let target
  try {
    target = new URL(originalHref, `${siteOrigin}${routeFor(file)}`)
  } catch {
    return originalHref
  }

  if (target.origin !== siteOrigin) return originalHref

  let pathname = target.pathname
  const insideBase = !baseRoot || pathname === baseRoot || pathname.startsWith(`${baseRoot}/`)
  if (!insideBase) {
    pathname = `${baseRoot}${pathname}`.replace(/\/{2,}/g, "/")
  }

  pathname = canonicalRoutePath(pathname)
  return `${pathname}${target.search}${target.hash}`
}

function canonicalImageSrc(file, originalSrc) {
  if (!originalSrc || /^(?:data:|blob:|\/\/)/i.test(originalSrc)) return originalSrc

  let target
  try {
    target = new URL(originalSrc, `${siteOrigin}${routeFor(file)}`)
  } catch {
    return originalSrc
  }

  if (target.origin !== siteOrigin) return originalSrc

  let pathname
  try {
    pathname = decodeURIComponent(target.pathname)
  } catch {
    pathname = target.pathname
  }

  const insideBase = !baseRoot || pathname === baseRoot || pathname.startsWith(`${baseRoot}/`)
  if (!insideBase) {
    pathname = `${baseRoot}${pathname}`.replace(/\/{2,}/g, "/")
  }

  const canonicalPathname = canonicalOutputPath(pathname)
  if (canonicalPathname) return `${canonicalPathname}${target.search}${target.hash}`

  const relativeAssetPath = pathname.slice(baseRoot.length).replace(/^\/+/, "")
  if (!relativeAssetPath) return originalSrc

  const sluggedAssetPath = String(slugifyFilePath(relativeAssetPath)).replace(/^\/+/, "")
  const candidate = `${baseRoot}/${sluggedAssetPath}`.replace(/\/{2,}/g, "/")
  const canonicalCandidate = canonicalOutputPath(candidate)
  if (canonicalCandidate) return `${canonicalCandidate}${target.search}${target.hash}`

  // Older notes sometimes contain a relative path with too few `../` segments.
  // Once resolved from a deeply nested article, that produces paths such as
  // `campaigns/assets/images/...`. Assets are emitted from the vault-root
  // `assets/images` directory, so recover that canonical suffix when present.
  const assetMarker = "assets/images/"
  const markerIndex = relativeAssetPath.toLowerCase().indexOf(assetMarker)
  if (markerIndex < 0) return originalSrc

  const rootAssetPath = relativeAssetPath.slice(markerIndex)
  const rootCandidate =
    `${baseRoot}/${String(slugifyFilePath(rootAssetPath)).replace(/^\/+/, "")}`.replace(
      /\/{2,}/g,
      "/",
    )
  if (!outputPaths.has(rootCandidate)) return originalSrc

  return `${rootCandidate}${target.search}${target.hash}`
}

let filesChanged = 0
let linksChanged = 0
let imagesChanged = 0

for (const file of htmlFiles) {
  const original = await fs.readFile(file, "utf8")
  let rewritten = original.replace(/<a\b[^>]*>/gi, (tag) => {
    const href = attributeValue(tag, "href")
    const dataSlug = attributeValue(tag, "data-slug")
    if (href === null) return tag

    const canonical = canonicalHref(file, href, dataSlug)
    if (canonical === href) return tag

    linksChanged++
    return tag.replace(/\bhref=(?:"[^"]*"|'[^']*')/i, `href="${canonical}"`)
  })

  rewritten = rewritten.replace(/<img\b[^>]*>/gi, (tag) => {
    const src = attributeValue(tag, "src")
    if (src === null) return tag

    const canonical = canonicalImageSrc(file, src)
    if (canonical === src) return tag

    imagesChanged++
    return tag.replace(/\bsrc=(?:"[^"]*"|'[^']*')/i, `src="${canonical}"`)
  })

  if (rewritten !== original) {
    await fs.writeFile(file, rewritten, "utf8")
    filesChanged++
  }
}

console.log(
  `Canonicalized ${linksChanged} rendered internal link(s) and ${imagesChanged} image source(s) across ${filesChanged} HTML file(s).`,
)
