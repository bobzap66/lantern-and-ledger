import fs from "node:fs"
import path from "node:path"
import YAML from "yaml"
import { QuartzTransformerPlugin } from "../types"
import { simplifySlug, slugifyFilePath } from "../../util/path"

const CSS = `
.character-vignettes-inline {
  margin: 0.35rem 0 1.15rem;
  font-size: 0.92rem;
}

.character-vignettes-inline a {
  font-weight: 600;
  text-decoration: none;
}

.vignette-navigation-inline {
  margin: 2.25rem 0 0.75rem;
  padding-top: 1.25rem;
  border-top: 1px solid var(--lightgray);
}

.vignette-nav-grid-inline {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(11rem, 0.9fr) minmax(0, 1fr);
  gap: 0.8rem;
  align-items: stretch;
}

.vignette-nav-item-inline,
.vignette-nav-back-inline {
  display: flex;
  min-width: 0;
  flex-direction: column;
  justify-content: center;
  padding: 0.75rem 0.85rem;
  border: 1px solid var(--lightgray);
  border-radius: 0.55rem;
  background: color-mix(in srgb, var(--light) 94%, var(--lightgray) 6%);
  color: inherit;
  text-decoration: none;
}

.vignette-nav-item-inline:hover,
.vignette-nav-back-inline:hover {
  border-color: var(--secondary);
}

.vignette-nav-next-inline { text-align: right; }
.vignette-nav-back-inline { text-align: center; }

.vignette-nav-label-inline {
  color: var(--gray);
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.065em;
  text-transform: uppercase;
}

.vignette-nav-title-inline {
  margin-top: 0.18rem;
  font-family: var(--headerFont);
  font-size: 0.94rem;
  font-weight: 700;
  line-height: 1.25;
}

.vignette-nav-date-inline {
  margin-top: 0.18rem;
  color: var(--gray);
  font-size: 0.74rem;
}

.vignette-nav-empty-inline { visibility: hidden; }

@media (max-width: 700px) {
  .vignette-nav-grid-inline {
    grid-template-columns: 1fr 1fr;
  }

  .vignette-nav-back-inline {
    grid-column: 1 / -1;
    grid-row: 1;
  }

  .vignette-nav-previous-inline { grid-column: 1; }
  .vignette-nav-next-inline { grid-column: 2; }
}
`

type Note = {
  absolutePath: string
  relativePath: string
  slug: any
  frontmatter: Record<string, any>
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
}

function readFrontmatter(filePath: string): Record<string, any> {
  try {
    const source = fs.readFileSync(filePath, "utf8")
    const match = source.match(/^---\s*\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)
    return match ? YAML.parse(match[1]) ?? {} : {}
  } catch {
    return {}
  }
}

function markdownFiles(directory: string): string[] {
  const result: string[] = []
  const visit = (current: string) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue
      const full = path.join(current, entry.name)
      if (entry.isDirectory()) visit(full)
      else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) result.push(full)
    }
  }
  visit(directory)
  return result
}

function wikilinkTarget(value: unknown) {
  if (typeof value !== "string") return ""
  const text = value.trim()
  const match = text.match(/^\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]$/)
  return (match ? match[1] : text).trim().replaceAll("\\", "/").replace(/\.md$/i, "")
}

function characterKey(value: unknown) {
  const target = wikilinkTarget(value)
  return target ? target.split("/").filter(Boolean).at(-1)?.toLowerCase() ?? "" : ""
}

function relativeSlugHref(fromRelativePath: string, toSlug: any) {
  const normalizedSourcePath = fromRelativePath.replaceAll("\\", "/")
  const sourceDirectory = path.posix.dirname(normalizedSourcePath)
  const directoryIndexPath = sourceDirectory === "." ? "index.md" : `${sourceDirectory}/index.md`
  const fromDirectorySlug = simplifySlug(slugifyFilePath(directoryIndexPath as any))
  const normalizedFromDirectory = String(fromDirectorySlug).replaceAll("\\", "/")
  const normalizedTarget = String(toSlug).replaceAll("\\", "/")
  let href = path.posix.relative(normalizedFromDirectory, normalizedTarget)
  if (!href || href === ".") return "./"
  if (!href.startsWith(".")) href = `./${href}`
  return href
}

function dateRank(frontmatter: Record<string, any>) {
  if (String(frontmatter?.date_status ?? "").toLowerCase() === "uncertain") return Number.MAX_SAFE_INTEGER
  const raw = String(frontmatter?.date ?? "").trim()
  if (raw) {
    const parsed = Date.parse(raw)
    if (Number.isFinite(parsed)) return 1_000_000_000_000_000 + parsed
  }

  const months = ["Abadius", "Calistril", "Pharast", "Gozran", "Desnus", "Sarenith", "Erastus", "Arodus", "Rova", "Lamashan", "Neth", "Kuthona"]
  const campaign = String(frontmatter?.campaign_date_name ?? "").trim()
  const dayMatch = campaign.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})\s+AR$/)
  const monthMatch = campaign.match(/^([A-Za-z]+)\s+(\d{4})\s+AR$/)
  if (dayMatch) {
    const month = months.findIndex((value) => value.toLowerCase() === dayMatch[2].toLowerCase()) + 1
    return Number(dayMatch[3]) * 10000 + month * 100 + Number(dayMatch[1])
  }
  if (monthMatch) {
    const month = months.findIndex((value) => value.toLowerCase() === monthMatch[1].toLowerCase()) + 1
    return Number(monthMatch[2]) * 10000 + month * 100
  }
  return Number.MAX_SAFE_INTEGER
}

function archiveForCharacter(note: Note, allNotes: Note[]) {
  const configured = typeof note.frontmatter?.vignette_index === "string"
    ? note.frontmatter.vignette_index.trim().replace(/^\/+|\/+$/g, "").toLowerCase()
    : ""
  if (configured) {
    const match = allNotes.find((candidate) => String(candidate.slug).toLowerCase() === configured)
    if (match) return match
  }

  const pageSlug = String(note.slug)
  const marker = "/characters/"
  const markerIndex = pageSlug.indexOf(marker)
  if (markerIndex === -1) return undefined
  const campaignRoot = pageSlug.slice(0, markerIndex)
  const characterPath = pageSlug.slice(markerIndex + marker.length)
  const characterSegment = characterPath.split("/").filter(Boolean).at(-1)
  if (!characterSegment) return undefined

  const candidates = [
    `${campaignRoot}/vignettes/${characterPath}`,
    `${campaignRoot}/vignettes/${characterPath}/${characterSegment}`,
  ]
  return allNotes.find((candidate) => candidates.includes(String(candidate.slug)))
}

function archiveForVignette(note: Note, allNotes: Note[]) {
  const directory = path.posix.dirname(note.relativePath)
  const directoryName = path.posix.basename(directory).toLowerCase()
  return allNotes.find((candidate) => {
    if (path.posix.dirname(candidate.relativePath) !== directory) return false
    const base = path.posix.basename(candidate.relativePath, ".md").toLowerCase()
    const type = String(candidate.frontmatter?.type ?? "").toLowerCase()
    return type === "index" && (base === "index" || base === directoryName)
  })
}

function navItem(source: Note, target: Note | undefined, direction: "previous" | "next") {
  if (!target) return `<span class="vignette-nav-item-inline vignette-nav-${direction}-inline vignette-nav-empty-inline" aria-hidden="true"></span>`
  const title = String(target.frontmatter?.title ?? path.posix.basename(target.relativePath, ".md"))
  const date = String(target.frontmatter?.date ?? target.frontmatter?.campaign_date_name ?? "").trim()
  const href = relativeSlugHref(source.relativePath, target.slug)
  return [
    `<a href="${escapeHtml(href)}" class="vignette-nav-item-inline vignette-nav-${direction}-inline internal">`,
    `<span class="vignette-nav-label-inline">${direction === "previous" ? "← Previous" : "Next →"}</span>`,
    `<span class="vignette-nav-title-inline">${escapeHtml(title)}</span>`,
    date ? `<span class="vignette-nav-date-inline">${escapeHtml(date)}</span>` : "",
    "</a>",
  ].join("\n")
}

export const VignetteLinks: QuartzTransformerPlugin = () => {
  let root = ""
  let allNotes: Note[] = []

  const ensureIndex = (vaultRoot: string) => {
    if (root === vaultRoot && allNotes.length > 0) return
    root = vaultRoot
    allNotes = markdownFiles(vaultRoot).map((absolutePath) => {
      const relativePath = path.relative(vaultRoot, absolutePath).replaceAll("\\", "/")
      return {
        absolutePath,
        relativePath,
        slug: simplifySlug(slugifyFilePath(relativePath as any)),
        frontmatter: readFrontmatter(absolutePath),
      }
    })
  }

  return {
    name: "VignetteLinks",
    markdownPlugins(ctx) {
      return [() => (tree: any, file: any) => {
        const sourcePath = file.path || file.data?.filePath
        if (!sourcePath || !Array.isArray(tree?.children)) return

        const vaultRoot = path.resolve(ctx.argv.directory)
        ensureIndex(vaultRoot)
        const absoluteSource = path.resolve(sourcePath)
        const relativeSource = path.relative(vaultRoot, absoluteSource).replaceAll("\\", "/")
        const current = allNotes.find((note) => path.resolve(note.absolutePath) === absoluteSource)
        if (!current) return

        const lowerPath = relativeSource.toLowerCase()
        const fm = current.frontmatter

        if (lowerPath.includes("/characters/") && path.posix.basename(relativeSource).toLowerCase() !== "index.md") {
          const archive = archiveForCharacter(current, allNotes)
          if (archive) {
            const href = relativeSlugHref(relativeSource, archive.slug)
            const html = `<p class="character-vignettes-inline"><a href="${escapeHtml(href)}" class="internal">Character Vignettes →</a></p>`
            const firstHeading = tree.children.findIndex((node: any) => node?.type === "heading" && node.depth === 1)
            tree.children.splice(firstHeading >= 0 ? firstHeading + 1 : 0, 0, { type: "html", value: html })
          }
        }

        if (!lowerPath.includes("/vignettes/") || String(fm?.type ?? "").toLowerCase() !== "vignette") return

        const key = characterKey(fm.character)
        const directory = path.posix.dirname(relativeSource)
        let siblings = allNotes
          .filter((note) => String(note.frontmatter?.type ?? "").toLowerCase() === "vignette")
          .filter((note) => key ? characterKey(note.frontmatter?.character) === key : path.posix.dirname(note.relativePath) === directory)

        if (siblings.length <= 1 && key) {
          siblings = allNotes
            .filter((note) => String(note.frontmatter?.type ?? "").toLowerCase() === "vignette")
            .filter((note) => path.posix.dirname(note.relativePath) === directory)
        }

        siblings.sort((a, b) => {
          const dateDiff = dateRank(a.frontmatter) - dateRank(b.frontmatter)
          if (dateDiff !== 0) return dateDiff
          return String(a.frontmatter?.title ?? a.relativePath).localeCompare(String(b.frontmatter?.title ?? b.relativePath))
        })

        const currentIndex = siblings.findIndex((note) => note.relativePath === relativeSource)
        if (currentIndex === -1) return
        const previous = currentIndex > 0 ? siblings[currentIndex - 1] : undefined
        const next = currentIndex < siblings.length - 1 ? siblings[currentIndex + 1] : undefined
        const archive = archiveForVignette(current, allNotes)

        const characterName = String(fm.character ?? path.posix.basename(directory))
          .replace(/^\[\[/, "")
          .replace(/\]\]$/, "")
          .split("|").at(-1)
          ?.trim() || path.posix.basename(directory)

        const back = archive
          ? [
              `<a href="${escapeHtml(relativeSlugHref(relativeSource, archive.slug))}" class="vignette-nav-back-inline internal">`,
              '<span class="vignette-nav-label-inline">Vignette Archive</span>',
              `<span class="vignette-nav-title-inline">Back to ${escapeHtml(characterName)} Vignettes</span>`,
              "</a>",
            ].join("\n")
          : '<span class="vignette-nav-back-inline vignette-nav-empty-inline" aria-hidden="true"></span>'

        const nav = [
          '<nav class="vignette-navigation-inline" aria-label="Vignette navigation">',
          '<div class="vignette-nav-grid-inline">',
          navItem(current, previous, "previous"),
          back,
          navItem(current, next, "next"),
          "</div>",
          "</nav>",
        ].join("\n")

        tree.children.push({ type: "html", value: nav })
      }]
    },
    externalResources() {
      return { css: [{ content: CSS, inline: true }] }
    },
  }
}
