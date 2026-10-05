import fs from "node:fs"
import path from "node:path"
import { Element, Root } from "hast"
import { visit } from "unist-util-visit"
import YAML from "yaml"
import { QuartzTransformerPlugin } from "../types"

type AltTextRecord = {
  asset: string
  alt: string
}

type ImageDimensions = { width: number; height: number }

function threeByteLittleEndian(buffer: Buffer, offset: number) {
  return buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16)
}

/** Read intrinsic dimensions from image headers without invoking a native decoder. */
export function readImageDimensions(filePath: string): ImageDimensions | undefined {
  try {
    const handle = fs.openSync(filePath, "r")
    try {
      const size = Math.min(fs.fstatSync(handle).size, 256 * 1024)
      const buffer = Buffer.alloc(size)
      fs.readSync(handle, buffer, 0, size, 0)

      if (buffer.length >= 24 && buffer.subarray(1, 4).toString("ascii") === "PNG") {
        return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) }
      }

      if (buffer.length >= 10 && buffer.subarray(0, 3).toString("ascii") === "GIF") {
        return { width: buffer.readUInt16LE(6), height: buffer.readUInt16LE(8) }
      }

      if (
        buffer.length >= 30 &&
        buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
        buffer.subarray(8, 12).toString("ascii") === "WEBP"
      ) {
        const chunk = buffer.subarray(12, 16).toString("ascii")
        if (chunk === "VP8X") {
          return {
            width: threeByteLittleEndian(buffer, 24) + 1,
            height: threeByteLittleEndian(buffer, 27) + 1,
          }
        }
        if (chunk === "VP8L" && buffer[20] === 0x2f) {
          return {
            width: 1 + buffer[21] + ((buffer[22] & 0x3f) << 8),
            height:
              1 + ((buffer[22] & 0xc0) >> 6) + (buffer[23] << 2) + ((buffer[24] & 0x0f) << 10),
          }
        }
        if (chunk === "VP8 " && buffer.subarray(23, 26).equals(Buffer.from([0x9d, 0x01, 0x2a]))) {
          return {
            width: buffer.readUInt16LE(26) & 0x3fff,
            height: buffer.readUInt16LE(28) & 0x3fff,
          }
        }
      }

      if (buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8) {
        let offset = 2
        while (offset + 8 < buffer.length) {
          if (buffer[offset] !== 0xff) {
            offset += 1
            continue
          }
          const marker = buffer[offset + 1]
          if (marker === 0xd8 || marker === 0xd9) {
            offset += 2
            continue
          }
          const length = buffer.readUInt16BE(offset + 2)
          if (length < 2 || offset + length + 2 > buffer.length) break
          const isStartOfFrame =
            (marker >= 0xc0 && marker <= 0xc3) ||
            (marker >= 0xc5 && marker <= 0xc7) ||
            (marker >= 0xc9 && marker <= 0xcb) ||
            (marker >= 0xcd && marker <= 0xcf)
          if (isStartOfFrame) {
            return {
              width: buffer.readUInt16BE(offset + 7),
              height: buffer.readUInt16BE(offset + 5),
            }
          }
          offset += length + 2
        }
      }
    } finally {
      fs.closeSync(handle)
    }
  } catch {
    return undefined
  }

  return undefined
}

export function imageDimensionAttributes(filePath: string) {
  const dimensions = readImageDimensions(filePath)
  return dimensions ? ` width="${dimensions.width}" height="${dimensions.height}"` : ""
}

function readFrontmatter(filePath: string): Record<string, unknown> {
  try {
    const source = fs.readFileSync(filePath, "utf8")
    const match = source.match(/^---\s*\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)
    return match ? ((YAML.parse(match[1]) ?? {}) as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

function walkMarkdownFiles(directory: string): string[] {
  if (!fs.existsSync(directory)) return []
  const files: string[] = []
  const walk = (current: string) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue
      const fullPath = path.join(current, entry.name)
      if (entry.isDirectory()) walk(fullPath)
      else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) files.push(fullPath)
    }
  }
  walk(directory)
  return files
}

export function readImageAltText(vaultRoot: string): AltTextRecord[] {
  return walkMarkdownFiles(path.join(vaultRoot, "Image Metadata")).flatMap((filePath) => {
    const frontmatter = readFrontmatter(filePath)
    if (frontmatter.type !== "image" || typeof frontmatter.asset !== "string") return []
    const alt = String(frontmatter.alt ?? frontmatter.caption ?? "").trim()
    if (!alt) return []
    return [{ asset: frontmatter.asset.replaceAll("\\", "/").replace(/^\/+/, ""), alt }]
  })
}

function decodedPath(value: string) {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function resolveImagePath(vaultRoot: string, sourcePath: string, src: string) {
  const clean = decodedPath(src.split(/[?#]/, 1)[0]).replaceAll("\\", "/")
  if (!clean || /^(?:data:|https?:|\/\/)/i.test(clean)) return undefined

  const assetMarker = "assets/images/"
  const assetIndex = clean.toLowerCase().indexOf(assetMarker)
  if (assetIndex >= 0) {
    return path.resolve(vaultRoot, clean.slice(assetIndex))
  }

  return path.resolve(path.dirname(sourcePath), clean)
}

export const ImageAltText: QuartzTransformerPlugin = () => {
  let indexedRoot = ""
  let byAbsoluteAsset = new Map<string, string>()
  const dimensions = new Map<string, ImageDimensions | null>()

  const imageDimensions = (filePath: string) => {
    if (dimensions.has(filePath)) return dimensions.get(filePath) ?? undefined
    const result = readImageDimensions(filePath)
    dimensions.set(filePath, result ?? null)
    return result
  }

  const ensureIndex = (vaultRoot: string) => {
    if (indexedRoot === vaultRoot) return
    indexedRoot = vaultRoot
    byAbsoluteAsset = new Map(
      readImageAltText(vaultRoot).map((record) => [
        path.resolve(vaultRoot, record.asset),
        record.alt,
      ]),
    )
  }

  return {
    name: "ImageAltText",
    htmlPlugins(ctx) {
      return [
        () => (tree: Root, file) => {
          const sourcePath = String(file.path ?? "")
          if (!sourcePath) return
          const vaultRoot = path.resolve(ctx.argv.directory)
          ensureIndex(vaultRoot)

          let contentImageIndex = 0
          visit(tree, "element", (node: Element) => {
            if (node.tagName !== "img") return
            const properties = (node.properties ??= {})
            const src = typeof properties.src === "string" ? properties.src : undefined
            if (!src) return
            const absoluteAsset = resolveImagePath(vaultRoot, sourcePath, src)
            const classes = Array.isArray(properties.className)
              ? properties.className.map(String)
              : String(properties.className ?? "").split(/\s+/)
            const isHero = classes.includes("campaign-hero__image")

            properties.decoding ??= "async"
            if (properties.loading === undefined) {
              properties.loading = isHero || contentImageIndex === 0 ? "eager" : "lazy"
            }
            if (isHero) properties.fetchPriority ??= "high"
            contentImageIndex += 1

            if (!absoluteAsset) return
            if (!String(properties.alt ?? "").trim()) {
              const alt = byAbsoluteAsset.get(absoluteAsset)
              if (alt) properties.alt = alt
            }

            if (properties.width === undefined || properties.height === undefined) {
              const size = imageDimensions(absoluteAsset)
              if (size) {
                properties.width ??= size.width
                properties.height ??= size.height
              }
            }
          })
        },
      ]
    },
  }
}
