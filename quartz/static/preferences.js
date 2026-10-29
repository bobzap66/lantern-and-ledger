;(() => {
  const SPOILER_PREFIX = "isr-campaign-spoilers:"
  const CAMPAIGN_DATA_URL = "/static/preferences-campaigns.json"

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

  const escapeHtml = (value) =>
    String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll('"', "&quot;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")

  const loadCampaignData = async () => {
    const response = await fetch(CAMPAIGN_DATA_URL, { cache: "no-store" })
    if (!response.ok) throw new Error(`Campaign preference data returned ${response.status}`)
    const data = await response.json()
    if (!Array.isArray(data?.publications)) throw new Error("Campaign preference data is malformed")
    return data.publications
  }

  const campaignRow = (campaign) => `
    <article class="preference-campaign" data-campaign-key="${escapeHtml(campaign.id)}" data-campaign-name="${escapeHtml(campaign.name)}">
      <div>
        <p class="preference-campaign__name">${escapeHtml(campaign.name)}</p>
        <p class="preference-campaign__status"></p>
      </div>
      <div class="preference-campaign__controls">
        <span class="preference-campaign__badge"></span>
        <button class="preference-action" type="button" data-spoiler-toggle></button>
      </div>
    </article>`

  const publicationGroup = (publication) => {
    const campaigns = Array.isArray(publication.campaigns) ? publication.campaigns : []
    const countLabel = `${campaigns.length} campaign${campaigns.length === 1 ? "" : "s"}`
    const rows = campaigns.length
      ? campaigns.map(campaignRow).join("")
      : '<p class="preference-publication__empty">No campaigns are available yet.</p>'

    return `
      <details class="preference-publication" data-preference-publication="${escapeHtml(publication.key)}" open>
        <summary class="preference-publication__summary">
          <span class="preference-publication__title">${escapeHtml(publication.title)}</span>
          <span class="preference-publication__count">${countLabel}</span>
        </summary>
        <div class="preference-publication__body">
          <div class="preference-campaign-list">${rows}</div>
        </div>
      </details>`
  }

  const renderPreferencesMarkup = (root, publications, loadError = false) => {
    if (root.dataset.preferencesMarkup === "true") return
    root.dataset.preferencesMarkup = "true"

    const campaignGroups = loadError
      ? '<p class="preference-data-error">Campaign preferences could not be loaded. Reload the page to try again.</p>'
      : publications.map(publicationGroup).join("")

    root.innerHTML = `
      <section class="reader-preferences__section" aria-labelledby="preferences-appearance">
        <h2 id="preferences-appearance">Appearance</h2>
        <p>Choose the color scheme used by Greene Gaming. The sun/moon control in the sidebar changes the same setting.</p>
        <div class="preference-choice-group" role="group" aria-label="Color scheme">
          <button class="preference-choice" type="button" data-preference-theme="light" aria-pressed="false">Light</button>
          <button class="preference-choice" type="button" data-preference-theme="dark" aria-pressed="false">Dark</button>
        </div>
      </section>
      <section class="reader-preferences__section" aria-labelledby="preferences-spoilers">
        <div class="preference-section-heading">
          <h2 id="preferences-spoilers">Campaign spoilers</h2>
          <button class="preference-action" type="button" data-hide-all-spoilers>Hide all spoilers</button>
        </div>
        <p>Campaign archives remain behind their spoiler warning until you choose to unlock them. Campaigns are grouped by publication below.</p>
        <p class="preference-status-summary" data-spoiler-summary></p>
        <div class="preference-publications">${campaignGroups}</div>
        <p class="preference-note">Spoiler choices are remembered only on this browser and device.</p>
      </section>`
  }

  const syncThemeControls = (root) => {
    const theme = currentTheme()
    root.querySelectorAll("[data-preference-theme]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.preferenceTheme === theme))
    })
  }

  const syncSpoilerControls = (root) => {
    const rows = Array.from(root.querySelectorAll(".preference-campaign[data-campaign-key]"))
    const summary = root.querySelector("[data-spoiler-summary]")
    let visibleCount = 0

    rows.forEach((row) => {
      const key = row.dataset.campaignKey
      if (!key) return
      const enabled = spoilersVisible(key)
      row.dataset.spoilersVisible = String(enabled)

      const badge = row.querySelector(".preference-campaign__badge")
      const status = row.querySelector(".preference-campaign__status")
      const action = row.querySelector("[data-spoiler-toggle]")

      if (enabled) visibleCount += 1
      if (badge) badge.textContent = enabled ? "Spoilers visible" : "Spoilers hidden"
      if (status) {
        status.textContent = enabled
          ? "Campaign pages and campaign history are currently unlocked on this browser."
          : "Campaign pages remain protected by the spoiler warning."
      }
      if (action) action.textContent = enabled ? "Hide spoilers" : "Show spoilers"
    })

    if (summary) {
      summary.textContent =
        visibleCount === 0
          ? "No campaign spoilers are currently unlocked on this browser."
          : `${visibleCount} campaign${visibleCount === 1 ? "" : "s"} currently showing spoilers on this browser.`
    }
  }

  const installPreferences = async () => {
    const root = document.querySelector("[data-reader-preferences]")
    if (!root || root.dataset.preferencesInstalled === "true") return
    root.dataset.preferencesInstalled = "true"

    let publications = []
    let loadError = false
    try {
      publications = await loadCampaignData()
    } catch (error) {
      loadError = true
      console.error("Unable to load reader preference campaigns", error)
    }

    if (!root.isConnected) return
    renderPreferencesMarkup(root, publications, loadError)
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

    document.addEventListener("themechange", () => {
      if (root.isConnected) syncThemeControls(root)
    })
  }

  document.addEventListener("nav", installPreferences)
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", installPreferences, { once: true })
  } else {
    installPreferences()
  }
})()