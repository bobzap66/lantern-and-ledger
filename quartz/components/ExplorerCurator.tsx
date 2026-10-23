import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { getSitePublicationBoundaries } from "../util/sitePublication"
// @ts-expect-error - Inline script loaded as text by esbuild plugin
import curatorScript from "./scripts/curatedExplorer.inline"

export default (() => {
  const ExplorerCurator: QuartzComponent = ({ allFiles }: QuartzComponentProps) => {
    const boundaries = getSitePublicationBoundaries(allFiles)

    return (
      <span
        id="site-publication-explorer-context"
        hidden
        data-publication-boundaries={JSON.stringify(boundaries)}
      />
    )
  }

  ExplorerCurator.afterDOMLoaded = curatorScript
  return ExplorerCurator
}) satisfies QuartzComponentConstructor
