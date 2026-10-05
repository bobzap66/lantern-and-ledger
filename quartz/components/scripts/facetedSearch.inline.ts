// @ts-nocheck - browser-side Quartz component script

const facetCampaignNames = {
  "abomination-vaults": "Abomination Vaults",
  "claws-of-the-tyrant": "Claws of the Tyrant",
  "curtain-call": "Curtain Call",
  kingmaker: "Kingmaker",
  "season-of-ghosts": "Season of Ghosts",
  general: "General reference",
}

const facetTypeNames = {
  articles: "Articles & chronicles",
  characters: "Characters & NPCs",
  gazette: "Lantern & Ledger",
  groups: "Groups & factions",
  locations: "Locations & settlements",
  reference: "Reference & history",
  sessions: "Session notes",
  summaries: "Campaign summaries",
  vignettes: "Vignettes",
  world: "World & government",
}

const facetNormalize = (value) =>
  String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()

const facetCampaign = (slug) => {
  const match = /^campaigns\/([^/]+)(?:\/|$)/i.exec(slug)
  const key = match?.[1]?.toLowerCase()
  return key && key !== "index" ? key : "general"
}

const facetType = (slug) => {
  const segments = slug.toLowerCase().split("/")
  if (segments[0] === "the-lantern-and-ledger") return "gazette"
  if (segments.includes("session-notes")) return "sessions"
  if (segments.includes("characters") || segments.includes("npcs")) return "characters"
  if (segments.includes("vignettes")) return "vignettes"
  if (segments.includes("locations") || segments.includes("settlements")) return "locations"
  if (segments.includes("groups") || segments.includes("factions")) return "groups"
  if (
    segments.includes("articles") ||
    segments.includes("chapters") ||
    segments.includes("chronicles-of-the-new-roseguard") ||
    segments.includes("campaign-history")
  )
    return "articles"
  if (segments.some((segment) => segment.includes("story-so-far") || segment.endsWith("-timeline")))
    return "summaries"
  if (
    segments[0] === "external-references" ||
    segments.includes("reference") ||
    ["calendar", "history", "on-this-date-in-history"].includes(segments[0])
  )
    return "reference"
  return "world"
}

const facetLabel = (names, key) => {
  if (names[key]) return names[key]
  return key
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

const facetBasePath = () => document.body?.dataset?.basepath ?? ""
const facetHref = (slug) => `${facetBasePath()}/${slug}`.replace(/\/{2,}/g, "/")

const facetDecode = (value) => {
  const textarea = document.createElement("textarea")
  textarea.innerHTML = String(value ?? "")
  return textarea.value
}

const facetTokens = (query) => {
  const normalized = facetNormalize(query)
  if (!normalized) return []
  const parts = normalized.split(" ").filter(Boolean)
  return parts.length > 1 ? parts.filter((part) => part.length > 1) : parts
}

const facetSnippet = (content, tokens) => {
  const plain = facetDecode(content).replace(/\s+/g, " ").trim()
  if (!plain) return ""
  const normalized = facetNormalize(plain)
  const positions = tokens.map((token) => normalized.indexOf(token)).filter((index) => index >= 0)
  const first = positions.length > 0 ? Math.min(...positions) : 0
  const start = Math.max(0, first - 65)
  const end = Math.min(plain.length, start + 210)
  return `${start > 0 ? "…" : ""}${plain.slice(start, end).trim()}${end < plain.length ? "…" : ""}`
}

const facetScore = (entry, tokens) => {
  if (tokens.length === 0) return 1
  const title = entry.normalizedTitle
  const slug = entry.normalizedSlug
  const tags = entry.normalizedTags
  const metadata = `${title} ${slug} ${tags}`
  let content
  const contains = (token) => {
    if (metadata.includes(token)) return true
    content ??= facetNormalize(entry.content)
    return content.includes(token)
  }
  if (!tokens.every(contains)) return 0

  let score = 0
  const phrase = tokens.join(" ")
  if (title === phrase) score += 180
  else if (title.startsWith(phrase)) score += 95
  else if (title.includes(phrase)) score += 70
  if (slug.includes(phrase)) score += 28

  content ??= facetNormalize(entry.content)
  for (const token of tokens) {
    if (title.startsWith(token)) score += 32
    else if (title.includes(token)) score += 24
    if (tags.includes(token)) score += 16
    if (slug.includes(token)) score += 10
    const position = content.indexOf(token)
    if (position >= 0) score += position < 500 ? 8 : 4
  }
  return score
}

const setupFacetedSearch = async () => {
  window.__lanternFacetedSearchCleanup?.()

  let root = document.querySelector(".faceted-search")
  if (!root) {
    const template = document.querySelector("template.faceted-search-template")
    const stockSearch = document.querySelector(".search")
    const replacement = template?.content?.firstElementChild?.cloneNode(true)
    if (stockSearch && replacement instanceof HTMLElement) {
      stockSearch.replaceWith(replacement)
      root = replacement
    }
  }
  if (!root) return

  const trigger = root.querySelector(".faceted-search__trigger")
  const overlay = root.querySelector(".faceted-search__overlay")
  const closeButton = root.querySelector(".faceted-search__close")
  const queryInput = root.querySelector(".faceted-search__query")
  const campaignSelect = root.querySelector(".faceted-search__campaign")
  const typeSelect = root.querySelector(".faceted-search__type")
  const clearButton = root.querySelector(".faceted-search__clear")
  const status = root.querySelector(".faceted-search__status")
  const results = root.querySelector(".faceted-search__results")
  if (!trigger || !overlay || !queryInput || !campaignSelect || !typeSelect || !status || !results)
    return

  let index
  try {
    index = await fetchData
  } catch {
    status.textContent = "The search index could not be loaded."
    return
  }

  let entries = []
  const loadEntries = (source) => {
    entries = Object.entries(source ?? {}).map(([slug, details]) => ({
      slug,
      title: facetDecode(details?.title || slug.split("/").at(-1) || slug),
      content: details?.content || "",
      tags: Array.isArray(details?.tags) ? details.tags : [],
      campaign: facetCampaign(slug),
      type: facetType(slug),
      normalizedTitle: facetNormalize(details?.title),
      normalizedSlug: facetNormalize(slug.replaceAll("-", " ").replaceAll("/", " ")),
      normalizedTags: facetNormalize((details?.tags || []).join(" ")),
    }))
  }
  loadEntries(index)

  const fillSelect = (select, counts, names, allLabel) => {
    const selected = select.value
    select.replaceChildren()
    const all = document.createElement("option")
    all.value = ""
    all.textContent = `${allLabel} (${entries.length})`
    select.appendChild(all)
    for (const [key, count] of [...counts].sort((a, b) =>
      facetLabel(names, a[0]).localeCompare(facetLabel(names, b[0])),
    )) {
      const option = document.createElement("option")
      option.value = key
      option.textContent = `${facetLabel(names, key)} (${count})`
      select.appendChild(option)
    }
    if ([...select.options].some((option) => option.value === selected)) select.value = selected
  }

  const populateFilters = () => {
    const campaigns = new Map()
    const types = new Map()
    for (const entry of entries) {
      campaigns.set(entry.campaign, (campaigns.get(entry.campaign) || 0) + 1)
      types.set(entry.type, (types.get(entry.type) || 0) + 1)
    }
    fillSelect(campaignSelect, campaigns, facetCampaignNames, "All campaigns")
    fillSelect(typeSelect, types, facetTypeNames, "All record types")
  }
  populateFilters()

  let activeIndex = -1
  let searchTimer = 0
  let lastFocus = null

  const resultLinks = () => [...results.querySelectorAll(".faceted-search__result")]
  const setActive = (next) => {
    const links = resultLinks()
    if (links.length === 0) {
      activeIndex = -1
      return
    }
    activeIndex = Math.max(0, Math.min(next, links.length - 1))
    links.forEach((link, index) => link.classList.toggle("is-active", index === activeIndex))
    links[activeIndex]?.scrollIntoView({ block: "nearest" })
  }

  const render = () => {
    const query = queryInput.value.trim()
    const tokens = facetTokens(query)
    const campaign = campaignSelect.value
    const type = typeSelect.value
    results.replaceChildren()
    activeIndex = -1

    if (tokens.length === 0 && !campaign && !type) {
      status.textContent = `${entries.length.toLocaleString()} records available`
      const prompt = document.createElement("p")
      prompt.className = "faceted-search__empty"
      prompt.textContent = "Enter a name, place, event, or phrase—or choose a filter to browse."
      results.appendChild(prompt)
      return
    }

    const matches = []
    for (const entry of entries) {
      if (campaign && entry.campaign !== campaign) continue
      if (type && entry.type !== type) continue
      const score = facetScore(entry, tokens)
      if (score > 0) matches.push({ entry, score })
    }
    matches.sort((a, b) => b.score - a.score || a.entry.title.localeCompare(b.entry.title))

    const limit = 40
    const visible = matches.slice(0, limit)
    status.textContent =
      matches.length > limit
        ? `Showing ${limit} of ${matches.length.toLocaleString()} matching records`
        : `${matches.length.toLocaleString()} matching ${matches.length === 1 ? "record" : "records"}`

    if (visible.length === 0) {
      const empty = document.createElement("p")
      empty.className = "faceted-search__empty"
      empty.textContent = "No records match those terms and filters."
      results.appendChild(empty)
      return
    }

    for (const { entry } of visible) {
      const link = document.createElement("a")
      link.className = "faceted-search__result internal"
      link.href = facetHref(entry.slug)
      link.setAttribute("role", "option")

      const title = document.createElement("h3")
      title.className = "faceted-search__result-title"
      title.textContent = entry.title
      link.appendChild(title)

      const meta = document.createElement("p")
      meta.className = "faceted-search__result-meta"
      for (const label of [
        facetLabel(facetCampaignNames, entry.campaign),
        facetLabel(facetTypeNames, entry.type),
      ]) {
        const badge = document.createElement("span")
        badge.className = "faceted-search__badge"
        badge.textContent = label
        meta.appendChild(badge)
      }
      link.appendChild(meta)

      const snippetText = facetSnippet(entry.content, tokens)
      if (snippetText) {
        const snippet = document.createElement("p")
        snippet.className = "faceted-search__snippet"
        snippet.textContent = snippetText
        link.appendChild(snippet)
      }
      results.appendChild(link)
    }
  }

  const scheduleRender = () => {
    window.clearTimeout(searchTimer)
    searchTimer = window.setTimeout(render, 70)
  }

  const open = () => {
    lastFocus = document.activeElement
    overlay.hidden = false
    trigger.setAttribute("aria-expanded", "true")
    document.body.classList.add("faceted-search-open")
    render()
    window.requestAnimationFrame(() => queryInput.focus())
  }

  const close = () => {
    overlay.hidden = true
    trigger.setAttribute("aria-expanded", "false")
    document.body.classList.remove("faceted-search-open")
    if (lastFocus instanceof HTMLElement) lastFocus.focus()
  }

  const clear = () => {
    queryInput.value = ""
    campaignSelect.value = ""
    typeSelect.value = ""
    render()
    queryInput.focus()
  }

  const onDocumentKeydown = (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault()
      overlay.hidden ? open() : close()
      return
    }
    if (overlay.hidden) return
    if (event.key === "Escape") {
      event.preventDefault()
      close()
    } else if (event.key === "ArrowDown") {
      event.preventDefault()
      setActive(activeIndex + 1)
    } else if (event.key === "ArrowUp") {
      event.preventDefault()
      setActive(activeIndex <= 0 ? 0 : activeIndex - 1)
    } else if (event.key === "Enter" && activeIndex >= 0) {
      const active = resultLinks()[activeIndex]
      if (active) {
        event.preventDefault()
        active.click()
      }
    }
  }

  const onOverlayClick = (event) => {
    if (event.target === overlay) close()
  }
  const onResultClick = (event) => {
    if (event.target.closest(".faceted-search__result")) close()
  }
  const onIndexUpdated = async () => {
    try {
      index = await fetchData
      loadEntries(index)
      populateFilters()
      render()
    } catch {}
  }

  trigger.addEventListener("click", open)
  closeButton?.addEventListener("click", close)
  overlay.addEventListener("click", onOverlayClick)
  queryInput.addEventListener("input", scheduleRender)
  campaignSelect.addEventListener("change", render)
  typeSelect.addEventListener("change", render)
  clearButton?.addEventListener("click", clear)
  results.addEventListener("click", onResultClick)
  document.addEventListener("keydown", onDocumentKeydown)
  document.addEventListener("content-index-updated", onIndexUpdated)
  render()

  window.__lanternFacetedSearchCleanup = () => {
    window.clearTimeout(searchTimer)
    document.removeEventListener("keydown", onDocumentKeydown)
    document.removeEventListener("content-index-updated", onIndexUpdated)
    document.body.classList.remove("faceted-search-open")
  }
}

document.addEventListener("nav", setupFacetedSearch)
setupFacetedSearch()
