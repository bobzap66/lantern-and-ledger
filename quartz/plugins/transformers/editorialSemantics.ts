import { Root, RootContent } from "hast"
import { QuartzTransformerPlugin } from "../types"

const EDITORIAL_TYPES = new Set([
  "article",
  "chronicle",
  "newspaper",
  "oral history",
  "report",
  "session",
  "session note",
  "vignette",
])

function normalize(value: unknown) {
  return String(value ?? "")
    .replace(/[\u00a0_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
}

function textContent(node: RootContent): string {
  if (node.type === "text") return node.value
  if ("children" in node) return node.children.map(textContent).join("")
  return ""
}

function removeDuplicateTitle(nodes: RootContent[], title: string): boolean {
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index]
    if (
      node.type === "element" &&
      node.tagName === "h1" &&
      normalize(textContent(node)) === title
    ) {
      nodes.splice(index, 1)
      return true
    }

    if (node.type === "element" && removeDuplicateTitle(node.children, title)) return true
  }
  return false
}

function cleanInlineMarkdown(value: string) {
  return value
    .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2")
    .replace(/\[\[([^\]]+)\]\]/g, (_, target: string) => target.split("/").at(-1) ?? target)
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_`]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

function truncate(value: string, limit = 220) {
  if (value.length <= limit) return value
  const candidate = value.slice(0, limit + 1)
  const sentenceEnd = Math.max(
    candidate.lastIndexOf(". "),
    candidate.lastIndexOf("! "),
    candidate.lastIndexOf("? "),
  )
  if (sentenceEnd >= 100) return candidate.slice(0, sentenceEnd + 1).trim()
  const wordEnd = candidate.lastIndexOf(" ")
  return `${candidate.slice(0, wordEnd >= 120 ? wordEnd : limit).trim()}…`
}

export function descriptionFromMarkdown(source: string) {
  const body = source
    .replace(/^---\s*\r?\n[\s\S]*?\r?\n---\s*/m, "")
    .replace(/<!--([\s\S]*?)-->/g, "")

  for (const paragraph of body.split(/\r?\n\s*\r?\n/)) {
    const raw = paragraph.trim()
    if (!raw || /^(?:#{1,6}\s|!\[|>|```|~~~|---\s*$|<)/.test(raw)) continue
    if (raw.split(/\r?\n/).some((line) => /^\s*(?:#{1,6}\s|!\[|>|```|~~~|<)/.test(line))) {
      continue
    }

    const description = truncate(cleanInlineMarkdown(raw))
    if (description.length < 80) continue
    if (
      /^(?:by|recorded and arranged by|testimony of|the lantern and ledger)\b/i.test(description)
    ) {
      continue
    }
    if (/\bpublished in\b/i.test(description) && /\bprice\b/i.test(description)) continue
    return description
  }

  return ""
}

function isEditorial(frontmatter: Record<string, unknown>, slug: string) {
  const type = normalize(frontmatter.type)
  const format = normalize(frontmatter.format)
  const title = normalize(frontmatter.title)
  return (
    EDITORIAL_TYPES.has(type) ||
    EDITORIAL_TYPES.has(format) ||
    /^session\s+\d+/.test(title) ||
    /\/(?:session notes|vignettes)\//.test(normalize(slug))
  )
}

export const EditorialSemantics: QuartzTransformerPlugin = () => ({
  name: "EditorialSemantics",
  htmlPlugins() {
    return [
      () => (tree: Root, file) => {
        const data = file.data as {
          slug?: string
          frontmatter?: Record<string, unknown>
        }
        const frontmatter = data.frontmatter
        if (!frontmatter || !isEditorial(frontmatter, data.slug ?? "")) return

        const title = normalize(frontmatter.title)
        if (title) removeDuplicateTitle(tree.children, title)

        if (!frontmatter.socialDescription && !frontmatter.description) {
          const description = descriptionFromMarkdown(String(file.value ?? ""))
          if (description) frontmatter.socialDescription = description
        }
      },
    ]
  },
})
