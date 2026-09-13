import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { FullSlug, resolveRelative, simplifySlug } from "../util/path"

function isCharacterPage(fileData: QuartzComponentProps["fileData"]) {
  if (!fileData.slug) return false

  const pageSlug = simplifySlug(fileData.slug)
  const marker = "/characters/"
  const markerIndex = pageSlug.indexOf(marker)
  if (markerIndex === -1) return false

  const characterPath = pageSlug.slice(markerIndex + marker.length)
  return Boolean(characterPath && characterPath !== "index")
}

function inferredVignetteSlug(fileData: QuartzComponentProps["fileData"], allFiles: QuartzComponentProps["allFiles"]) {
  if (!fileData.slug) return undefined

  const pageSlug = simplifySlug(fileData.slug)
  const marker = "/characters/"
  const markerIndex = pageSlug.indexOf(marker)
  if (markerIndex === -1) return undefined

  const campaignRoot = pageSlug.slice(0, markerIndex)
  const characterPath = pageSlug.slice(markerIndex + marker.length)
  if (!characterPath || characterPath === "index") return undefined

  const characterSegment = characterPath.split("/").filter(Boolean).at(-1)
  if (!characterSegment) return undefined

  const candidates = [
    `${campaignRoot}/vignettes/${characterPath}`,
    `${campaignRoot}/vignettes/${characterPath}/${characterSegment}`,
  ]

  for (const candidate of candidates) {
    const match = allFiles.find((file) => file.slug && simplifySlug(file.slug) === candidate)
    if (match?.slug) return simplifySlug(match.slug)
  }

  return undefined
}

export default (() => {
  const CharacterVignettes: QuartzComponent = ({ fileData, allFiles, displayClass }: QuartzComponentProps) => {
    if (!isCharacterPage(fileData)) return null

    const fm = fileData.frontmatter
    const configured = typeof fm?.vignette_index === "string" ? fm.vignette_index.trim() : ""
    const target = configured || inferredVignetteSlug(fileData, allFiles)
    if (!target || !fileData.slug) return null

    const href = resolveRelative(fileData.slug, target as FullSlug)

    return (
      <p class={`character-vignettes ${displayClass ?? ""}`.trim()}>
        <a href={href} class="internal">
          Character Vignettes →
        </a>
      </p>
    )
  }

  CharacterVignettes.css = `
.character-vignettes {
  margin: 0.35rem 0 1.15rem;
  font-size: 0.92rem;
}

.character-vignettes a {
  font-weight: 600;
  text-decoration: none;
}
`

  return CharacterVignettes
}) satisfies QuartzComponentConstructor
