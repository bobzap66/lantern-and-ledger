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

          visit(tree, "element", (node: Element) => {
            if (node.tagName !== "img") return
            const properties = (node.properties ??= {})
            if (String(properties.alt ?? "").trim()) return
            const src = typeof properties.src === "string" ? properties.src : undefined
            if (!src) return
            const absoluteAsset = resolveImagePath(vaultRoot, sourcePath, src)
            if (!absoluteAsset) return
            const alt = byAbsoluteAsset.get(absoluteAsset)
            if (alt) properties.alt = alt
          })
        },
      ]
    },
  }
}
