// @ts-nocheck - browser-side Quartz component script

const explorerOrder: Record<string, string[]> = {
  "": [
    "campaigns",
    "the-lantern-and-ledger",
    "on-this-date-in-history",
    "calendar",
    "locations",
    "groups",
    "artifacts-and-relics",
    "rules",
    "external-references",
  ],
  campaigns: ["kingmaker", "claws-of-the-tyrant", "season-of-ghosts", "abomination-vaults"],
  "the-lantern-and-ledger": ["the-lantern-and-ledger-history", "staff"],
  "campaigns/kingmaker": [
    "kingmaker-the-story-so-far",
    "kingmaker-timeline",
    "session-notes",
    "characters",
    "npcs",
    "groups",
    "vignettes",
    "thumping-waters",
    "reference",
  ],
  "campaigns/claws-of-the-tyrant": [
    "chapters",
    "claws-of-the-tyrant-timeline",
    "articles",
    "characters",
    "vignettes",
  ],
  "campaigns/claws-of-the-tyrant/chapters": [
    "gravelands-survivors",
    "ashes-for-ozem",
    "blood-and-faith",
  ],
  "campaigns/season-of-ghosts": [
    "season-of-ghosts-the-story-so-far",
    "season-of-ghosts-timeline",
    "session-notes",
    "characters",
    "npcs",
    "contributors",
    "groups",
    "locations",
    "reference",
    "vignettes",
  ],
  "campaigns/abomination-vaults": [
    "abomination-vaults-the-story-so-far",
    "abomination-vaults-timeline",
    "chronicles-of-the-new-roseguard",
    "characters",
    "groups",
    "npcs",
    "vignettes",
    "campaign-history",
  ],
  "campaigns/kingmaker/thumping-waters": ["ruling-council", "government-documents", "settlements"],
  "campaigns/kingmaker/thumping-waters/settlements": [
    "thumpington",
    "olegton",
    "tatzlford",
    "embeth-hall",
    "willowfen",
    "sootscale-valley",
    "greengripe",
    "longtail-island",
    "tok-nikrat",
    "fort-tuskwater",
    "fort-serenko",
    "fort-drelev",
    "varnhold",
    "pitax",
  ],
}

const hiddenExplorerItems = new Set([
  "tags",
  "assets",
  "image-metadata",
  "templates",
  "meta",
  "timeline-metadata",
  "portrait-credits",
  "reconstruction",
])

const normalizeExplorerSegment = (value) =>
  decodeURIComponent(String(value ?? ""))
    .toLowerCase()
    .replace(/[‘’']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

const normalizeExplorerPath = (value) => {
  const parts = String(value ?? "")
    .split("/")
    .filter(Boolean)
    .map(normalizeExplorerSegment)
  if (parts.at(-1) === "index") parts.pop()
  return parts.join("/")
}

const siteRootPath = () => {
  const masthead = document.querySelector(".site-publication-masthead[href]")
  if (!masthead) return ""
  try {
    return normalizeExplorerPath(new URL(masthead.href, document.baseURI).pathname)
  } catch {
    return ""
  }
}

const stripSiteRoot = (value) => {
  const path = normalizeExplorerPath(value)
  const root = siteRootPath()
  if (!root) return path
  if (path === root) return ""
  return path.startsWith(`${root}/`) ? path.slice(root.length + 1) : path
}

const readPublicationContext = () => {
  const context = document.querySelector("#site-publication-explorer-context")
  const currentPublication =
    context?.dataset.currentPublication ||
    document.querySelector("#quartz-body")?.dataset.sitePublication ||
    "lantern-and-ledger"

  let boundaries = []
  try {
    boundaries = JSON.parse(context?.dataset.publicationBoundaries || "[]")
  } catch {
    boundaries = []
  }

  if (!Array.isArray(boundaries) || boundaries.length === 0) {
    boundaries = [{ path: "", publication: "lantern-and-ledger" }]
  }

  return {
    currentPublication,
    boundaries: boundaries
      .map((boundary) => ({
        path: normalizeExplorerPath(boundary?.path),
        publication: String(boundary?.publication || "lantern-and-ledger"),
      }))
      .sort((a, b) => b.path.length - a.path.length),
  }
}

const publicationForPath = (path, context) => {
  const normalized = normalizeExplorerPath(path)
  const boundary = context.boundaries.find(
    (candidate) =>
      candidate.path === "" ||
      normalized === candidate.path ||
      normalized.startsWith(`${candidate.path}/`),
  )
  return boundary?.publication || "lantern-and-ledger"
}

const folderHasCurrentPublication = (path, context) => {
  const normalized = normalizeExplorerPath(path)
  if (publicationForPath(normalized, context) === context.currentPublication) return true

  return context.boundaries.some(
    (boundary) =>
      boundary.publication === context.currentPublication &&
      (boundary.path === normalized || boundary.path.startsWith(`${normalized}/`)),
  )
}

const parentPathForList = (list) => {
  if (list.classList.contains("explorer-ul")) return ""
  const folderItem = list.closest("li")
  const folderContainer = folderItem?.querySelector(":scope > .folder-container")
  return normalizeExplorerPath(folderContainer?.dataset.folderpath ?? "")
}

const explorerItemPath = (item) => {
  const folderContainer = item.querySelector(":scope > .folder-container")
  if (folderContainer) {
    return normalizeExplorerPath(folderContainer.dataset.folderpath ?? "")
  }

  const link = item.querySelector(":scope > a")
  if (link) {
    try {
      return stripSiteRoot(new URL(link.href, document.baseURI).pathname)
    } catch {
      return normalizeExplorerPath(link.textContent)
    }
  }

  return ""
}

const explorerItemKey = (item) => {
  const path = explorerItemPath(item)
  return path.split("/").filter(Boolean).at(-1) ?? ""
}

const explorerItemLabel = (item) => {
  const folderTitle = item.querySelector(":scope > .folder-container .folder-title")
  const fileLink = item.querySelector(":scope > a")
  return String(folderTitle?.textContent ?? fileLink?.textContent ?? "").trim()
}

const explorerItemIsFolder = (item) => Boolean(item.querySelector(":scope > .folder-container"))

const explorerItemMatchesPublication = (item, context) => {
  const path = explorerItemPath(item)
  return explorerItemIsFolder(item)
    ? folderHasCurrentPublication(path, context)
    : publicationForPath(path, context) === context.currentPublication
}

const curateExplorerList = (list, context) => {
  const parentPath = parentPathForList(list)
  const rankedKeys = explorerOrder[parentPath] ?? []
  const rank = new Map(rankedKeys.map((key, index) => [key, index]))

  const sentinel = Array.from(list.children).find((child) =>
    child.classList?.contains("overflow-end"),
  )
  const items = Array.from(list.children).filter(
    (child) => child.tagName === "LI" && !child.classList.contains("overflow-end"),
  )

  for (const item of items) {
    if (
      hiddenExplorerItems.has(explorerItemKey(item)) ||
      !explorerItemMatchesPublication(item, context)
    ) {
      item.remove()
    }
  }

  const visibleItems = items.filter((item) => item.isConnected)
  const sorted = [...visibleItems].sort((a, b) => {
    const aKey = explorerItemKey(a)
    const bKey = explorerItemKey(b)
    const aRank = rank.has(aKey) ? rank.get(aKey) : Number.POSITIVE_INFINITY
    const bRank = rank.has(bKey) ? rank.get(bKey) : Number.POSITIVE_INFINITY

    if (aRank !== bRank) return aRank - bRank

    const aFolder = explorerItemIsFolder(a)
    const bFolder = explorerItemIsFolder(b)
    if (aFolder !== bFolder) return aFolder ? -1 : 1

    return explorerItemLabel(a).localeCompare(explorerItemLabel(b), undefined, {
      numeric: true,
      sensitivity: "base",
    })
  })

  const unchanged = visibleItems.every((item, index) => item === sorted[index])
  if (!unchanged) {
    for (const item of sorted) list.insertBefore(item, sentinel ?? null)
  }

  if (sentinel && sentinel !== list.lastElementChild) list.appendChild(sentinel)
}

let explorerCuratorFrame = 0
const curateAllExplorers = () => {
  cancelAnimationFrame(explorerCuratorFrame)
  explorerCuratorFrame = requestAnimationFrame(() => {
    try {
      const context = readPublicationContext()
      for (const list of document.querySelectorAll(".explorer ul")) {
        curateExplorerList(list, context)
      }
    } catch (error) {
      console.warn("[Explorer curator] Leaving stock Explorer order in place", error)
    }
  })
}

const explorerCuratorObserver = new MutationObserver(curateAllExplorers)

const attachExplorerCurator = () => {
  explorerCuratorObserver.disconnect()
  for (const explorer of document.querySelectorAll(".explorer")) {
    explorerCuratorObserver.observe(explorer, { childList: true, subtree: true })
  }
  curateAllExplorers()
}

document.addEventListener("nav", attachExplorerCurator)
document.addEventListener("render", attachExplorerCurator)
attachExplorerCurator()
