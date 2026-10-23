import { QuartzComponent, QuartzComponentConstructor } from "./types"
// @ts-expect-error - Inline script loaded as text by esbuild plugin
import curatorScript from "./scripts/curatedExplorer.inline"
// @ts-expect-error - Inline script loaded as text by esbuild plugin
import kingmakerVignetteOrder from "./scripts/curatedExplorer.kingmakerVignettes.inline"

export default (() => {
  const ExplorerCurator: QuartzComponent = () => null
  ExplorerCurator.afterDOMLoaded = `${curatorScript}\n${kingmakerVignetteOrder}`
  return ExplorerCurator
}) satisfies QuartzComponentConstructor
