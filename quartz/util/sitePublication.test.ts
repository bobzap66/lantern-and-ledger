import assert from "node:assert/strict"
import test from "node:test"
import {
  getSitePublication,
  getSitePublicationBoundaries,
  getSitePublicationForPath,
  sitePublicationExplorerFilter,
} from "./sitePublication"

test("defaults untagged pages to Lantern & Ledger", () => {
  const publication = getSitePublication(undefined)
  assert.equal(publication.key, "lantern-and-ledger")
  assert.equal(publication.title, "The Lantern and Ledger")
  assert.equal(publication.homeSlug, "lantern-and-ledger")
})

test("resolves Greene Gaming explicitly", () => {
  const publication = getSitePublication({ site_publication: "Greene Gaming" })
  assert.equal(publication.key, "greene-gaming")
  assert.equal(publication.title, "Greene Gaming")
  assert.equal(publication.homeSlug, "")
})

test("resolves Lantern & Ledger explicitly", () => {
  const publication = getSitePublication({ site_publication: "Lantern & Ledger" })
  assert.equal(publication.key, "lantern-and-ledger")
  assert.equal(publication.homeSlug, "lantern-and-ledger")
  assert.equal(publication.archiveLabel, "THE LANTERN AND LEDGER · ARCHIVES")
  assert.equal(publication.searchLabel, "Lantern & Ledger Archive")
})

test("resolves Beacon & Bulletin case-insensitively", () => {
  const publication = getSitePublication({ site_publication: " beacon & bulletin " })
  assert.equal(publication.key, "beacon-and-bulletin")
  assert.equal(publication.title, "Beacon & Bulletin")
  assert.equal(publication.homeSlug, "beacon-and-bulletin")
  assert.equal(publication.archiveLabel, "BEACON & BULLETIN · ARCHIVES")
  assert.equal(publication.searchLabel, "Beacon & Bulletin Archive")
})

test("falls back safely for unknown publication values", () => {
  const publication = getSitePublication({ site_publication: "Unknown Gazette" })
  assert.equal(publication.key, "lantern-and-ledger")
})

test("builds minimal publication boundaries for sibling publications", () => {
  const boundaries = getSitePublicationBoundaries([
    { slug: "index", frontmatter: { site_publication: "Greene Gaming" } },
    { slug: "lantern-and-ledger/index", frontmatter: { site_publication: "Lantern & Ledger" } },
    {
      slug: "lantern-and-ledger/campaigns/index",
      frontmatter: { site_publication: "Lantern & Ledger" },
    },
    {
      slug: "lantern-and-ledger/campaigns/kingmaker/index",
      frontmatter: { site_publication: "Lantern & Ledger" },
    },
    {
      slug: "beacon-and-bulletin/index",
      frontmatter: { site_publication: "Beacon & Bulletin" },
    },
    {
      slug: "beacon-and-bulletin/campaigns/index",
      frontmatter: { site_publication: "Beacon & Bulletin" },
    },
    {
      slug: "beacon-and-bulletin/campaigns/murder-in-metal-city/index",
      frontmatter: { site_publication: "Beacon & Bulletin" },
    },
  ])

  assert.deepEqual(boundaries, [
    { path: "", publication: "greene-gaming" },
    { path: "beacon-and-bulletin", publication: "beacon-and-bulletin" },
    { path: "lantern-and-ledger", publication: "lantern-and-ledger" },
  ])
})

test("resolves sibling publication routes for publication-scoped search", () => {
  const boundaries = [
    { path: "", publication: "greene-gaming" },
    { path: "lantern-and-ledger", publication: "lantern-and-ledger" },
    { path: "beacon-and-bulletin", publication: "beacon-and-bulletin" },
  ]

  assert.equal(getSitePublicationForPath("index", boundaries), "greene-gaming")
  assert.equal(
    getSitePublicationForPath("lantern-and-ledger/campaigns/kingmaker/index", boundaries),
    "lantern-and-ledger",
  )
  assert.equal(
    getSitePublicationForPath("beacon-and-bulletin/staff/joy", boundaries),
    "beacon-and-bulletin",
  )
  assert.equal(
    getSitePublicationForPath("beacon-and-bulletin/campaigns/murder-in-metal-city/index", boundaries),
    "beacon-and-bulletin",
  )
})

test("Explorer filter scopes sibling publication trees", () => {
  const runtime = globalThis as unknown as { document?: unknown }
  const originalDocument = runtime.document
  let currentPublication = "beacon-and-bulletin"
  const boundaries = JSON.stringify([
    { path: "", publication: "greene-gaming" },
    { path: "lantern-and-ledger", publication: "lantern-and-ledger" },
    { path: "beacon-and-bulletin", publication: "beacon-and-bulletin" },
  ])

  runtime.document = {
    querySelector(selector: string) {
      if (selector === "#quartz-body") {
        return {
          getAttribute(name: string) {
            return name === "data-site-publication" ? currentPublication : null
          },
        }
      }
      if (selector === "#site-publication-explorer-context") {
        return {
          getAttribute(name: string) {
            return name === "data-publication-boundaries" ? boundaries : null
          },
        }
      }
      return null
    },
  }

  try {
    const node = (path: string, isFolder: boolean) => {
      const cleanPath = path.replace(/^\/+|\/+$/g, "")
      const slugSegment = cleanPath.split("/").filter(Boolean).at(-1) ?? ""
      return {
        slug: isFolder ? `${cleanPath}/index` : cleanPath,
        slugSegment,
        isFolder,
      }
    }

    assert.equal(sitePublicationExplorerFilter(node("beacon-and-bulletin", true)), true)
    assert.equal(sitePublicationExplorerFilter(node("beacon-and-bulletin/campaigns", true)), true)
    assert.equal(
      sitePublicationExplorerFilter(node("beacon-and-bulletin/campaigns/murder-in-metal-city", true)),
      true,
    )
    assert.equal(sitePublicationExplorerFilter(node("lantern-and-ledger", true)), false)
    assert.equal(sitePublicationExplorerFilter(node("tags", true)), false)

    currentPublication = "lantern-and-ledger"
    assert.equal(sitePublicationExplorerFilter(node("lantern-and-ledger", true)), true)
    assert.equal(sitePublicationExplorerFilter(node("lantern-and-ledger/campaigns", true)), true)
    assert.equal(sitePublicationExplorerFilter(node("lantern-and-ledger/campaigns/kingmaker", true)), true)
    assert.equal(sitePublicationExplorerFilter(node("beacon-and-bulletin", true)), false)

    currentPublication = "greene-gaming"
    assert.equal(sitePublicationExplorerFilter(node("lantern-and-ledger", true)), false)
    assert.equal(sitePublicationExplorerFilter(node("beacon-and-bulletin", true)), false)
  } finally {
    runtime.document = originalDocument
  }
})

test("Explorer filter fails open when publication context is unavailable", () => {
  const runtime = globalThis as unknown as { document?: unknown }
  const originalDocument = runtime.document
  runtime.document = {
    querySelector() {
      return null
    },
  }

  try {
    assert.equal(
      sitePublicationExplorerFilter({
        slug: "lantern-and-ledger/campaigns/index",
        slugSegment: "campaigns",
        isFolder: true,
      }),
      true,
    )
  } finally {
    runtime.document = originalDocument
  }
})

test("Explorer filter source has no nested function syntax that can gain bundler helpers", () => {
  const source = sitePublicationExplorerFilter.toString()
  assert.equal(source.includes("=>"), false)
  assert.equal(source.includes("__name("), false)
})
