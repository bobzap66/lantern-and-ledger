import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { FullSlug, simplifySlug } from "../util/path"
import { getSitePublication } from "../util/sitePublication"
// @ts-expect-error - Inline script loaded as text by esbuild plugin
import curatorScript from "./scripts/curatedExplorer.inline"
// @ts-expect-error - Inline script loaded as text by esbuild plugin
import kingmakerVignetteOrder from "./scripts/curatedExplorer.kingmakerVignettes.inline"

type PublicationBoundary = {
  path: string
  publication: string
}

function publicationBoundaries(allFiles: QuartzComponentProps["allFiles"]): PublicationBoundary[] {
  const publicationByPath = new Map<string, string>()

  for (const file of allFiles) {
    if (!file.slug) continue
    const path = simplifySlug(file.slug as FullSlug)
    const publication = getSitePublication(
      file.frontmatter as Record<string, unknown> | undefined,
    ).key
    publicationByPath.set(path, publication)
  }

  const rootPublication = publicationByPath.get("") ?? getSitePublication(undefined).key
  if (!publicationByPath.has("")) publicationByPath.set("", rootPublication)

  const nearestAncestorPublication = (path: string) => {
    const parts = path.split("/").filter(Boolean)
    while (parts.length > 0) {
      parts.pop()
      const candidate = parts.join("/")
      const publication = publicationByPath.get(candidate)
      if (publication) return publication
    }
    return rootPublication
  }

  return [...publicationByPath.entries()]
    .filter(([path, publication]) => path === "" || nearestAncestorPublication(path) !== publication)
    .map(([path, publication]) => ({ path, publication }))
    .sort((a, b) => a.path.localeCompare(b.path))
}

export default (() => {
  const ExplorerCurator: QuartzComponent = ({ allFiles, fileData }: QuartzComponentProps) => {
    const currentPublication = getSitePublication(
      fileData.frontmatter as Record<string, unknown> | undefined,
    ).key
    const boundaries = publicationBoundaries(allFiles)

    return (
      <span
        id="site-publication-explorer-context"
        hidden
        data-current-publication={currentPublication}
        data-publication-boundaries={JSON.stringify(boundaries)}
      />
    )
  }

  ExplorerCurator.afterDOMLoaded = `${curatorScript}\n${kingmakerVignetteOrder}`
  return ExplorerCurator
}) satisfies QuartzComponentConstructor
