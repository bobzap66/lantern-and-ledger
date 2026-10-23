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

  const weekdayOf = (data, year, month, day) =>
    mod(data.weekdayAnchor.weekday + serialDay(data, year, month, day), data.weekdays.length)

  const pactToday = () => {
    const now = new Date()
    return { year: now.getFullYear() - 1700, month: now.getMonth(), day: now.getDate() }
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

      if (
        !data.weekdayAnchor ||
        !Array.isArray(data.monthLengths) ||
        data.monthLengths.length !== data.months.length
      )
        throw new Error("Pact calendar is missing its weekday anchor or month lengths")

      const campaigns = data.campaigns
      const initialCampaign = campaigns[0]
      const initialDate = initialCampaign?.currentDate || { year: 325, month: 0, day: 1 }
      const storageKey = "isr-beacon-calendar-view"
      let savedView = null
      try {
        savedView = JSON.parse(localStorage.getItem(storageKey) || "null")
      } catch (_) {}
      const state = {
        campaign: campaigns.some((campaign) => campaign.id === savedView?.campaign)
          ? savedView.campaign
          : initialCampaign?.id || "all",
        year: Number.isInteger(savedView?.year) ? savedView.year : initialDate.year,
        month:
          Number.isInteger(savedView?.month) &&
          savedView.month >= 0 &&
          savedView.month < data.months.length
            ? savedView.month
            : initialDate.month,
        day:
          Number.isInteger(savedView?.day) && savedView.day > 0 ? savedView.day : initialDate.day,
      }
      const saveView = () => {
        try {
          localStorage.setItem(storageKey, JSON.stringify(state))
        } catch (_) {}
      }

      const currentCampaign = () => campaigns.find((campaign) => campaign.id === state.campaign)
      const campaignName = (id) => campaigns.find((campaign) => campaign.id === id)?.name || id
      const visibleEvents = () =>
        data.events.filter(
          (event) =>
            (state.campaign === "all" ||
              (event.kind === "campaign-event" && event.campaign === state.campaign)) &&
            (event.visibility !== "campaign-only" || campaignAccessEnabled(event.campaign)),
        )

      const focusDate = () =>
        state.campaign === "all" ? pactToday() : currentCampaign()?.currentDate
      const jumpToFocus = () => {
        const focus = focusDate()
        if (!focus) return
        state.year = focus.year
        state.month = focus.month
        state.day = focus.day
      }
      const eventOccursOn = (event, year, month, day) => {
        if (event.isMultiDay && event.rangeStart && event.rangeEnd) {
          const current = serialDay(data, year, month, day)
          const start = serialDay(
            data,
            event.rangeStart.year,
            event.rangeStart.month,
            event.rangeStart.day,
          )
          const end = serialDay(data, event.rangeEnd.year, event.rangeEnd.month, event.rangeEnd.day)
          return current >= start && current <= end
        }
        if (event.month !== month) return false
        if (event.year !== undefined && event.year !== year) return false
        if (event.datePrecision === "weekday-rule") {
          const lastDay = daysInMonth(data, year, month)
          for (
            let candidate = lastDay;
            candidate > lastDay - data.weekdays.length;
            candidate -= 1
          ) {
            if (weekdayOf(data, year, month, candidate) === event.weekday) return day === candidate
          }
          return false
        }
        if (event.day !== undefined) {
          if (event.recurrence !== "yearly" && event.year !== year) return false
          return (
            event.day === day ||
            (event.durationDays && day >= event.day && day < event.day + event.durationDays)
          )
        }
        return false
      }

      const render = () => {
        const monthName = data.months[state.month]
        const currentDate = currentCampaign()?.currentDate
        const focus = focusDate()
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
            const dayEvents = events.filter((event) =>
              eventOccursOn(event, state.year, state.month, day),
            )
            const isSelected = state.day === day
            const isFocusDate =
              focus &&
              focus.year === state.year &&
              focus.month === state.month &&
              focus.day === day &&
              (state.campaign === "all" || campaignAccessEnabled(state.campaign))
            const isCampaignDate = isFocusDate && state.campaign !== "all"
            const isToday = isFocusDate && state.campaign === "all"
            const classes = [
              "pact-calendar-day",
              isSelected ? "is-selected" : "",
              isCampaignDate ? "is-campaign-date" : "",
              isToday ? "is-today" : "",
              dayEvents.some((event) => event.kind === "holiday") ? "has-holiday" : "",
              dayEvents.length ? "has-events" : "",
            ]
              .filter(Boolean)
              .join(" ")
            const eventNames = dayEvents.map((event) => escapeHtml(event.name)).join("; ")
            const label = `${data.weekdays[mod(firstWeekday + index, data.weekdays.length)]} ${day} ${monthName} ${state.year} AG${dayEvents.length ? `: ${eventNames}` : ""}`
            const eventPreview = dayEvents
              .slice(0, 2)
              .map((event) => `<span>${escapeHtml(event.name)}</span>`)
              .join("")
            const moreEvents =
              dayEvents.length > 2 ? `<span>+${dayEvents.length - 2} more</span>` : ""
            return `<button class="${classes}" type="button" data-day="${day}" aria-label="${escapeHtml(label)}"${isSelected ? ' aria-pressed="true"' : ""}><span class="pact-calendar-day__number">${day}</span>${isCampaignDate ? '<span class="pact-calendar-day__marker">Campaign date</span>' : isToday ? '<span class="pact-calendar-day__marker">Today</span>' : ""}${dayEvents.length ? `<span class="pact-calendar-day__events">${eventPreview}${moreEvents}</span>` : ""}</button>`
          }),
        ].join("")
        const selectedEvents = events.filter((event) =>
          eventOccursOn(event, state.year, state.month, state.day),
        )
        const monthEvents = events.filter(
          (event) =>
            event.month === state.month &&
            event.datePrecision === "month" &&
            (event.year === undefined || event.year === state.year),
        )
        const yearEvents = events.filter(
          (event) => event.year === state.year && event.datePrecision === "year",
        )
        const weekday = data.weekdays[mod(firstWeekday + state.day - 1, data.weekdays.length)]
        const eventMarkup = (event) =>
          `<li class="is-${escapeHtml(event.kind || "event")}"><strong>${escapeHtml(event.name)}</strong><span>${escapeHtml(event.campaign ? campaignName(event.campaign) : event.kind === "historical" ? "Pact Worlds History" : event.kind === "holiday" ? "Pact Worlds observance" : "Campaign event")}${event.datePrecision === "year" ? ` · ${event.year} AG` : event.datePrecision === "month" ? ` · ${data.months[event.month]}${event.year !== undefined ? ` ${event.year} AG` : " (annual/seasonal)"}` : ""}</span>${event.description ? `<p>${escapeHtml(event.description)}</p>` : ""}${event.citation ? `<small>${escapeHtml(event.citation)}</small>` : ""}${event.source ? `<a href="${siteBase()}/${String(event.source)}/">Read record</a>` : ""}</li>`
        const eventList = (items) =>
          items.length
            ? `<ul class="pact-calendar-events">${items.map(eventMarkup).join("")}</ul>`
            : '<p class="pact-calendar-empty-day">No recorded events.</p>'
        const details = `${eventList(selectedEvents)}${monthEvents.length ? `<h4>This Month in History & Observance</h4>${eventList(monthEvents)}` : ""}${yearEvents.length ? `<h4>This Year in History</h4>${eventList(yearEvents)}` : ""}`

        root.innerHTML = `
          <section class="pact-calendar" aria-label="Calendar of Pact Worlds">
            <div class="pact-calendar-toolbar">
              <label>Campaign <select data-campaign><option value="all">All campaigns</option>${campaignOptions}</select></label>
              <span class="pact-calendar-filter-note">Select All campaigns to browse shared observances and Pact Worlds history.</span>
              <div class="pact-calendar-navigation"><button type="button" data-year-step="-1" aria-label="Previous year">«</button><button type="button" data-month-step="-1" aria-label="Previous month">‹</button><h2><span>${escapeHtml(monthName)}</span> <button type="button" data-year-edit aria-label="Jump to a specific year">${state.year} AG</button></h2><button type="button" data-month-step="1" aria-label="Next month">›</button><button type="button" data-year-step="1" aria-label="Next year">»</button><button type="button" data-focus>${state.campaign === "all" ? "Today" : "Current campaign date"}</button></div>
            </div>
            <div class="pact-calendar-campaigns"><h3>Campaign chronologies</h3>${[
              "active",
              "upcoming",
              "completed",
              "archived",
            ]
              .map((status) => {
                const matches = campaigns.filter(
                  (campaign) => campaign.status.toLowerCase() === status,
                )
                return matches.length
                  ? `<section><h4>${status === "completed" ? "Completed" : status[0].toUpperCase() + status.slice(1)}</h4><ul>${matches.map((campaign) => `<li><a href="${siteBase()}/${String(campaign.source)}/">${escapeHtml(campaign.name)}</a>${campaign.currentDate ? ` · ${campaign.currentDate.day} ${escapeHtml(data.months[campaign.currentDate.month])} ${campaign.currentDate.year} AG` : ""}</li>`).join("")}</ul></section>`
                  : ""
              })
              .join("")}</div>
            <div class="pact-calendar-grid" role="grid" aria-label="${escapeHtml(monthName)} ${state.year} AG">
              ${data.weekdays.map((day) => `<div class="pact-calendar-weekday" role="columnheader">${escapeHtml(day)}</div>`).join("")}
              ${cells}
            </div>
            <section class="pact-calendar-details" aria-live="polite"><h3>${escapeHtml(weekday)} · ${state.day} ${escapeHtml(monthName)} ${state.year} AG</h3>${details}</section>
            <section class="pact-calendar-today" aria-label="On this date in Pact Worlds history"><h3>On This Date in History</h3><p>${escapeHtml(data.months[pactToday().month])} ${pactToday().day}, ${pactToday().year} AG</p>${eventList(events.filter((event) => event.day !== undefined && eventOccursOn(event, pactToday().year, pactToday().month, pactToday().day) && (event.year === undefined || event.year <= pactToday().year)))}${events.some((event) => event.datePrecision === "month" && event.month === pactToday().month && (event.year === undefined || event.year <= pactToday().year)) ? `<h4>This Month</h4>${eventList(events.filter((event) => event.datePrecision === "month" && event.month === pactToday().month && (event.year === undefined || event.year <= pactToday().year)))}` : ""}${events.some((event) => event.datePrecision === "year" && pactToday().year - event.year >= 100 && (pactToday().year - event.year) % 100 === 0) ? `<h4>This Year in History</h4>${eventList(events.filter((event) => event.datePrecision === "year" && pactToday().year - event.year >= 100 && (pactToday().year - event.year) % 100 === 0))}` : ""}</section>
            <p class="pact-calendar-note">Pact dates use a 24-hour day, seven named weekdays, and a leap day in Calistril every four years.</p>
          </section>`
      }

      root.addEventListener("click", (event) => {
        const dayButton = event.target.closest("[data-day]")
        if (dayButton) {
          state.day = Number(dayButton.dataset.day)
          saveView()
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
          saveView()
          render()
          return
        }
        const yearButton = event.target.closest("[data-year-step]")
        if (yearButton) {
          state.year += Number(yearButton.dataset.yearStep)
          state.day = Math.min(state.day, daysInMonth(data, state.year, state.month))
          saveView()
          render()
          return
        }
        if (event.target.closest("[data-focus]")) {
          jumpToFocus()
          saveView()
          render()
          return
        }
        if (event.target.closest("[data-year-edit]")) {
          const input = document.createElement("input")
          input.type = "number"
          input.value = String(state.year)
          input.setAttribute("aria-label", "Pact year")
          const heading = root.querySelector("[data-year-edit]")
          heading.replaceWith(input)
          input.focus()
          input.select()
          const submit = () => {
            const year = Number(input.value)
            if (!Number.isInteger(year) || year < -10000 || year > 10000) {
              input.setCustomValidity("Enter a year from -10000 to 10000.")
              input.reportValidity()
              return
            }
            state.year = year
            state.day = Math.min(state.day, daysInMonth(data, state.year, state.month))
            saveView()
            render()
          }
          input.addEventListener("keydown", (keyEvent) => {
            if (keyEvent.key === "Enter") submit()
            if (keyEvent.key === "Escape") render()
          })
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
        } else if (state.campaign === "all") {
          jumpToFocus()
        }
        saveView()
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
