import test from "node:test"
import assert from "node:assert/strict"
import { campaignFromSlug } from "./CampaignSpoilerGate"

test("the campaign archive directory is not treated as a campaign", () => {
  assert.equal(campaignFromSlug("campaigns/archive"), null)
})

test("individual campaign pages retain their spoiler-gate identity", () => {
  assert.deepEqual(campaignFromSlug("campaigns/crown-of-the-kobold-king/index"), {
    key: "crown-of-the-kobold-king",
    name: "Crown of the Kobold King",
  })
})
