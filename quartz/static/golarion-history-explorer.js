;(() => {
  const scriptBase = (() => {
    const script = [...document.scripts].find((item) =>
      /\/static\/golarion-history-explorer\.js(?:\?|$)/.test(item.src),
    )
    if (!script?.src) return ""
    try {
      return new URL(script.src, location.href).pathname
        .replace(/\/static\/golarion-history-explorer\.js$/, "")
        .replace(/\/$/, "")
    } catch (_) {
      return ""
    }
  })()

  const siteBase = () =>
    (document.body?.dataset?.basepath || scriptBase || "").replace(/\/$/, "")

  const escapeHtml = (value) =>
    String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;")

  const normalizeCampaignKey = (value) =>
    String(value || "")
      .trim()
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")

  const normalizedName = (value) =>
    String(value || "")
      .trim()
      .toLocaleLowerCase()
      .replace(/\s+/g, " ")

  const campaignAccessEnabled = (campaign) => {
    const key = normalizeCampaignKey(campaign)
    if (!key || typeof localStorage === "undefined") return false
    try {
      return localStorage.getItem(`isr-campaign-spoilers:${key}`) === "true"
    } catch (_) {
      return false
    }
  }

  const eventVisibleToViewer = (event) =>
    event.visibility !== "campaign-only" || campaignAccessEnabled(event.campaign)

  const sourceHref = (source) => {
    if (!source) return null
    if (/^https?:\/\//i.test(source)) return source
    const slug = String(source).replace(/^\/+|\/+$/g, "")
    return `${siteBase()}/${slug}`.replace(/\/+/g, "/")
  }

  const formatPointDate = (date, months) => `${months[date.month]} ${date.day}, ${date.year} AR`

  const formatDate = (event, months) => {
    if (event.isMultiDay && event.rangeStart && event.rangeEnd) {
      const start = event.rangeStart
      const end = event.rangeEnd
      if (start.year === end.year && start.month === end.month)
        return `${months[start.month]} ${start.day}–${end.day}, ${start.year} AR`
      if (start.year === end.year)
        return `${months[start.month]} ${start.day}–${months[end.month]} ${end.day}, ${start.year} AR`
      return `${formatPointDate(start, months)}–${formatPointDate(end, months)}`
    }
    if (event.datePrecision === "year" || !Number.isInteger(event.month)) return `${event.year} AR`
    if (event.datePrecision === "month" || !Number.isInteger(event.day))
      return `${months[event.month]} ${event.year} AR`
    return `${months[event.month]} ${event.day}, ${event.year} AR`
  }

  const prepareRecords = (events) => {
    const records = []
    const seen = new Set()

    for (const original of events ?? []) {
      let event = original
      let identity

      if (event.isMultiDay && event.rangeStart && event.rangeEnd) {
        const start = event.rangeStart
        const end = event.rangeEnd
        identity = [
          event.kind,
          event.campaign || "",
          normalizedName(event.name),
          start.year,
          start.month,
          start.day,
          end.year,
          end.month,
          end.day,
        ].join("|")
        event = { ...event, year: start.year, month: start.month, day: start.day }
      } else {
        identity = [
          event.kind,
          event.campaign || "",
          event.datePrecision || "day",
          event.year,
          event.month ?? "",
          event.day ?? "",
          normalizedName(event.name),
        ].join("|")
      }

      if (seen.has(identity)) continue
      seen.add(identity)
      records.push(event)
    }

    return records
  }

  const writeParams = (state) => {
    const params = new URLSearchParams()
    if (state.query) params.set("q", state.query)
    if (state.kind !== "all") params.set("kind", state.kind)
    if (state.campaign !== "all") params.set("campaign", state.campaign)
    if (state.from !== "") params.set("from", state.from)
    if (state.to !== "") params.set("to", state.to)
    const next = `${location.pathname}${params.toString() ? `?${params}` : ""}${location.hash}`
    history.replaceState(null, "", next)
  }

  const install = async () => {
    const root = document.querySelector("#golarion-history-explorer")
    if (!root || root.dataset.historyExplorerInitialized === "true") return
    root.dataset.historyExplorerInitialized = "true"

    try {
      const response = await fetch(`${siteBase()}/static/golarion-events.json`, { cache: "no-cache" })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const data = await response.json()
      const records = prepareRecords(data.events)
      const params = new URLSearchParams(location.search)
      const state = {
        query: params.get("q") || "",
        kind: params.get("kind") || "all",
        campaign: params.get("campaign") || "all",
        from: params.get("from") || "",
        to: params.get("to") || "",
      }

      if (!["all", "historical", "campaign"].includes(state.kind)) state.kind = "all"

      const campaigns = [
        ...new Set(
          records
            .filter(eventVisibleToViewer)
            .map((event) => event.campaign)
            .filter(Boolean),
        ),
      ].sort((a, b) => a.localeCompare(b))

      if (state.campaign !== "all" && !campaigns.includes(state.campaign)) state.campaign = "all"

      const campaignOptions = campaigns
        .map(
          (campaign) =>
            `<option value="${escapeHtml(campaign)}"${state.campaign === campaign ? " selected" : ""}>${escapeHtml(campaign)}</option>`,
        )
        .join("")

      root.innerHTML = `
        <section class="golarion-history-shell" aria-label="Golarion history explorer">
          <div class="golarion-history-controls">
            <label class="golarion-history-search">Search <input type="search" data-history-query value="${escapeHtml(state.query)}" placeholder="Search people, places, events…"></label>
            <label>Record <select data-history-kind>
              <option value="all"${state.kind === "all" ? " selected" : ""}>All history</option>
              <option value="historical"${state.kind === "historical" ? " selected" : ""}>Golarion history</option>
              <option value="campaign"${state.kind === "campaign" ? " selected" : ""}>Campaign history</option>
            </select></label>
            <label>Campaign <select data-history-campaign><option value="all">All campaigns</option>${campaignOptions}</select></label>
            <label>From year <input type="number" data-history-from value="${escapeHtml(state.from)}" inputmode="numeric"></label>
            <label>To year <input type="number" data-history-to value="${escapeHtml(state.to)}" inputmode="numeric"></label>
            <button type="button" data-history-clear>Clear filters</button>
          </div>
          <p class="golarion-history-count" data-history-count aria-live="polite"></p>
          <div class="golarion-history-results" data-history-results></div>
        </section>`

      const queryInput = root.querySelector("[data-history-query]")
      const kindSelect = root.querySelector("[data-history-kind]")
      const campaignSelect = root.querySelector("[data-history-campaign]")
      const fromInput = root.querySelector("[data-history-from]")
      const toInput = root.querySelector("[data-history-to]")
      const clearButton = root.querySelector("[data-history-clear]")
      const countNode = root.querySelector("[data-history-count]")
      const resultsNode = root.querySelector("[data-history-results]")

      const renderResults = () => {
        const query = state.query.trim().toLocaleLowerCase()
        const from = state.from === "" ? null : Number(state.from)
        const to = state.to === "" ? null : Number(state.to)

        const filtered = records
          .filter(eventVisibleToViewer)
          .filter((event) => {
            if (state.kind === "historical" && event.kind !== "historical") return false
            if (state.kind === "campaign" && event.kind !== "campaign-event") return false
            if (state.campaign !== "all" && event.campaign !== state.campaign) return false
            if (Number.isFinite(from) && event.year < from) return false
            if (Number.isFinite(to) && event.year > to) return false
            if (!query) return true
            return [event.name, event.description, event.category, event.campaign]
              .filter(Boolean)
              .some((value) => String(value).toLocaleLowerCase().includes(query))
          })
          .sort(
            (a, b) =>
              b.year - a.year ||
              (b.month ?? -1) - (a.month ?? -1) ||
              (b.day ?? -1) - (a.day ?? -1) ||
              a.name.localeCompare(b.name),
          )

        const grouped = new Map()
        for (const event of filtered) {
          if (!grouped.has(event.year)) grouped.set(event.year, [])
          grouped.get(event.year).push(event)
        }

        const yearsMarkup = [...grouped.entries()]
          .map(([year, events]) => {
            const eventMarkup = events
              .map((event) => {
                const source = sourceHref(event.source)
                const sourceLabel =
                  event.campaign || (event.kind === "historical" ? "Golarion History" : "Source")
                const external = source && /^https?:\/\//i.test(source)
                return `<article class="golarion-history-event ${event.kind === "historical" ? "is-history" : "is-campaign"}">
                  <div class="golarion-history-event-date">${escapeHtml(formatDate(event, data.months))}</div>
                  <div class="golarion-history-event-body">
                    <div class="golarion-history-event-meta"><span>${escapeHtml(sourceLabel)}</span>${event.category ? `<span>${escapeHtml(event.category)}</span>` : ""}</div>
                    <h3>${escapeHtml(event.name)}</h3>
                    ${event.description ? `<p>${escapeHtml(event.description)}</p>` : ""}
                    ${source ? `<p class="golarion-history-source"><a href="${escapeHtml(source)}"${external ? ' target="_blank" rel="noopener noreferrer"' : ""}>View source</a></p>` : ""}
                  </div>
                </article>`
              })
              .join("")
            return `<section class="golarion-history-year"><h2>${year} AR</h2>${eventMarkup}</section>`
          })
          .join("")

        if (countNode)
          countNode.textContent = `${filtered.length} ${filtered.length === 1 ? "record" : "records"}`
        if (resultsNode)
          resultsNode.innerHTML = yearsMarkup || '<p class="golarion-history-empty">No historical records match these filters.</p>'
      }

      const updateResults = () => {
        writeParams(state)
        renderResults()
      }

      queryInput?.addEventListener("input", (event) => {
        state.query = event.target.value
        updateResults()
      })
      kindSelect?.addEventListener("change", (event) => {
        state.kind = event.target.value
        updateResults()
      })
      campaignSelect?.addEventListener("change", (event) => {
        state.campaign = event.target.value
        updateResults()
      })
      fromInput?.addEventListener("change", (event) => {
        state.from = event.target.value
        updateResults()
      })
      toInput?.addEventListener("change", (event) => {
        state.to = event.target.value
        updateResults()
      })
      clearButton?.addEventListener("click", () => {
        state.query = ""
        state.kind = "all"
        state.campaign = "all"
        state.from = ""
        state.to = ""
        if (queryInput) queryInput.value = ""
        if (kindSelect) kindSelect.value = "all"
        if (campaignSelect) campaignSelect.value = "all"
        if (fromInput) fromInput.value = ""
        if (toInput) toInput.value = ""
        updateResults()
      })

      renderResults()
    } catch (error) {
      console.error("Failed to load Golarion history explorer", error)
      root.innerHTML = '<p class="golarion-calendar-error">Golarion history could not be loaded.</p>'
    }
  }

  document.addEventListener("nav", install)
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", install, { once: true })
  else install()
})()
