import fs from "node:fs"
import path from "node:path"
import YAML from "yaml"
import { QuartzTransformerPlugin } from "../types"
import { simplifySlug, slugifyFilePath } from "../../util/path"

const CARD_CSS = `
.isr-npc-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 18rem), 1fr));
  gap: 0.8rem;
  margin: 1rem 0 2.25rem;
}

.isr-npc-card {
  --npc-card-accent: var(--campaign-page-accent, var(--tertiary));
  --npc-card-rule: var(--campaign-page-rule, var(--lightgray));
  overflow: hidden;
  min-width: 0;
  border: 1px solid var(--npc-card-rule);
  border-left: 3px solid var(--npc-card-accent);
  border-radius: 0.45rem;
  background: color-mix(in srgb, var(--light) 94%, var(--npc-card-accent) 6%);
  box-shadow: 0 0.12rem 0.5rem color-mix(in srgb, var(--dark) 9%, transparent);
  transition: transform 120ms ease, box-shadow 120ms ease, border-color 120ms ease;
}

.isr-npc-card:hover {
  border-color: color-mix(in srgb, var(--npc-card-accent) 58%, var(--npc-card-rule) 42%);
  box-shadow: 0 0.28rem 0.8rem color-mix(in srgb, var(--dark) 14%, transparent);
  transform: translateY(-2px);
}

.isr-npc-card > a {
  display: grid;
  min-height: 7.4rem;
  grid-template-columns: 6rem minmax(0, 1fr);
  color: inherit;
  text-decoration: none;
}

.isr-npc-card-image,
.isr-npc-card-placeholder {
  width: 6rem;
  height: 100%;
  min-height: 7.4rem;
  margin: 0;
  object-fit: cover;
  object-position: top center;
  background: color-mix(in srgb, var(--lightgray) 72%, var(--npc-card-accent) 28%);
}

.isr-npc-card-placeholder {
  display: grid;
  place-items: center;
  color: color-mix(in srgb, var(--npc-card-accent) 76%, var(--dark) 24%);
  font-family: var(--headerFont);
  font-size: 1.75rem;
  font-weight: 700;
}

.isr-npc-card-copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  padding: 0.72rem 0.8rem 0.7rem;
}

.isr-npc-card-name {
  margin: 0;
  color: var(--dark);
  font-family: var(--headerFont);
  font-size: 1.04rem;
  font-weight: 700;
  line-height: 1.15;
}

.isr-npc-card-subtitle {
  margin: 0.18rem 0 0;
  color: var(--npc-card-accent);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.045em;
  line-height: 1.25;
  text-transform: uppercase;
}

.isr-npc-card-description {
  display: -webkit-box;
  margin: 0.38rem 0 0;
  overflow: hidden;
  color: var(--darkgray);
  font-size: 0.82rem;
  line-height: 1.35;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.isr-npc-card-meta {
  display: flex;
  gap: 0.45rem;
  align-items: center;
  margin-top: auto;
  padding-top: 0.5rem;
  color: var(--gray);
  font-size: 0.7rem;
}

.isr-npc-card-status {
  padding: 0.08rem 0.38rem;
  border: 1px solid color-mix(in srgb, var(--npc-card-accent) 68%, transparent);
  border-radius: 999px;
  color: color-mix(in srgb, var(--npc-card-accent) 78%, var(--dark) 22%);
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

@media (max-width: 520px) {
  .isr-npc-grid {
    grid-template-columns: 1fr;
    gap: 0.62rem;
  }

  .isr-npc-card > a {
    grid-template-columns: 5rem minmax(0, 1fr);
    min-height: 6.5rem;
  }

  .isr-npc-card-image,
  .isr-npc-card-placeholder {
    width: 5rem;
    min-height: 6.5rem;
  }

  .isr-npc-card-copy {
    padding: 0.62rem 0.7rem;
  }
}
`

type NpcNote = {
  absolutePath: string
  relativePath: string
  slug: any
  frontmatter: Record<string, any>
  description: string
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
}

function encodeRelativeUrl(value: string) {
  return value.replaceAll("\\", "/").split("/").map((segment) =>
    segment === "." || segment === ".." ? segment : encodeURIComponent(segment)
  ).join("/")
}

function readSource(filePath: string) {
  try { return fs.readFileSync(filePath, "utf8") } catch { return "" }
}

function readFrontmatter(source: string): Record<string, any> {
  try {
    const match = source.match(/^---\s*\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)
    return match ? YAML.parse(match[1]) ?? {} : {}
  } catch {
    return {}
  }
}

function plainText(value: string) {
  return value
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_`>#]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

function firstBodyParagraph(source: string) {
  const body = source.replace(/^---\s*\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, "")
  const paragraphs = body.split(/\r?\n\s*\r?\n/)
  for (const paragraph of paragraphs) {
    const trimmed = paragraph.trim()
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("![](") || trimmed.startsWith("```")) continue
    const text = plainText(trimmed)
    if (text) return text
  }
  return ""
}

function shortDescription(source: string, fm: Record<string, any>) {
  const explicit = [fm.card_description, fm.card_summary, fm.summary, fm.description]
    .find((value) => typeof value === "string" && value.trim())
  if (explicit) return String(explicit).trim()

  const paragraph = firstBodyParagraph(source)
  if (!paragraph) return ""
  const sentence = paragraph.match(/^(.+?[.!?])(?:\s|$)/)?.[1] ?? paragraph
  return sentence.length > 175 ? `${sentence.slice(0, 172).trimEnd()}…` : sentence
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

function values(value: unknown): string[] {
  if (value == null) return []
  return (Array.isArray(value) ? value : [value])
    .map((item) => String(item).trim())
    .filter(Boolean)
}

function normalized(value: unknown): string[] {
  return values(value).map((item) => item.toLowerCase())
}

function matchesAny(source: unknown, wanted: unknown) {
  const targets = normalized(wanted)
  if (targets.length === 0) return true
  const available = normalized(source)
  return targets.some((target) => available.includes(target))
}

function titleMatches(title: string, wanted: unknown) {
  const targets = normalized(wanted)
  if (targets.length === 0) return true
  return targets.includes(title.trim().toLowerCase())
}

function subtitleFor(fm: Record<string, any>) {
  const value = fm.card_subtitle ?? fm.occupation ?? fm.title_role ?? fm.office ?? fm.npc_role
  if (Array.isArray(value)) return value.map(String).filter(Boolean).join(" · ")
  return typeof value === "string" ? value.trim() : ""
}

function initials(title: string) {
  return title.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]?.toUpperCase() ?? "").join("") || "?"
}

export const NpcCards: QuartzTransformerPlugin = () => {
  let root = ""
  let npcs: NpcNote[] = []

  const ensureIndex = (vaultRoot: string) => {
    if (root === vaultRoot && npcs.length > 0) return
    root = vaultRoot
    npcs = markdownFiles(vaultRoot).flatMap((absolutePath) => {
      const source = readSource(absolutePath)
      const frontmatter = readFrontmatter(source)
      const relativePath = path.relative(vaultRoot, absolutePath).replaceAll("\\", "/")
      const isPerson = String(frontmatter?.type ?? "").toLowerCase() === "person"
      const hasNpcRole = frontmatter?.npc_role != null
      const explicitNpc = String(frontmatter?.role ?? "").toLowerCase() === "non-player-character"
      const inNpcFolder = relativePath.split("/").some((segment) => segment.toLowerCase() === "npcs")
      if (!isPerson || (!explicitNpc && !hasNpcRole && !inNpcFolder)) return []
      return [{
        absolutePath,
        relativePath,
        slug: simplifySlug(slugifyFilePath(relativePath as any)),
        frontmatter,
        description: shortDescription(source, frontmatter),
      }]
    })
  }

  return {
    name: "NpcCards",
    markdownPlugins(ctx) {
      return [() => (tree: any, file: any) => {
        const sourcePath = file.path || file.data?.filePath
        if (!sourcePath || !Array.isArray(tree?.children)) return
        const vaultRoot = path.resolve(ctx.argv.directory)
        ensureIndex(vaultRoot)

        const absoluteSource = path.resolve(sourcePath)
        const relativeSource = path.relative(vaultRoot, absoluteSource).replaceAll("\\", "/")
        const sourceDirectory = path.dirname(absoluteSource)
        const currentDirectory = path.dirname(relativeSource).replaceAll("\\", "/")

        tree.children = tree.children.map((node: any) => {
          if (node?.type !== "code" || String(node.lang ?? "").toLowerCase() !== "npc-cards") return node

          let query: Record<string, any> = {}
          try { query = YAML.parse(String(node.value ?? "")) ?? {} } catch { query = {} }
          const wantedStatus = query.status ?? query.npc_status
          const wantedRoles = query.npc_role ?? query.npc_roles
          const wantedAffiliations = query.affiliation ?? query.affiliations ?? query.npc_affiliation ?? query.npc_affiliations
          const include = query.include
          const exclude = query.exclude
          const recursive = query.recursive === true

          const cards = npcs
            .filter((npc) => {
              const npcDirectory = path.dirname(npc.relativePath).replaceAll("\\", "/")
              return npcDirectory === currentDirectory || (recursive && npcDirectory.startsWith(`${currentDirectory}/`))
            })
            .filter((npc) => {
              const title = String(npc.frontmatter?.title ?? path.basename(npc.relativePath, ".md"))
              return titleMatches(title, include)
            })
            .filter((npc) => {
              const title = String(npc.frontmatter?.title ?? path.basename(npc.relativePath, ".md"))
              const excluded = normalized(exclude)
              return excluded.length === 0 || !excluded.includes(title.trim().toLowerCase())
            })
            .filter((npc) => matchesAny(npc.frontmatter?.status ?? npc.frontmatter?.npc_status, wantedStatus))
            .filter((npc) => matchesAny(npc.frontmatter?.npc_role, wantedRoles))
            .filter((npc) => matchesAny(npc.frontmatter?.npc_affiliations, wantedAffiliations))
            .sort((a, b) => Number(a.frontmatter?.card_order ?? 999) - Number(b.frontmatter?.card_order ?? 999) || String(a.frontmatter?.title ?? "").localeCompare(String(b.frontmatter?.title ?? "")))
            .map((npc) => {
              const fm = npc.frontmatter
              const title = String(fm.title ?? path.basename(npc.relativePath, ".md"))
              const portrait = typeof fm.portrait === "string" ? fm.portrait : undefined
              const subtitle = subtitleFor(fm)
              const statusValue = fm.status ?? fm.npc_status
              const status = typeof statusValue === "string" ? statusValue : ""
              const npcDirectory = path.dirname(npc.relativePath).replaceAll("\\", "/")
              const nestedPath = path.posix.relative(currentDirectory, npc.relativePath.replace(/\.md$/i, ""))
              const slugText = String(npc.slug).replaceAll("\\", "/")
              const href = npcDirectory === currentDirectory
                ? `./${escapeHtml(slugText.split("/").pop() ?? slugText)}`
                : `./${escapeHtml(encodeRelativeUrl(nestedPath))}`
              const image = portrait
                ? `<img class="isr-npc-card-image" src="${encodeRelativeUrl(path.relative(sourceDirectory, path.resolve(vaultRoot, portrait)))}" alt="Portrait of ${escapeHtml(title)}" loading="lazy" decoding="async">`
                : `<div class="isr-npc-card-placeholder" aria-hidden="true">${escapeHtml(initials(title))}</div>`

              return [
                '<article class="isr-npc-card">',
                `<a href="${href}" aria-label="Open ${escapeHtml(title)} record">`,
                image,
                '<div class="isr-npc-card-copy">',
                `<p class="isr-npc-card-name">${escapeHtml(title)}</p>`,
                subtitle ? `<p class="isr-npc-card-subtitle">${escapeHtml(subtitle)}</p>` : "",
                npc.description ? `<p class="isr-npc-card-description">${escapeHtml(npc.description)}</p>` : "",
                status ? `<div class="isr-npc-card-meta"><span class="isr-npc-card-status">${escapeHtml(status)}</span></div>` : "",
                "</div>",
                "</a>",
                "</article>",
              ].join("\n")
            }).join("\n")

          return { type: "html", value: `<section class="isr-npc-grid" aria-label="NPC directory">\n${cards}\n</section>` }
        })
      }]
    },
    externalResources() {
      return { css: [{ content: CARD_CSS, inline: true }] }
    },
  }
}
