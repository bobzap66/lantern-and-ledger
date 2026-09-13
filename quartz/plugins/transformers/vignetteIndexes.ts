import path from "node:path"
import { QuartzTransformerPlugin } from "../types"
import {
  VignetteNote,
  archiveForCharacter,
  indexVignetteNotes,
  isCharacterNote,
  isVignetteArchive,
  relativeSlugHref as sharedRelativeSlugHref,
  vignetteDate,
  vignettesForArchive,
  wikilinkLabel,
} from "../../util/vignettes"

const VIGNETTE_INDEX_CSS = `
.isr-vignette-archive-hero {
  display: grid;
  grid-template-columns: 7rem minmax(0, 1fr);
  gap: 1rem;
  align-items: center;
  margin: 1rem 0 1.35rem;
  padding: 1rem;
  border: 1px solid var(--lightgray);
  border-radius: 0.75rem;
  background: color-mix(in srgb, var(--light) 92%, var(--lightgray) 8%);
  box-shadow: 0 0.14rem 0.5rem color-mix(in srgb, var(--dark) 9%, transparent);
}

.isr-vignette-archive-portrait,
.isr-vignette-archive-placeholder {
  width: 7rem;
  height: 7rem;
  margin: 0;
  border-radius: 0.65rem;
  object-fit: cover;
  object-position: top center;
  background: var(--lightgray);
}

.isr-vignette-archive-placeholder {
  display: grid;
  place-items: center;
  color: var(--gray);
  font-family: var(--headerFont);
  font-size: 1.8rem;
  font-weight: 700;
}

.isr-vignette-archive-copy { min-width: 0; }

.isr-vignette-archive-eyebrow {
  margin: 0 0 0.2rem;
  color: var(--gray);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.09em;
  text-transform: uppercase;
}

.isr-vignette-archive-name {
  margin: 0;
  font-family: var(--headerFont);
  font-size: 1.35rem;
  font-weight: 700;
  line-height: 1.15;
}

.isr-vignette-archive-name a {
  color: inherit;
  text-decoration: none;
}

.isr-vignette-archive-name a:hover { text-decoration: underline; }

.isr-vignette-archive-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 0.7rem;
  margin-top: 0.45rem;
  color: var(--gray);
  font-size: 0.84rem;
}

.isr-vignette-year {
  margin: 1.9rem 0 0;
}

.isr-vignette-year-heading {
  display: flex;
  gap: 0.65rem;
  align-items: baseline;
  margin-bottom: 0.75rem;
  padding-bottom: 0.35rem;
  border-bottom: 1px solid var(--lightgray);
}

.isr-vignette-year-heading h2 {
  margin: 0;
  font-size: 1.25rem;
}

.isr-vignette-year-count {
  color: var(--gray);
  font-size: 0.78rem;
}

.isr-vignette-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.65rem;
}

.isr-vignette-entry {
  display: grid;
  grid-template-columns: 4.8rem minmax(0, 1fr);
  gap: 0.75rem;
  align-items: center;
  min-height: 4rem;
  padding: 0.7rem 0.8rem;
  border: 1px solid var(--lightgray);
  border-radius: 0.6rem;
  background: color-mix(in srgb, var(--light) 96%, var(--lightgray) 4%);
  color: inherit;
  text-decoration: none;
  transition: transform 120ms ease, box-shadow 120ms ease, border-color 120ms ease;
}

.isr-vignette-entry:hover {
  transform: translateY(-1px);
  border-color: var(--secondary);
  box-shadow: 0 0.16rem 0.45rem color-mix(in srgb, var(--dark) 10%, transparent);
}

.isr-vignette-entry-date {
  color: var(--gray);
  font-size: 0.76rem;
  font-weight: 700;
  line-height: 1.2;
  text-transform: uppercase;
  letter-spacing: 0.035em;
}

.isr-vignette-entry-title {
  display: block;
  font-family: var(--headerFont);
  font-size: 0.98rem;
  font-weight: 700;
  line-height: 1.25;
}

.isr-vignette-entry-author {
  display: block;
  margin-top: 0.18rem;
  color: var(--gray);
  font-size: 0.75rem;
  line-height: 1.2;
}

@media (max-width: 700px) {
  .isr-vignette-archive-hero {
    grid-template-columns: 5.25rem minmax(0, 1fr);
    gap: 0.8rem;
    padding: 0.8rem;
  }

  .isr-vignette-archive-portrait,
  .isr-vignette-archive-placeholder {
    width: 5.25rem;
    height: 5.25rem;
  }

  .isr-vignette-grid { grid-template-columns: 1fr; }
  .isr-vignette-entry { grid-template-columns: 4.4rem minmax(0, 1fr); }
}
`

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

function basenameWithoutExtension(value: string) {
  return path.posix.basename(value.replaceAll("\\", "/")).replace(/\.md$/i, "")
}

function initials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
}

export const VignetteIndexes: QuartzTransformerPlugin = () => {
  let root = ""
  let allNotes: VignetteNote[] = []

  const ensureIndex = (vaultRoot: string) => {
    if (root === vaultRoot && allNotes.length > 0) return
    root = vaultRoot
    allNotes = indexVignetteNotes(vaultRoot)
  }

  return {
    name: "VignetteIndexes",
    markdownPlugins(ctx) {
      return [
        () => (tree: any, file: any) => {
          const sourcePath = file.path || file.data?.filePath
          if (!sourcePath || !Array.isArray(tree?.children)) return

          const vaultRoot = path.resolve(ctx.argv.directory)
          ensureIndex(vaultRoot)

          const absoluteSource = path.resolve(sourcePath)
          const relativeSource = path.relative(vaultRoot, absoluteSource).replaceAll("\\", "/")
          const current = allNotes.find(
            (note) => path.resolve(note.absolutePath) === absoluteSource,
          )
          if (!current || !isVignetteArchive(current)) return
          const sourceFm = current.frontmatter

          const entries = vignettesForArchive(current, allNotes)
            .map((note) => ({ note, date: vignetteDate(note.frontmatter, note.relativePath) }))
            .sort(
              (a, b) =>
                a.date.sortGroup - b.date.sortGroup ||
                a.date.rank - b.date.rank ||
                String(a.note.frontmatter?.title ?? "").localeCompare(
                  String(b.note.frontmatter?.title ?? ""),
                ),
            )

          if (entries.length === 0) return

          const characterName = wikilinkLabel(sourceFm.character, "Character")
          const characterNote = allNotes.find(
            (note) =>
              isCharacterNote(note) &&
              archiveForCharacter(note, allNotes)?.relativePath === current.relativePath,
          )
          const characterFm = characterNote?.frontmatter ?? {}
          const portrait =
            typeof characterFm.portrait === "string" ? characterFm.portrait.trim() : ""
          const characterHref = characterNote
            ? sharedRelativeSlugHref(relativeSource, characterNote.slug)
            : ""

          const authors = [
            ...new Set(
              entries
                .map(({ note }) => String(note.frontmatter?.author ?? "").trim())
                .filter(Boolean),
            ),
          ]
          const commonAuthor = authors.length === 1 ? authors[0] : ""
          const publishedEntries = entries.filter((entry) => entry.date.kind === "publication")
          const firstYear = publishedEntries[0]?.date.year ?? ""
          const lastYear = publishedEntries.at(-1)?.date.year ?? ""
          const range =
            firstYear && lastYear
              ? firstYear === lastYear
                ? firstYear
                : `${firstYear}–${lastYear}`
              : ""

          const portraitHtml = portrait
            ? `<img class="isr-vignette-archive-portrait" src="${escapeHtml(encodeRelativeUrl(path.relative(path.dirname(absoluteSource), path.resolve(vaultRoot, portrait))))}" alt="Portrait of ${escapeHtml(characterName)}">`
            : `<div class="isr-vignette-archive-placeholder" aria-hidden="true">${escapeHtml(initials(characterName))}</div>`

          const hero = [
            '<section class="isr-vignette-archive-hero" aria-label="Vignette archive summary">',
            portraitHtml,
            '<div class="isr-vignette-archive-copy">',
            '<p class="isr-vignette-archive-eyebrow">Character Vignette Archive</p>',
            `<p class="isr-vignette-archive-name">${characterHref ? `<a href="${escapeHtml(characterHref)}">${escapeHtml(characterName)}</a>` : escapeHtml(characterName)}</p>`,
            '<div class="isr-vignette-archive-meta">',
            `<span>${entries.length} vignette${entries.length === 1 ? "" : "s"}</span>`,
            range ? `<span>${escapeHtml(range)}</span>` : "",
            commonAuthor ? `<span>Written by ${escapeHtml(commonAuthor)}</span>` : "",
            "</div>",
            "</div>",
            "</section>",
          ].join("\n")

          const grouped = new Map<string, typeof entries>()
          for (const entry of entries) {
            const list = grouped.get(entry.date.year) ?? []
            list.push(entry)
            grouped.set(entry.date.year, list)
          }

          const years = [...grouped.entries()]
            .map(([year, yearEntries]) => {
              const items = yearEntries
                .map(({ note, date }) => {
                  const title = String(
                    note.frontmatter?.title ?? basenameWithoutExtension(note.relativePath),
                  )
                  const href = sharedRelativeSlugHref(relativeSource, note.slug)
                  const author = String(note.frontmatter?.author ?? "").trim()
                  const showAuthor = !commonAuthor && author
                  return [
                    `<a class="isr-vignette-entry" href="${escapeHtml(href)}">`,
                    `<time class="isr-vignette-entry-date"${date.iso ? ` datetime="${escapeHtml(date.iso)}"` : ""}>${escapeHtml(date.label)}</time>`,
                    "<span>",
                    `<span class="isr-vignette-entry-title">${escapeHtml(title)}</span>`,
                    showAuthor
                      ? `<span class="isr-vignette-entry-author">By ${escapeHtml(author)}</span>`
                      : "",
                    "</span>",
                    "</a>",
                  ].join("\n")
                })
                .join("\n")

              return [
                '<section class="isr-vignette-year">',
                '<div class="isr-vignette-year-heading">',
                `<h2>${escapeHtml(year)}</h2>`,
                `<span class="isr-vignette-year-count">${yearEntries.length} entr${yearEntries.length === 1 ? "y" : "ies"}</span>`,
                "</div>",
                `<div class="isr-vignette-grid">\n${items}\n</div>`,
                "</section>",
              ].join("\n")
            })
            .join("\n")

          const firstHeading = tree.children.findIndex(
            (node: any) => node?.type === "heading" && node.depth === 1,
          )
          const heroInsertAt = firstHeading >= 0 ? firstHeading + 1 : 0
          tree.children.splice(heroInsertAt, 0, { type: "html", value: hero })

          const yearStart = tree.children.findIndex(
            (node: any, index: number) =>
              index > heroInsertAt && node?.type === "heading" && node.depth === 2,
          )
          if (yearStart >= 0)
            tree.children.splice(yearStart, tree.children.length - yearStart, {
              type: "html",
              value: years,
            })
          else tree.children.push({ type: "html", value: years })
        },
      ]
    },
    externalResources() {
      return { css: [{ content: VIGNETTE_INDEX_CSS, inline: true }] }
    },
  }
}
