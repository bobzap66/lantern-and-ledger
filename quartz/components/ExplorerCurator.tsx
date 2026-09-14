import { QuartzComponent, QuartzComponentConstructor } from "./types"
// @ts-expect-error - Inline script loaded as text by esbuild plugin
import curatorScript from "./scripts/curatedExplorer.inline"

export default (() => {
  const ExplorerCurator: QuartzComponent = () => null
  ExplorerCurator.afterDOMLoaded = curatorScript
  return ExplorerCurator
}) satisfies QuartzComponentConstructor
