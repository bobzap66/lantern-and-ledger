import { EditorialCard, editorialCardCss } from "./EditorialCard"
import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { FullSlug, resolveRelative, simplifySlug } from "../util/path"

function isCharacterPage(fileData: QuartzComponentProps["fileData"]) {
  if (!fileData.slug) return false
  if (String(fileData.frontmatter?.type ?? "").toLowerCase() !== "person") return false

  const pageSlug = simplifySlug(fileData.slug)
  const marker = "/characters/"
  const markerIndex = pageSlug.indexOf(marker)
  if (markerIndex === -1) return false

  return Boolean(pageSlug.slice(markerIndex + marker.length))
}

function vignetteArchiveRoot(fileData: QuartzComponentProps["fileData"]) {
  if (!fileData.slug) return undefined

  const pageSlug = simplifySlug(fileData.slug)
  const marker = "/characters/"
  const markerIndex = pageSlug.indexOf(marker)
  if (markerIndex === -1) return undefined

  const campaignRoot = pageSlug.slice(0, markerIndex)
  const characterPath = pageSlug.slice(markerIndex + marker.length)
  if (!characterPath || characterPath === "index") return undefined

  return `${campaignRoot}/vignettes/${characterPath}`
}

function inferredVignetteSlug(
  fileData: QuartzComponentProps["fileData"],
  allFiles: QuartzComponentProps["allFiles"],
) {
  const archiveRoot = vignetteArchiveRoot(fileData)
  if (!archiveRoot) return undefined

  const characterSegment = archiveRoot.split("/").filter(Boolean).at(-1)
  if (!characterSegment) return undefined

  const candidates = [archiveRoot, `${archiveRoot}/index`, `${archiveRoot}/${characterSegment}`]

  for (const candidate of candidates) {
    const match = allFiles.find(
      (file) =>
        file.slug &&
        (String(file.slug) === candidate || String(simplifySlug(file.slug)) === candidate),
    )
    if (match?.slug) return simplifySlug(match.slug)
  }

  return undefined
}

function matchedFile(target: string, allFiles: QuartzComponentProps["allFiles"]) {
  return allFiles.find(
    (file) =>
      file.slug &&
      (String(file.slug) === target || String(simplifySlug(file.slug)) === target),
  )
}

export default (() => {
  const CharacterVignettes: QuartzComponent = ({
    fileData,
    allFiles,
    displayClass,
  }: QuartzComponentProps) => {
    if (!isCharacterPage(fileData)) return null

    const fm = fileData.frontmatter
    const configured = typeof fm?.vignette_index === "string" ? fm.vignette_index.trim() : ""
    const target = configured || inferredVignetteSlug(fileData, allFiles)
    if (!target || !fileData.slug) return null

    const href = resolveRelative(fileData.slug, target as FullSlug)
    const targetFile = matchedFile(target, allFiles)
    const targetDescription =
      typeof targetFile?.frontmatter?.description === "string"
        ? targetFile.frontmatter.description.trim()
        : ""
    const description =
      targetDescription || "Browse this character's collected scenes, side stories, and vignettes."

    const archiveRoot = vignetteArchiveRoot(fileData)
    const entryCount = archiveRoot
      ? allFiles.filter((file) => {
          if (!file.slug) return false
          if (String(file.frontmatter?.type ?? "").toLowerCase() !== "vignette") return false
          const slug = simplifySlug(file.slug)
          return slug.startsWith(`${archiveRoot}/`)
        }).length
      : 0
    const meta = entryCount > 0 ? `${entryCount} ${entryCount === 1 ? "entry" : "entries"}` : undefined

    return (
      <div class={`character-vignettes ${displayClass ?? ""}`.trim()}>
        <EditorialCard
          href={href}
          eyebrow="Character archive"
          title="Character Vignettes"
          description={description}
          meta={meta}
          cta="Browse vignettes"
          className="character-vignettes__card"
        />
      </div>
    )
  }

  CharacterVignettes.css = `
${editorialCardCss}

.character-vignettes {
  margin: 0.55rem 0 1.35rem;
}

.character-vignettes__card {
  max-width: 42rem;
}
`

  return CharacterVignettes
}) satisfies QuartzComponentConstructor
