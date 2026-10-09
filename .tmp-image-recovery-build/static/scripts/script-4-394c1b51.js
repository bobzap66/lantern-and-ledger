
const setupViewportReadingProgress = () => {
  if (window.__lanternViewportProgressCleanup) {
    window.__lanternViewportProgressCleanup()
    window.__lanternViewportProgressCleanup = null
  }

  document.getElementById("reading-progress-overlay")?.remove()

  const quartzBody = document.querySelector("#quartz-body.has-reading-progress")
  const article = quartzBody?.querySelector(".center article")
  if (!quartzBody || !article) return

  const overlay = document.createElement("div")
  overlay.id = "reading-progress-overlay"
  overlay.setAttribute("aria-hidden", "true")

  const fill = document.createElement("span")
  fill.className = "reading-progress-overlay__fill"

  const computed = window.getComputedStyle(quartzBody)
  const accent = computed.getPropertyValue("--campaign-page-accent").trim()
  const fallback = window
    .getComputedStyle(document.documentElement)
    .getPropertyValue("--tertiary")
    .trim()
  fill.style.background = accent || fallback || "#9a6d2f"

  overlay.appendChild(fill)
  document.body.appendChild(overlay)

  let frame = 0

  const update = () => {
    frame = 0
    const articleTop = article.getBoundingClientRect().top + window.scrollY
    const articleBottom = articleTop + article.scrollHeight
    const finishAt = Math.max(articleTop + 1, articleBottom - window.innerHeight)
    const progress = Math.min(
      1,
      Math.max(0, (window.scrollY - articleTop) / (finishAt - articleTop)),
    )
    fill.style.transform = "scaleX(" + progress + ")"
  }

  const requestUpdate = () => {
    if (frame) return
    frame = window.requestAnimationFrame(update)
  }

  window.addEventListener("scroll", requestUpdate, { passive: true })
  window.addEventListener("resize", requestUpdate, { passive: true })
  window.visualViewport?.addEventListener("resize", requestUpdate, { passive: true })
  requestUpdate()

  window.__lanternViewportProgressCleanup = () => {
    window.removeEventListener("scroll", requestUpdate)
    window.removeEventListener("resize", requestUpdate)
    window.visualViewport?.removeEventListener("resize", requestUpdate)
    if (frame) window.cancelAnimationFrame(frame)
    overlay.remove()
  }
}

document.addEventListener("nav", setupViewportReadingProgress)
setupViewportReadingProgress()
