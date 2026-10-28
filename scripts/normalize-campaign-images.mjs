import { promises as fs } from "node:fs"
import path from "node:path"
import process from "node:process"
import sharp from "sharp"
import YAML from "yaml"

const HERO = { width: 2048, height: 800, suffix: "hero" }
const CARD = { width: 1536, height: 1024, suffix: "card" }
const WEBP_QUALITY = 88
const args = process.argv.slice(2)
const contentRoot = path.resolve(args.find((arg) => !arg.startsWith("--")) ?? "content")
const write = args.includes("--write")
const contactSheetArg = args.find((arg) => arg.startsWith("--contact-sheet="))
const contactSheetPath = contactSheetArg
  ? path.resolve(contactSheetArg.slice("--contact-sheet=".length))
  : null

function parseFrontmatter(source, file) {
  const match = /^---\s*\r?\n([\s\S]*?)\r?\n---/.exec(source)
  if (!match) throw new Error(`${file} has no YAML frontmatter`)
  return { match, metadata: YAML.parse(match[1]) ?? {} }
}

function slugify(value) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

function rootRelative(value) {
  return String(value ?? "")
    .trim()
    .replaceAll("\\", "/")
    .replace(/^\/+/, "")
}

function quoted(value) {
  return JSON.stringify(String(value))
}

function upsertFrontmatterField(source, field, value) {
  const { match } = parseFrontmatter(source, "campaign root")
  const body = match[1]
  const line = `${field}: ${quoted(value)}`
  const pattern = new RegExp(`^${field}:.*$`, "m")
  const updatedBody = pattern.test(body) ? body.replace(pattern, line) : `${body}\n${line}`
  return source.replace(match[0], `---\n${updatedBody}\n---`)
}

function focalPoint(value) {
  const match = /^\s*(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%\s*$/.exec(String(value ?? ""))
  if (!match) return { x: 50, y: 50, text: "50% 50%" }
  const x = Math.max(0, Math.min(100, Number(match[1])))
  const y = Math.max(0, Math.min(100, Number(match[2])))
  return { x, y, text: `${x}% ${y}%` }
}

async function renderCrop(source, target, dimensions, focal) {
  const image = sharp(source)
  const metadata = await image.metadata()
  if (!metadata.width || !metadata.height) throw new Error(`Cannot read dimensions: ${source}`)

  const targetRatio = dimensions.width / dimensions.height
  const sourceRatio = metadata.width / metadata.height
  let cropWidth = metadata.width
  let cropHeight = metadata.height
  if (sourceRatio > targetRatio) cropWidth = Math.round(metadata.height * targetRatio)
  else cropHeight = Math.round(metadata.width / targetRatio)

  const left = Math.round(
    Math.max(
      0,
      Math.min(metadata.width - cropWidth, (focal.x / 100) * metadata.width - cropWidth / 2),
    ),
  )
  const top = Math.round(
    Math.max(
      0,
      Math.min(metadata.height - cropHeight, (focal.y / 100) * metadata.height - cropHeight / 2),
    ),
  )

  await fs.mkdir(path.dirname(target), { recursive: true })
  await sharp(source)
    .extract({ left, top, width: cropWidth, height: cropHeight })
    .resize(dimensions.width, dimensions.height, { fit: "fill" })
    .webp({ quality: WEBP_QUALITY, effort: 6 })
    .toFile(target)
}

function relativeAssetUrl(file, asset) {
  return path.relative(path.dirname(file), path.join(contentRoot, asset)).replaceAll(path.sep, "/")
}

function heroImageMarkup(file, asset, alt, focal) {
  return `  <img class="campaign-hero__image" src="${relativeAssetUrl(file, asset)}" alt="${String(alt).replaceAll("&", "&amp;").replaceAll('"', "&quot;")}" style="object-position: ${focal.text}">`
}

function updateHeroMarkup(source, file, asset, alt, focal) {
  const markup = heroImageMarkup(file, asset, alt, focal)
  const existing = /^\s*<img\s+class="campaign-hero__image"[^>]*>\s*$/m
  if (existing.test(source)) return source.replace(existing, markup)
  return source.replace(/(<section\s+class="campaign-hero[^"]*"[^>]*>)/, `$1\n${markup}`)
}

async function inspectDimensions(file) {
  const metadata = await sharp(file).metadata()
  return { width: metadata.width, height: metadata.height }
}

async function loadCampaigns() {
  const campaigns = []
  const campaignRoots = [
    path.join(contentRoot, "Lantern and Ledger", "Campaigns"),
    path.join(contentRoot, "Beacon and Bulletin", "Campaigns"),
  ]
  for (const campaignsRoot of campaignRoots) {
    const entries = await fs.readdir(campaignsRoot, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const file = path.join(campaignsRoot, entry.name, "index.md")
      let source
      try {
        source = await fs.readFile(file, "utf8")
      } catch {
        continue
      }
      const { metadata } = parseFrontmatter(source, file)
      if (metadata.type !== "campaign" || metadata.draft === true || metadata.publish === false)
        continue
      campaigns.push({ folder: entry.name, file, source, metadata })
    }
  }
  return campaigns
}

async function processCampaign(campaign) {
  const { folder, file, metadata } = campaign
  const slug = slugify(folder)
  const existingHero =
    /<img\s+class="campaign-hero__image"[^>]*src="([^"]+)"[^>]*alt="([^"]*)"[^>]*>/m.exec(
      campaign.source,
    )
  const sourceAsset = rootRelative(
    metadata.campaign_image_source ?? metadata.hero_image ?? metadata.directory_image,
  )
  const alt = String(metadata.hero_alt ?? existingHero?.[2] ?? metadata.directory_alt ?? "").trim()
  const heroFocal = focalPoint(metadata.hero_focal_point)
  const cardFocal = focalPoint(metadata.directory_focal_point)
  const errors = []

  if (!sourceAsset) {
    if (metadata.campaign_image_pending === true) {
      return { ...campaign, errors, skipped: true }
    }
    errors.push("missing campaign_image_source (and no existing image to migrate)")
    return { ...campaign, errors, skipped: true }
  }
  if (!alt) errors.push("missing hero_alt or directory_alt")

  const sourceFile = path.join(contentRoot, sourceAsset)
  const assetDirectory = path.posix.dirname(sourceAsset)
  const heroAsset = `${assetDirectory}/${slug}-hero.webp`
  const cardAsset = `${assetDirectory}/${slug}-card.webp`
  const heroFile = path.join(contentRoot, heroAsset)
  const cardFile = path.join(contentRoot, cardAsset)

  try {
    await fs.access(sourceFile)
  } catch {
    errors.push(`source image not found: ${sourceAsset}`)
    return { ...campaign, errors, skipped: true }
  }

  if (write) {
    await renderCrop(sourceFile, heroFile, HERO, heroFocal)
    await renderCrop(sourceFile, cardFile, CARD, cardFocal)
    let updated = campaign.source
    for (const [field, value] of [
      ["campaign_image_source", sourceAsset],
      ["hero_image", heroAsset],
      ["hero_alt", alt],
      ["hero_focal_point", heroFocal.text],
      ["directory_image", cardAsset],
      ["directory_alt", String(metadata.directory_alt ?? alt)],
      ["directory_focal_point", cardFocal.text],
    ]) {
      updated = upsertFrontmatterField(updated, field, value)
    }
    updated = updateHeroMarkup(updated, file, heroAsset, alt, heroFocal)
    await fs.writeFile(file, updated, "utf8")
  }

  for (const [label, target, dimensions] of [
    ["hero_image", heroFile, HERO],
    ["directory_image", cardFile, CARD],
  ]) {
    try {
      const actual = await inspectDimensions(target)
      if (actual.width !== dimensions.width || actual.height !== dimensions.height) {
        errors.push(
          `${label} is ${actual.width}x${actual.height}; expected ${dimensions.width}x${dimensions.height}`,
        )
      }
    } catch {
      errors.push(`${label} derivative not found: ${path.relative(contentRoot, target)}`)
    }
  }

  if (!write) {
    if (rootRelative(metadata.hero_image) !== heroAsset)
      errors.push(`hero_image must be ${heroAsset}`)
    if (rootRelative(metadata.directory_image) !== cardAsset) {
      errors.push(`directory_image must be ${cardAsset}`)
    }
    const existingHeroTarget = existingHero
      ? path.resolve(path.dirname(file), existingHero[1])
      : null
    if (!existingHeroTarget || existingHeroTarget !== heroFile) {
      errors.push("campaign hero markup does not reference hero_image")
    }
  }

  return { ...campaign, errors, heroFile, cardFile, heroAsset, cardAsset, skipped: false }
}

async function createContactSheet(results, output) {
  const ready = results.filter((result) => !result.skipped && result.heroFile && result.cardFile)
  const rowHeight = 250
  const width = 1200
  const composites = []
  for (let index = 0; index < ready.length; index += 1) {
    const result = ready[index]
    const top = index * rowHeight
    const hero = await sharp(result.heroFile).resize(720, 211, { fit: "cover" }).png().toBuffer()
    const card = await sharp(result.cardFile).resize(360, 240, { fit: "cover" }).png().toBuffer()
    const label = Buffer.from(
      `<svg width="1200" height="250"><rect width="1200" height="250" fill="#181714"/><text x="20" y="28" fill="#f4ead5" font-size="20" font-family="sans-serif">${result.folder.replaceAll("&", "&amp;").replaceAll("<", "&lt;")}</text></svg>`,
    )
    composites.push({ input: label, top, left: 0 })
    composites.push({ input: hero, top: top + 35, left: 20 })
    composites.push({ input: card, top: top + 5, left: 800 })
  }
  await fs.mkdir(path.dirname(output), { recursive: true })
  await sharp({
    create: {
      width,
      height: Math.max(rowHeight, ready.length * rowHeight),
      channels: 3,
      background: "#181714",
    },
  })
    .composite(composites)
    .webp({ quality: 86 })
    .toFile(output)
}

const campaigns = await loadCampaigns()
const results = []
for (const campaign of campaigns) results.push(await processCampaign(campaign))
if (contactSheetPath) await createContactSheet(results, contactSheetPath)

let failureCount = 0
for (const result of results) {
  if (result.errors.length === 0) {
    console.log(`OK ${result.folder}`)
    continue
  }
  failureCount += result.errors.length
  console.error(`ERROR ${result.folder}`)
  for (const error of result.errors) console.error(`  - ${error}`)
}
console.log(
  `${campaigns.length} campaigns checked; ${failureCount} problem${failureCount === 1 ? "" : "s"}`,
)
if (contactSheetPath) console.log(`Contact sheet: ${contactSheetPath}`)
if (failureCount > 0) process.exitCode = 1
