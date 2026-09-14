import { Explorer } from "@quartz-community/explorer"
import { QuartzComponentConstructor } from "./types"
// @ts-expect-error - Inline script loaded as text by esbuild plugin
import curatorScript from "./scripts/curatedExplorer.inline"

export default (() => {
  const explorer = Explorer()
  explorer.afterDOMLoaded = [explorer.afterDOMLoaded, curatorScript].filter(Boolean).join("\n")
  return explorer
}) satisfies QuartzComponentConstructor
