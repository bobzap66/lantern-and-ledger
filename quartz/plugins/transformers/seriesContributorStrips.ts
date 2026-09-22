import fs from "node:fs"
import path from "node:path"
import YAML from "yaml"
import { QuartzTransformerPlugin } from "../types"
import { simplifySlug, slugifyFilePath } from "../../util/path"

type SeriesContributor = {
  sourcePrefix: string
  profilePath: string
}

const SERIES_CONTRIBUTORS = new Map<string, SeriesContributor>([
  [
    "morlibint",
    {
      sourcePrefix: "Campaigns/Abomination Vaults/Chronicles of the New Roseguard/",
      profilePath: "The Lantern and Ledger/Staff/Morlibint.md",
    },
  ],
  [
    "tavian rusk",
    {
      sourcePrefix: "Campaigns/Claws of the Tyrant/Articles/",
      profilePath: "The Lantern and Ledger/Staff/Tavian Rusk.md",
    },
  ],
])

function readFrontmatter(filePath: string): Record<string, any> {
  try {
    const source = fs.readFileSync(filePath, "utf8")
    const match = source.match(/^---\s*\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)
    return match ? YAML.parse(match[1]) ?? {} : {}
  } catch {
    return {}
  }
}

function authorKey(value: unknown) {
  return String(value ?? "").trim().toLowerCase()
}

function contributorNames(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item ?? "").trim()).filter(Boolean)
  if (typeof value === "string" && value.trim()) return [value.trim()]
  return []
}

function initials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
}

function encodeRelativeUrl(value: string) {
  return value
    .replaceAll("\\", "/")
    .split("/")
    .map((segment) => (segment === "." || segment === ".." ? segment : encodeURIComponent(segment)))
    .join("/")
}

function relativeSlugHref(fromRelativePath: string, toRelativePath: string) {
  const fromSlug = simplifySlug(slugifyFilePath(fromRelativePath as any))
  const toSlug = simplifySlug(slugifyFilePath(toRelativePath as any))
  const normalizedFromSlug = String(fromSlug).replaceAll("\\", "/")
  const isIndex = path.posix.basename(fromRelativePath).toLowerCase() === "index.md"
  const fromDirectory = isIndex ? normalizedFromSlug : path.posix.dirname(normalizedFromSlug)
  let href = path.posix.relative(fromDirectory, String(toSlug).replaceAll("\\", "/"))
  if (!href.startsWith(".")) href = `./${href}`
  return href
}

export const SeriesContributorStrips: QuartzTransformerPlugin = () => ({
  name: "SeriesContributorStrips",
  markdownPlugins(ctx) {
    return [() => (tree: any, file: any) => {
      const sourcePath = file.path || file.data?.filePath
      if (!sourcePath || !Array.isArray(tree?.children)) return

      const vaultRoot = path.resolve(ctx.argv.directory)
      const absoluteSource = path.resolve(sourcePath)
      const relativeSource = path.relative(vaultRoot, absoluteSource).replaceAll("\\", "/")
      const sourceFm = readFrontmatter(absoluteSource)

      if (String(sourceFm?.type ?? "").trim().toLowerCase() !== "session-note") return

      const contributor = SERIES_CONTRIBUTORS.get(authorKey(sourceFm?.author))
      if (!contributor || !relativeSource.startsWith(contributor.sourcePrefix)) return

      // If the note already declares contributors, the normal author-card transformer owns the strip.
      if (contributorNames(sourceFm?.contributors).length > 0) return

      const profileAbsolute = path.resolve(vaultRoot, contributor.profilePath)
      const profileFm = readFrontmatter(profileAbsolute)
      const name = String(profileFm?.title ?? sourceFm?.author ?? "Contributor")
      const role = typeof profileFm?.role === "string" ? profileFm.role : ""
      const portrait = typeof profileFm?.portrait === "string" ? profileFm.portrait : ""
      const href = relativeSlugHref(relativeSource, contributor.profilePath)
      const sourceDirectory = path.dirname(absoluteSource)

      const imageHtml = portrait
        ? `<img class="isr-contributor-portrait" src="${encodeRelativeUrl(path.relative(sourceDirectory, path.resolve(vaultRoot, portrait)))}" alt="Portrait of ${escapeHtml(name)}">`
        : `<span class="isr-contributor-initials" aria-hidden="true">${escapeHtml(initials(name))}</span>`

      const contributorStrip = [
        '<aside class="isr-contributors" aria-label="Contributors">',
        '<p class="isr-contributors-label">Contributors</p>',
        '<div class="isr-contributors-list">',
        `<a class="isr-contributor" href="${escapeHtml(href)}">`,
        imageHtml,
        '<span class="isr-contributor-copy">',
        `<span class="isr-contributor-name">${escapeHtml(name)}</span>`,
        role ? `<span class="isr-contributor-role">${escapeHtml(role)}</span>` : "",
        "</span>",
        "</a>",
        "</div>",
        "</aside>",
      ].filter(Boolean).join("\n")

      const firstBreak = tree.children.findIndex((node: any) => node?.type === "thematicBreak")
      const insertAt = firstBreak >= 0 ? firstBreak + 1 : 0
      tree.children.splice(insertAt, 0, { type: "html", value: contributorStrip })
    }]
  },
})
