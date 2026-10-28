import test from "node:test"
import assert from "node:assert/strict"
import { campaignFromSlug, shouldGateCampaignPage } from "./CampaignSpoilerGate"

test("publication campaign archive directories are not treated as campaigns", () => {
  assert.equal(campaignFromSlug("lantern-and-ledger/campaigns/archive"), null)
  assert.equal(campaignFromSlug("beacon-and-bulletin/campaigns/archive"), null)
})

test("Lantern campaign pages retain their spoiler-gate identity", () => {
  assert.deepEqual(
    campaignFromSlug("lantern-and-ledger/campaigns/crown-of-the-kobold-king/index"),
    {
      key: "crown-of-the-kobold-king",
      name: "Crown of the Kobold King",
    },
  )
})

test("Beacon campaign pages retain their spoiler-gate identity", () => {
  assert.deepEqual(
    campaignFromSlug("beacon-and-bulletin/campaigns/murder-in-metal-city/index"),
    {
      key: "murder-in-metal-city",
      name: "Murder in Metal City",
    },
  )
})

test("legacy campaign slugs remain recognized during migration", () => {
  assert.deepEqual(campaignFromSlug("campaigns/kingmaker/index"), {
    key: "kingmaker",
    name: "Kingmaker",
  })
})

test("campaign pages default to spoiler-gated when spoiler metadata is missing", () => {
  assert.equal(
    shouldGateCampaignPage(
      "lantern-and-ledger/campaigns/claws-of-the-tyrant/vignettes/example",
      undefined,
    ),
    true,
  )
})

test("spoiler false explicitly bypasses the campaign gate", () => {
  assert.equal(
    shouldGateCampaignPage(
      "beacon-and-bulletin/campaigns/murder-in-metal-city/vignettes/example",
      false,
    ),
    false,
  )
})

test("non-campaign pages are never campaign-gated", () => {
  assert.equal(shouldGateCampaignPage("articles", undefined), false)
})
