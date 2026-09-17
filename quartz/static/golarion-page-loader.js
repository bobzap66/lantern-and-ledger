;(() => {
  const pageScripts = [
    ["#golarion-calendar", "golarion-calendar.js", "initialized"],
    ["#golarion-history-explorer", "golarion-history-explorer.js", "historyExplorerInitialized"],
    ["#golarion-today", "golarion-history-browser.js", "historyBrowserInitialized"],
  ]

  const siteBase = () => (document.body?.dataset?.basepath || "").replace(/\/$/, "")

  const loadPageScript = () => {
    for (const [selector, filename, initializedKey] of pageScripts) {
      const root = document.querySelector(selector)
      if (!root || root.dataset[initializedKey] === "true") continue

      const src = `${siteBase()}/static/${filename}`
      // Scripts inserted into the page body by Quartz's SPA router are inert. Only
      // count scripts loaded by this helper, because those are guaranteed to run.
      const loaded = [...document.scripts].some(
        (script) => script.dataset.golarionPageLoader === filename,
      )
      if (loaded) continue

      const script = document.createElement("script")
      script.src = src
      script.dataset.golarionPageLoader = filename
      document.head.appendChild(script)
    }
  }

  document.addEventListener("nav", loadPageScript)
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", loadPageScript, { once: true })
  else loadPageScript()
})()
