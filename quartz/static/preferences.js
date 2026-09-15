;(() => {
  const SPOILER_PREFIX = "isr-campaign-spoilers:"

  const setTheme = (theme) => {
    if (theme !== "light" && theme !== "dark") return
    document.documentElement.setAttribute("saved-theme", theme)
    try {
      localStorage.setItem("theme", theme)
    } catch (_) {}

    document.body.classList.add("animation-ready")
    document.dispatchEvent(
      new CustomEvent("themechange", {
        detail: { theme },
      }),
    )
  }

  const currentTheme = () =>
    document.documentElement.getAttribute("saved-theme") === "dark" ? "dark" : "light"

  const spoilersVisible = (key) => {
    try {
      return localStorage.getItem(SPOILER_PREFIX + key) === "true"
    } catch (_) {
      return false
    }
  }

  const setSpoilersVisible = (key, enabled) => {
    try {
      if (enabled) localStorage.setItem(SPOILER_PREFIX + key, "true")
      else localStorage.removeItem(SPOILER_PREFIX + key)
    } catch (_) {}

    document.dispatchEvent(
      new CustomEvent("isr:campaign-spoilers-changed", {
        detail: { campaign: key, enabled },
      }),
    )
  }

  const syncThemeControls = (root) => {
    const theme = currentTheme()
    root.querySelectorAll("[data-preference-theme]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.preferenceTheme === theme))
    })
  }

  const syncSpoilerControls = (root) => {
    const visibleList = root.querySelector('[data-spoiler-group="visible"] .preference-campaign-list')
    const hiddenList = root.querySelector('[data-spoiler-group="hidden"] .preference-campaign-list')
    const visibleGroup = root.querySelector('[data-spoiler-group="visible"]')
    const hiddenGroup = root.querySelector('[data-spoiler-group="hidden"]')
    const summary = root.querySelector("[data-spoiler-summary]")
    if (!visibleList || !hiddenList) return

    const rows = Array.from(root.querySelectorAll(".preference-campaign[data-campaign-key]"))
    let visibleCount = 0

    rows
      .sort((a, b) =>
        (a.dataset.campaignName || "").localeCompare(b.dataset.campaignName || ""),
      )
      .forEach((row) => {
        const key = row.dataset.campaignKey
        if (!key) return
        const enabled = spoilersVisible(key)
        row.dataset.spoilersVisible = String(enabled)

        const badge = row.querySelector(".preference-campaign__badge")
        const status = row.querySelector(".preference-campaign__status")
        const action = row.querySelector("[data-spoiler-toggle]")

        if (badge) badge.textContent = enabled ? "Spoilers visible" : "Spoilers hidden"
        if (status) {
          status.textContent = enabled
            ? "Campaign pages and campaign history are currently unlocked on this browser."
            : "Campaign pages remain protected by the spoiler warning."
        }
        if (action) {
          action.textContent = enabled ? "Hide spoilers" : "Show spoilers"
          action.dataset.nextSpoilerState = enabled ? "hidden" : "visible"
        }

        if (enabled) {
          visibleCount += 1
          visibleList.appendChild(row)
        } else {
          hiddenList.appendChild(row)
        }
      })

    if (visibleGroup) visibleGroup.hidden = visibleCount === 0
    if (hiddenGroup) hiddenGroup.hidden = visibleCount === rows.length
    if (summary) {
      summary.textContent =
        visibleCount === 0
          ? "No campaign spoilers are currently unlocked on this browser."
          : `${visibleCount} campaign${visibleCount === 1 ? "" : "s"} currently showing spoilers on this browser.`
    }
  }

  const installPreferences = () => {
    const root = document.querySelector("[data-reader-preferences]")
    if (!root || root.dataset.preferencesInstalled === "true") return
    root.dataset.preferencesInstalled = "true"

    syncThemeControls(root)
    syncSpoilerControls(root)

    root.addEventListener("click", (event) => {
      const target = event.target instanceof Element ? event.target.closest("button") : null
      if (!target) return

      const theme = target.dataset.preferenceTheme
      if (theme) {
        setTheme(theme)
        syncThemeControls(root)
        return
      }

      if (target.matches("[data-spoiler-toggle]")) {
        const row = target.closest(".preference-campaign[data-campaign-key]")
        const key = row?.dataset.campaignKey
        if (!key) return
        setSpoilersVisible(key, !spoilersVisible(key))
        syncSpoilerControls(root)
        return
      }

      if (target.matches("[data-hide-all-spoilers]")) {
        root.querySelectorAll(".preference-campaign[data-campaign-key]").forEach((row) => {
          const key = row.dataset.campaignKey
          if (key) setSpoilersVisible(key, false)
        })
        syncSpoilerControls(root)
      }
    })

    document.addEventListener("themechange", () => syncThemeControls(root))
  }

  document.addEventListener("nav", installPreferences)
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", installPreferences, { once: true })
  } else {
    installPreferences()
  }
})()
