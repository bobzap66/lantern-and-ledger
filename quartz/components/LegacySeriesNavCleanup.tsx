import { QuartzComponent, QuartzComponentConstructor } from "./types"

export default (() => {
  const LegacySeriesNavCleanup: QuartzComponent = () => null

  LegacySeriesNavCleanup.afterDOMLoaded = `
const cleanSeriesPublicationChrome = () => {
  const sessionNav = document.querySelector(".session-navigation")
  const vignetteNav = document.querySelector(".vignette-navigation")
  if (!sessionNav && !vignetteNav) return

  const article = document.querySelector("#quartz-body .center article")
  if (!article) return
  const contentRoot = article.querySelector(":scope > .markdown-preview-view") || article
  const paragraphs = Array.from(contentRoot.querySelectorAll(":scope > p"))

  if (sessionNav) {
    for (const paragraph of paragraphs) {
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

  if (vignetteNav) {
    const navTargets = new Set(
      Array.from(vignetteNav.querySelectorAll("a.internal")).map((link) => link.href),
    )
    const trailingParagraphs = new Set(paragraphs.slice(-3))

    for (const paragraph of trailingParagraphs) {
      const links = Array.from(paragraph.querySelectorAll(":scope > a.internal"))
      if (links.length === 0 || links.length > 2) continue
      if (!links.every((link) => navTargets.has(link.href))) continue

      const text = (paragraph.textContent || "").trim()
      if (text.length > 220) continue

      paragraph.hidden = true
      paragraph.dataset.legacySeriesNavigation = "hidden"
    }
  }
}

document.addEventListener("nav", cleanSeriesPublicationChrome)
cleanSeriesPublicationChrome()
`

  return LegacySeriesNavCleanup
}) satisfies QuartzComponentConstructor
