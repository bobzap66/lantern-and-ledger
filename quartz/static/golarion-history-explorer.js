;(() => {
  const HISTORICAL_ERAS = [
    { id: "before-ages", name: "Age Before Ages", start: Number.NEGATIVE_INFINITY },
    { id: "darkness", name: "Age of Darkness", start: -5293 },
    { id: "anguish", name: "Age of Anguish", start: -4294 },
    { id: "destiny", name: "Age of Destiny", start: -3470 },
    { id: "enthronement", name: "Age of Enthronement", start: 1 },
    { id: "lost-omens", name: "Age of Lost Omens", start: 4606 },
  ]

  const eraForYear = (year) => {
    for (let index = HISTORICAL_ERAS.length - 1; index >= 0; index -= 1) {
      if (year >= HISTORICAL_ERAS[index].start) return HISTORICAL_ERAS[index]
    }
    return HISTORICAL_ERAS[0]
  }

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

  const siteBase = () => (document.body?.dataset?.basepath || scriptBase || "").replace(/\/$/, "")

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

  const isMilestone = (event) => event.timelineMetadata || event.recordType === "milestone"

  const isMajorRecord = (event) => event.kind === "historical" || isMilestone(event)

  const campaignAccessEnabled = (campaign) => {
    const key = normalizeCampaignKey(campaign)
    if (!key || typeof localStorage === "undefined") return false
    try {
      return localStorage.getItem(`isr-campaign-spoilers:${key}`) === "true"
    } catch (_) {
      return false
    }
  }

  const eventVisibleToViewer = (event) => {
    const requiresCampaignAccess =
      event.visibility === "campaign-only" || (event.kind === "campaign-event" && event.campaign)
    return !requiresCampaignAccess || campaignAccessEnabled(event.campaign)
  }

  const sourceHref = (source) => {
    if (!source) return null
    if (/^https?:\/\//i.test(source)) return source
    const slug = String(source).replace(/^\/+|\/+$/g, "")
    return `${siteBase()}/${slug}`.replace(/\/+/g, "/")
  }

  const formatPointDate = (date, months) => {
    if (date.datePrecision === "year" || !Number.isInteger(date.month)) return `${date.year} AR`
    if (date.datePrecision === "month" || !Number.isInteger(date.day))
      return `${months[date.month]} ${date.year} AR`
    return `${months[date.month]} ${date.day}, ${date.year} AR`
  }

  const formatDate = (event, months) => {
    if (event.dateLabel) return event.dateLabel
    if (event.isMultiDay && event.rangeStart && event.rangeEnd) {
      const start = event.rangeStart
      const end = event.rangeEnd
      if (
        start.datePrecision === "day" &&
        end.datePrecision === "day" &&
        start.year === end.year &&
        start.month === end.month
      )
        return `${months[start.month]} ${start.day}–${end.day}, ${start.year} AR`
      if (start.datePrecision === "day" && end.datePrecision === "day" && start.year === end.year)
        return `${months[start.month]} ${start.day}–${months[end.month]} ${end.day}, ${start.year} AR`
      if (
        start.datePrecision === "month" &&
        end.datePrecision === "month" &&
        start.year === end.year
      )
        return `${months[start.month]}–${months[end.month]} ${start.year} AR`
      return `${formatPointDate(start, months)}–${formatPointDate(end, months)}`
    }
    if (event.datePrecision === "year" || !Number.isInteger(event.month)) return `${event.year} AR`
    if (event.datePrecision === "month" || !Number.isInteger(event.day))
      return `${months[event.month]} ${event.year} AR`
    return `${months[event.month]} ${event.day}, ${event.year} AR`
  }

  const eventYearBounds = (event) => ({
    startYear: event.rangeStart?.year ?? event.year,
    endYear: event.rangeEnd?.year ?? event.year,
  })

  const eventStartPoint = (event) => event.rangeStart || event

  const compareDatePoints = (a, b) =>
    a.year - b.year || (a.month ?? -1) - (b.month ?? -1) || (a.day ?? -1) - (b.day ?? -1)

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
    if (state.future) params.set("future", "1")
    if (state.density === "compact") params.set("view", "compact")
    if (state.scope === "major") params.set("scope", "major")
    const next = `${location.pathname}${params.toString() ? `?${params}` : ""}${location.hash}`
    history.replaceState(null, "", next)
  }

  const install = async () => {
    const root = document.querySelector("#golarion-history-explorer")
    if (!root || root.dataset.historyExplorerInitialized === "true") return
    root.dataset.historyExplorerInitialized = "true"

    try {
      const response = await fetch(`${siteBase()}/static/golarion-events.json`, {
        cache: "no-cache",
      })
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
        future: params.get("future") === "1",
        density: params.get("view") === "compact" ? "compact" : "expanded",
        scope: params.get("scope") === "major" ? "major" : "all",
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

      const campaignById = new Map(
        (data.campaigns ?? []).map((campaign) => [campaign.id, campaign]),
      )
      const accessibleCampaigns = (data.campaigns ?? []).filter(
        (campaign) => campaign.currentDate && campaignAccessEnabled(campaign.id),
      )

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
            <label>Coverage <select data-history-scope>
              <option value="all"${state.scope === "all" ? " selected" : ""}>All records</option>
              <option value="major"${state.scope === "major" ? " selected" : ""}>Major events</option>
            </select></label>
            <label>From year <input type="number" data-history-from value="${escapeHtml(state.from)}" inputmode="numeric"></label>
            <label>To year <input type="number" data-history-to value="${escapeHtml(state.to)}" inputmode="numeric"></label>
            <label>View <select data-history-density>
              <option value="expanded"${state.density === "expanded" ? " selected" : ""}>Expanded</option>
              <option value="compact"${state.density === "compact" ? " selected" : ""}>Compact</option>
            </select></label>
            ${accessibleCampaigns.length ? `<label class="golarion-history-future"><span>Campaign spoilers</span><span><input type="checkbox" data-history-future${state.future ? " checked" : ""}> Show future records</span></label>` : ""}
            <button type="button" data-history-clear>Clear filters</button>
          </div>
          <p class="golarion-history-count" data-history-count aria-live="polite"></p>
          <nav class="golarion-history-jump" data-history-jump aria-label="Jump through filtered history"></nav>
          <div class="golarion-history-results" data-history-results></div>
        </section>`

      const queryInput = root.querySelector("[data-history-query]")
      const kindSelect = root.querySelector("[data-history-kind]")
      const campaignSelect = root.querySelector("[data-history-campaign]")
      const scopeSelect = root.querySelector("[data-history-scope]")
      const fromInput = root.querySelector("[data-history-from]")
      const toInput = root.querySelector("[data-history-to]")
      const densitySelect = root.querySelector("[data-history-density]")
      const futureInput = root.querySelector("[data-history-future]")
      const clearButton = root.querySelector("[data-history-clear]")
      const countNode = root.querySelector("[data-history-count]")
      const jumpNode = root.querySelector("[data-history-jump]")
      const resultsNode = root.querySelector("[data-history-results]")

      const renderResults = () => {
        const query = state.query.trim().toLocaleLowerCase()
        const from = state.from === "" ? null : Number(state.from)
        const to = state.to === "" ? null : Number(state.to)

        const matching = records.filter(eventVisibleToViewer).filter((event) => {
          if (state.kind === "historical" && event.kind !== "historical") return false
          if (state.kind === "campaign" && event.kind !== "campaign-event") return false
          if (state.campaign !== "all" && event.campaign !== state.campaign) return false
          if (state.scope === "major" && !isMajorRecord(event)) return false
          const { startYear, endYear } = eventYearBounds(event)
          if (Number.isFinite(from) && endYear < from) return false
          if (Number.isFinite(to) && startYear > to) return false
          if (!query) return true
          return [event.name, event.description, event.category, event.campaign, event.label]
            .filter(Boolean)
            .some((value) => String(value).toLocaleLowerCase().includes(query))
        })
        const isFutureCampaignEvent = (event) => {
          if (event.kind !== "campaign-event" || !event.campaign) return false
          const currentDate = campaignById.get(event.campaign)?.currentDate
          return currentDate ? compareDatePoints(eventStartPoint(event), currentDate) > 0 : false
        }
        const hiddenFutureCount = state.future ? 0 : matching.filter(isFutureCampaignEvent).length
        const filtered = matching
          .filter((event) => state.future || !isFutureCampaignEvent(event))
          .sort(
            (a, b) =>
              b.year - a.year ||
              (b.month ?? -1) - (a.month ?? -1) ||
              (b.day ?? -1) - (a.day ?? -1) ||
              Number(isMilestone(b)) - Number(isMilestone(a)) ||
              a.name.localeCompare(b.name),
          )

        const currentMarkers = accessibleCampaigns
          .filter((campaign) => state.kind !== "historical")
          .filter((campaign) => state.campaign === "all" || state.campaign === campaign.id)
          .filter((campaign) => {
            if (Number.isFinite(from) && campaign.currentDate.year < from) return false
            if (Number.isFinite(to) && campaign.currentDate.year > to) return false
            return true
          })
          .map((campaign) => ({
            ...campaign.currentDate,
            datePrecision: "day",
            kind: "campaign-now",
            campaign: campaign.id,
            name: campaign.name,
            source: campaign.source,
          }))

        const timelineItems = [...filtered, ...currentMarkers].sort(
          (a, b) =>
            b.year - a.year ||
            (b.month ?? -1) - (a.month ?? -1) ||
            (b.day ?? -1) - (a.day ?? -1) ||
            Number(b.kind === "campaign-now") - Number(a.kind === "campaign-now") ||
            Number(isMilestone(b)) - Number(isMilestone(a)) ||
            a.name.localeCompare(b.name),
        )

        const grouped = new Map()
        for (const event of timelineItems) {
          if (!grouped.has(event.year)) grouped.set(event.year, [])
          grouped.get(event.year).push(event)
        }

        const canonicalRecords = records.filter(
          (event) => event.kind === "historical" && !event.campaign,
        )

        const canonicalContext = (event) => {
          if (!isMilestone(event)) return []
          const point = eventStartPoint(event)
          const matches = canonicalRecords
            .map((candidate) => {
              if (candidate.year !== point.year) return null
              if (
                point.datePrecision === "day" &&
                candidate.datePrecision === "day" &&
                candidate.month === point.month &&
                candidate.day === point.day
              )
                return { candidate, rank: 0 }
              if (Number.isInteger(point.month) && candidate.month === point.month) {
                const distance =
                  candidate.datePrecision === "day" && Number.isInteger(point.day)
                    ? Math.abs(candidate.day - point.day)
                    : -1
                return { candidate, rank: 1, distance }
              }
              if (candidate.datePrecision === "year") return { candidate, rank: 2, distance: 0 }
              return null
            })
            .filter(Boolean)
            .sort(
              (a, b) =>
                a.rank - b.rank ||
                (a.distance ?? 0) - (b.distance ?? 0) ||
                a.candidate.name.localeCompare(b.candidate.name),
            )

          const seen = new Set()
          const context = []
          for (const match of matches) {
            const name = normalizedName(match.candidate.name)
            if (seen.has(name)) continue
            seen.add(name)
            context.push(match.candidate)
            if (context.length === 3) break
          }
          return context
        }

        const renderCanonicalContext = (event) => {
          const context = canonicalContext(event)
          if (!context.length) return ""
          const items = context
            .map((item) => {
              const href = sourceHref(item.source)
              const external = href && /^https?:\/\//i.test(href)
              const title = href
                ? `<a href="${escapeHtml(href)}"${external ? ' target="_blank" rel="noopener noreferrer"' : ""}>${escapeHtml(item.name)}</a>`
                : escapeHtml(item.name)
              return `<li>${title}<span>${escapeHtml(formatDate(item, data.months))}</span></li>`
            })
            .join("")
          return `<aside class="golarion-history-meanwhile"><strong>Meanwhile in Golarion</strong><ul>${items}</ul></aside>`
        }

        const renderEvent = (event) => {
          const campaignClass = event.campaign
            ? ` history-campaign--${normalizeCampaignKey(event.campaign)}`
            : ""
          if (event.kind === "campaign-now") {
            const source = sourceHref(event.source)
            return `<aside class="golarion-history-now${campaignClass}">
              <span>Campaign current date</span>
              <strong>${source ? `<a href="${escapeHtml(source)}">${escapeHtml(event.name)}</a>` : escapeHtml(event.name)}</strong>
              <time>${escapeHtml(formatDate(event, data.months))}</time>
            </aside>`
          }
          const source = sourceHref(event.source)
          const sourceLabel =
            event.campaign || (event.kind === "historical" ? "Golarion History" : "Source")
          const external = source && /^https?:\/\//i.test(source)
          const milestone = isMilestone(event)
          const milestoneBadge = milestone ? "<span>Milestone</span>" : ""
          const expanded = state.density === "expanded"
          return `<article class="golarion-history-event ${event.kind === "historical" ? "is-history" : "is-campaign"}${campaignClass}${milestone ? " is-milestone" : ""}${expanded ? "" : " is-compact"}">
            <div class="golarion-history-event-date">${escapeHtml(formatDate(event, data.months))}</div>
            <div class="golarion-history-event-body">
              <div class="golarion-history-event-meta"><span>${escapeHtml(sourceLabel)}</span>${milestoneBadge}${event.category ? `<span>${escapeHtml(event.category)}</span>` : ""}</div>
              <h3>${escapeHtml(event.name)}</h3>
              ${expanded && event.description ? `<p>${escapeHtml(event.description)}</p>` : ""}
              ${expanded ? renderCanonicalContext(event) : ""}
              ${expanded && source ? `<p class="golarion-history-source"><a href="${escapeHtml(source)}"${external ? ' target="_blank" rel="noopener noreferrer"' : ""}>View source</a></p>` : ""}
            </div>
          </article>`
        }

        const groupByDate = (events) => {
          const groups = []
          const byDate = new Map()
          for (const event of events) {
            if (event.datePrecision !== "day" || event.kind === "campaign-now") {
              groups.push([event])
              continue
            }
            const key = [event.kind, event.campaign || "", event.year, event.month, event.day].join(
              "|",
            )
            let group = byDate.get(key)
            if (!group) {
              group = []
              byDate.set(key, group)
              groups.push(group)
            }
            group.push(event)
          }
          return groups
        }

        const renderDateGroup = (events) => {
          if (events.length < 4) return events.map(renderEvent).join("")

          const milestones = events.filter(isMilestone)
          const featured = milestones.length ? milestones : events.slice(0, 2)
          const featuredSet = new Set(featured)
          const related = events.filter((event) => !featuredSet.has(event))
          if (!related.length) return featured.map(renderEvent).join("")

          const label = milestones.length
            ? `${related.length} related ${related.length === 1 ? "record" : "records"}`
            : `${related.length} more ${related.length === 1 ? "record" : "records"}`
          return `<div class="golarion-history-cluster">
            ${featured.map(renderEvent).join("")}
            <details class="golarion-history-related"${query ? " open" : ""}>
              <summary>${label}</summary>
              <div class="golarion-history-related-records">${related.map(renderEvent).join("")}</div>
            </details>
          </div>`
        }

        const eraGroups = new Map()
        for (const [year, events] of grouped.entries()) {
          const era = eraForYear(year)
          if (!eraGroups.has(era.id)) eraGroups.set(era.id, { era, years: [] })
          eraGroups.get(era.id).years.push({ year, events })
        }

        const yearsMarkup = [...eraGroups.values()]
          .map(({ era, years }) => {
            const yearSections = years
              .map(({ year, events }) => {
                const eventMarkup = groupByDate(events).map(renderDateGroup).join("")
                return `<section class="golarion-history-year" id="history-year-${year}"><h3>${year} AR</h3>${eventMarkup}</section>`
              })
              .join("")
            return `<section class="golarion-history-era" id="history-era-${era.id}">
              <header><span>Historical era</span><h2>${era.name}</h2></header>
              ${yearSections}
            </section>`
          })
          .join("")

        if (jumpNode) {
          const eraLinks = [...eraGroups.values()]
            .map(
              ({ era }) =>
                `<a href="#history-era-${era.id}">${escapeHtml(era.name.replace(/^Age (of |Before )?/, ""))}</a>`,
            )
            .join("")
          jumpNode.innerHTML = eraGroups.size
            ? `<div class="golarion-history-era-links"><span>Jump to era</span>${eraLinks}</div>
               <div class="golarion-history-year-jump">
                 <label>Jump to year <input type="number" data-history-jump-year inputmode="numeric" placeholder="e.g. 4719"></label>
                 <button type="button" data-history-jump-year-go>Go</button>
                 <span data-history-jump-status aria-live="polite"></span>
               </div>`
            : ""
          const yearInput = jumpNode.querySelector("[data-history-jump-year]")
          const yearStatus = jumpNode.querySelector("[data-history-jump-status]")
          const jumpToYear = () => {
            const year = Number(yearInput?.value)
            if (!Number.isInteger(year)) {
              if (yearStatus) yearStatus.textContent = "Enter a year."
              return
            }
            if (!grouped.has(year)) {
              if (yearStatus) yearStatus.textContent = `No records for ${year} AR in this view.`
              return
            }
            if (yearStatus) yearStatus.textContent = ""
            location.hash = `history-year-${year}`
          }
          jumpNode
            .querySelector("[data-history-jump-year-go]")
            ?.addEventListener("click", jumpToYear)
          yearInput?.addEventListener("keydown", (event) => {
            if (event.key === "Enter") jumpToYear()
          })
        }

        if (countNode)
          countNode.textContent = `${filtered.length} ${filtered.length === 1 ? "record" : "records"}${hiddenFutureCount ? ` · ${hiddenFutureCount} future ${hiddenFutureCount === 1 ? "record" : "records"} hidden` : ""}`
        if (resultsNode)
          resultsNode.innerHTML =
            yearsMarkup ||
            '<p class="golarion-history-empty">No historical records match these filters.</p>'
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
      scopeSelect?.addEventListener("change", (event) => {
        state.scope = event.target.value === "major" ? "major" : "all"
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
      densitySelect?.addEventListener("change", (event) => {
        state.density = event.target.value === "compact" ? "compact" : "expanded"
        updateResults()
      })
      futureInput?.addEventListener("change", (event) => {
        state.future = event.target.checked
        updateResults()
      })
      clearButton?.addEventListener("click", () => {
        state.query = ""
        state.kind = "all"
        state.campaign = "all"
        state.scope = "all"
        state.from = ""
        state.to = ""
        state.future = false
        state.density = "expanded"
        if (queryInput) queryInput.value = ""
        if (kindSelect) kindSelect.value = "all"
        if (campaignSelect) campaignSelect.value = "all"
        if (scopeSelect) scopeSelect.value = "all"
        if (fromInput) fromInput.value = ""
        if (toInput) toInput.value = ""
        if (futureInput) futureInput.checked = false
        if (densitySelect) densitySelect.value = "expanded"
        updateResults()
      })

      renderResults()
    } catch (error) {
      console.error("Failed to load Golarion history explorer", error)
      root.innerHTML =
        '<p class="golarion-calendar-error">Golarion history could not be loaded.</p>'
    }
  }

  document.addEventListener("nav", install)
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", install, { once: true })
  else install()
})()
