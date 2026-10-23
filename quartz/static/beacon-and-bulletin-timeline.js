;(() => {
  const escapeHtml = (value) =>
    String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;")

  const install = async () => {
    const root = document.querySelector("#beacon-and-bulletin-timeline")
    if (!root || root.dataset.initialized === "true") return
    root.dataset.initialized = "true"
    try {
      const base = (document.body?.dataset?.basepath || "").replace(/\/$/, "")
      const response = await fetch(`${base}/static/beacon-and-bulletin-events.json`, {
        cache: "no-cache",
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const data = await response.json()
      if (!Array.isArray(data.events)) throw new Error("Timeline data has no events array")
      if (!data.events.length) {
        root.innerHTML =
          '<p class="beacon-timeline-empty">No timeline entries have been added yet.</p>'
        return
      }
      root.innerHTML = `<ol class="beacon-timeline-list">${data.events
        .map((event) => {
          const sources = Array.isArray(event.sources)
            ? event.sources
            : event.source
              ? [event.source]
              : []
          const links = sources
            .map((source) => {
              const href = /^https?:\/\//i.test(source)
                ? source
                : `${base}/${String(source).replace(/^\/+/, "")}`
              return `<a href="${escapeHtml(href)}">Source</a>`
            })
            .join(" · ")
          const citation = event.citation
            ? `<p class="beacon-timeline-sources">${escapeHtml(event.citation)}</p>`
            : ""
          const verification =
            event.verification === "official-paizo-source"
              ? '<span class="beacon-timeline-verified">Verified Paizo source</span>'
              : ""
          return `<li class="beacon-timeline-event"><time>${escapeHtml(event.dateLabel)}</time>${verification}<h2>${escapeHtml(event.title)}</h2>${event.description ? `<p>${escapeHtml(event.description)}</p>` : ""}${citation}${links ? `<p class="beacon-timeline-sources">${links}</p>` : ""}</li>`
        })
        .join("")}</ol>`
    } catch (error) {
      root.innerHTML = `<p class="beacon-timeline-error">Timeline unavailable: ${escapeHtml(error.message)}</p>`
    }
  }
  document.addEventListener("nav", install)
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", install, { once: true })
  else install()
})()
