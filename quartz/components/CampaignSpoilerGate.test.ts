import test from "node:test"
import assert from "node:assert/strict"
import { campaignFromSlug, shouldGateCampaignPage } from "./CampaignSpoilerGate"

test("the campaign archive directory is not treated as a campaign", () => {
  assert.equal(campaignFromSlug("campaigns/archive"), null)
})

test("individual campaign pages retain their spoiler-gate identity", () => {
  assert.deepEqual(campaignFromSlug("campaigns/crown-of-the-kobold-king/index"), {
    key: "crown-of-the-kobold-king",
    name: "Crown of the Kobold King",
  })
})

test("campaign pages default to spoiler-gated when spoiler metadata is missing", () => {
  assert.equal(shouldGateCampaignPage("campaigns/claws-of-the-tyrant/vignettes/example", undefined), true)
})

test("spoiler false explicitly bypasses the campaign gate", () => {
  assert.equal(shouldGateCampaignPage("campaigns/claws-of-the-tyrant/vignettes/example", false), false)
})

test("non-campaign pages are never campaign-gated", () => {
  assert.equal(shouldGateCampaignPage("articles", undefined), false)
})
