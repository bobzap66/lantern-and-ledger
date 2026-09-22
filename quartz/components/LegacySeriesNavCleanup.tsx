import { QuartzComponent, QuartzComponentConstructor } from "./types"

export default (() => {
  const LegacySeriesNavCleanup: QuartzComponent = () => null

  LegacySeriesNavCleanup.afterDOMLoaded = `
const hideLegacySeriesNavigation = () => {
  if (!document.querySelector(".session-navigation")) return

  const article = document.querySelector("#quartz-body .center article")
  if (!article) return

  for (const paragraph of article.querySelectorAll(":scope > p")) {
    const links = Array.from(paragraph.querySelectorAll(":scope > a.internal"))
    if (links.length < 3) continue

    const text = paragraph.textContent || ""
    const hasDirection = text.includes("←") || text.includes("→")
    const separatorCount = (text.match(/·/g) || []).length
    if (!hasDirection || separatorCount < 1) continue

    paragraph.hidden = true
    paragraph.dataset.legacySeriesNavigation = "hidden"
  }
}

document.addEventListener("nav", hideLegacySeriesNavigation)
hideLegacySeriesNavigation()
`

  return LegacySeriesNavCleanup
}) satisfies QuartzComponentConstructor
