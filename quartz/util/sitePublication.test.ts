import assert from "node:assert/strict"
import test from "node:test"
import { getSitePublication } from "./sitePublication"

test("defaults untagged pages to Lantern & Ledger", () => {
  const publication = getSitePublication(undefined)
  assert.equal(publication.key, "lantern-and-ledger")
  assert.equal(publication.title, "The Lantern and Ledger")
})

test("resolves Lantern & Ledger explicitly", () => {
  const publication = getSitePublication({ site_publication: "Lantern & Ledger" })
  assert.equal(publication.key, "lantern-and-ledger")
  assert.equal(publication.archiveLabel, "THE LANTERN AND LEDGER · ARCHIVES")
})

test("resolves Beacon & Bulletin case-insensitively", () => {
  const publication = getSitePublication({ site_publication: " beacon & bulletin " })
  assert.equal(publication.key, "beacon-and-bulletin")
  assert.equal(publication.title, "Beacon & Bulletin")
  assert.equal(publication.homeSlug, "beacon-and-bulletin")
  assert.equal(publication.archiveLabel, "BEACON & BULLETIN · ARCHIVES")
})

test("falls back safely for unknown publication values", () => {
  const publication = getSitePublication({ site_publication: "Unknown Gazette" })
  assert.equal(publication.key, "lantern-and-ledger")
})
