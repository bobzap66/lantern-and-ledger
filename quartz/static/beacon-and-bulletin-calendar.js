;(() => {
  const escapeHtml = (value) =>
    String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;")

  const mod = (value, divisor) => ((value % divisor) + divisor) % divisor

  const leapYear = (year) => year % 4 === 0

  const daysInMonth = (data, year, month) =>
    data.monthLengths[month] + (month === 1 && leapYear(year) ? 1 : 0)

  const serialDay = (data, year, month, day) => {
    const anchor = data.weekdayAnchor
    const leapDays = Math.floor((year - 1) / 4) - Math.floor((anchor.year - 1) / 4)
    let total = (year - anchor.year) * 365 + leapDays + day - 1
    for (let index = 0; index < month; index += 1) total += daysInMonth(data, year, index)
    return total
  }

  const siteBase = () => (document.body?.dataset?.basepath || "").replace(/\/$/, "")

  const normalizeCampaignKey = (value) =>
    String(value || "")
      .trim()
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")

  const campaignAccessEnabled = (campaign) => {
    const key = normalizeCampaignKey(campaign)
    if (!key || typeof localStorage === "undefined") return false
    try {
      return localStorage.getItem(`isr-campaign-spoilers:${key}`) === "true"
    } catch (_) {
      return false
    }
  }

  const install = async () => {
    const root = document.querySelector("#beacon-and-bulletin-calendar")
    if (!root || root.dataset.initialized === "true") return
    root.dataset.initialized = "true"
    try {
      const response = await fetch(`${siteBase()}/static/beacon-and-bulletin-calendar.json`, {
        cache: "no-cache",
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const data = await response.json()
      if (
        !Array.isArray(data.months) ||
        !Array.isArray(data.weekdays) ||
        !Array.isArray(data.campaigns) ||
        !Array.isArray(data.events)
      ) {
        throw new Error("Pact calendar data is incomplete")
      }

      const campaigns = data.campaigns
      const initialCampaign = campaigns[0]
      const initialDate = initialCampaign?.currentDate || { year: 325, month: 0, day: 1 }
      const state = {
        campaign: initialCampaign?.id || "all",
        year: initialDate.year,
        month: initialDate.month,
        day: initialDate.day,
      }

      const currentCampaign = () => campaigns.find((campaign) => campaign.id === state.campaign)
      const visibleEvents = () =>
        data.events.filter(
          (event) =>
            (state.campaign === "all" || event.campaign === state.campaign) &&
            (event.visibility !== "campaign-only" || campaignAccessEnabled(event.campaign)),
        )

      const render = () => {
        const monthName = data.months[state.month]
        const currentDate = currentCampaign()?.currentDate
        const firstWeekday = mod(
          data.weekdayAnchor.weekday + serialDay(data, state.year, state.month, 1),
          data.weekdays.length,
        )
        const days = daysInMonth(data, state.year, state.month)
        const events = visibleEvents()
        const campaignOptions = campaigns
          .map(
            (campaign) =>
              `<option value="${escapeHtml(campaign.id)}"${campaign.id === state.campaign ? " selected" : ""}>${escapeHtml(campaign.name)}</option>`,
          )
          .join("")
        const cells = [
          ...Array.from(
            { length: firstWeekday },
            () =>
              '<span class="pact-calendar-day pact-calendar-day--blank" aria-hidden="true"></span>',
          ),
          ...Array.from({ length: days }, (_, index) => {
            const day = index + 1
            const dayEvents = events.filter(
              (event) =>
                event.year === state.year && event.month === state.month && event.day === day,
            )
            const isSelected = state.day === day
            const isCampaignDate =
              currentDate &&
              currentCampaign()?.id === state.campaign &&
              currentDate.year === state.year &&
              currentDate.month === state.month &&
              currentDate.day === day &&
              campaignAccessEnabled(state.campaign)
            const classes = [
              "pact-calendar-day",
              isSelected ? "is-selected" : "",
              isCampaignDate ? "is-campaign-date" : "",
              dayEvents.length ? "has-events" : "",
            ]
              .filter(Boolean)
              .join(" ")
            const eventNames = dayEvents.map((event) => escapeHtml(event.name)).join("; ")
            const label = `${data.weekdays[mod(firstWeekday + index, data.weekdays.length)]} ${day} ${monthName} ${state.year} AG${dayEvents.length ? `: ${eventNames}` : ""}`
            return `<button class="${classes}" type="button" data-day="${day}" aria-label="${escapeHtml(label)}"${isSelected ? ' aria-pressed="true"' : ""}><span class="pact-calendar-day__number">${day}</span>${isCampaignDate ? '<span class="pact-calendar-day__marker">Campaign date</span>' : ""}${dayEvents.length ? `<span class="pact-calendar-day__events">${dayEvents.length} event${dayEvents.length === 1 ? "" : "s"}</span>` : ""}</button>`
          }),
        ].join("")
        const selectedEvents = events.filter(
          (event) =>
            event.year === state.year && event.month === state.month && event.day === state.day,
        )
        const weekday = data.weekdays[mod(firstWeekday + state.day - 1, data.weekdays.length)]
        const details = selectedEvents.length
          ? `<ul class="pact-calendar-events">${selectedEvents.map((event) => `<li><strong>${escapeHtml(event.name)}</strong>${event.description ? `<p>${escapeHtml(event.description)}</p>` : ""}${event.source ? `<a href="${siteBase()}/${String(event.source).replace(/^\/+/, "")}">Read campaign record</a>` : ""}</li>`).join("")}</ul>`
          : '<p class="pact-calendar-empty-day">No recorded events on this day.</p>'

        root.innerHTML = `
          <section class="pact-calendar" aria-label="Calendar of Pact Worlds">
            <div class="pact-calendar-toolbar">
              <label>Campaign <select data-campaign><option value="all">All campaigns</option>${campaignOptions}</select></label>
              <div class="pact-calendar-navigation"><button type="button" data-month-step="-1" aria-label="Previous month">←</button><h2>${escapeHtml(monthName)} ${state.year} AG</h2><button type="button" data-month-step="1" aria-label="Next month">→</button></div>
            </div>
            <div class="pact-calendar-grid" role="grid" aria-label="${escapeHtml(monthName)} ${state.year} AG">
              ${data.weekdays.map((day) => `<div class="pact-calendar-weekday" role="columnheader">${escapeHtml(day)}</div>`).join("")}
              ${cells}
            </div>
            <section class="pact-calendar-details" aria-live="polite"><h3>${escapeHtml(weekday)} · ${state.day} ${escapeHtml(monthName)} ${state.year} AG</h3>${details}</section>
            <p class="pact-calendar-note">Pact dates use a 24-hour day, seven named weekdays, and a leap day in Calistril every four years.</p>
          </section>`
      }

      root.addEventListener("click", (event) => {
        const dayButton = event.target.closest("[data-day]")
        if (dayButton) {
          state.day = Number(dayButton.dataset.day)
          render()
          return
        }
        const monthButton = event.target.closest("[data-month-step]")
        if (monthButton) {
          state.month += Number(monthButton.dataset.monthStep)
          if (state.month < 0) {
            state.month = data.months.length - 1
            state.year -= 1
          }
          if (state.month >= data.months.length) {
            state.month = 0
            state.year += 1
          }
          state.day = Math.min(state.day, daysInMonth(data, state.year, state.month))
          render()
        }
      })
      root.addEventListener("change", (event) => {
        if (!event.target.matches("[data-campaign]")) return
        state.campaign = event.target.value
        const campaign = currentCampaign()
        if (campaign?.currentDate) {
          state.year = campaign.currentDate.year
          state.month = campaign.currentDate.month
          state.day = campaign.currentDate.day
        }
        render()
      })
      document.addEventListener("isr:campaign-spoilers-changed", render)
      render()
    } catch (error) {
      root.innerHTML = `<p class="pact-calendar-error">Calendar unavailable: ${escapeHtml(error.message)}</p>`
    }
  }

  document.addEventListener("nav", install)
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", install, { once: true })
  else install()
})()
