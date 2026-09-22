import { QuartzComponent, QuartzComponentConstructor } from "./types"

export default (() => {
  const LegacySeriesNavCleanup: QuartzComponent = () => null

  LegacySeriesNavCleanup.afterDOMLoaded = `
const cleanSessionPublicationChrome = () => {
  if (!document.querySelector(".session-navigation")) return

  const article = document.querySelector("#quartz-body .center article")
  if (!article) return
  const contentRoot = article.querySelector(":scope > .markdown-preview-view") || article

  for (const paragraph of contentRoot.querySelectorAll(":scope > p")) {
    const links = Array.from(paragraph.querySelectorAll(":scope > a.internal"))
    if (links.length < 3) continue

    const text = paragraph.textContent || ""
    const hasDirection = text.includes("←") || text.includes("→")
    const separatorCount = (text.match(/·/g) || []).length
    if (!hasDirection || separatorCount < 1) continue

    paragraph.hidden = true
    paragraph.dataset.legacySeriesNavigation = "hidden"
  }

  const contributors = contentRoot.querySelector(":scope > .isr-contributors")
  if (contributors) {
    const technicalHeading = Array.from(contentRoot.querySelectorAll(":scope > h2")).find((heading) => {
      const label = String(heading.textContent || "").trim().toLowerCase()
      return label === "art" || label === "images" || label === "table shots"
    })

    if (technicalHeading) {
      contentRoot.insertBefore(contributors, technicalHeading)
    }
  }
}

document.addEventListener("nav", cleanSessionPublicationChrome)
cleanSessionPublicationChrome()
`

  return LegacySeriesNavCleanup
}) satisfies QuartzComponentConstructor
