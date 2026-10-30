import assert from "node:assert/strict"
import test from "node:test"
import { getExplorerCampaigns } from "../util/explorerCampaigns"

test("builds publication-scoped Explorer campaign groups from campaign metadata", () => {
  const campaigns = getExplorerCampaigns([
    {
      slug: "lantern-and-ledger/campaigns/kingmaker/index",
      frontmatter: {
        type: "campaign",
        status: "active",
        site_publication: "Lantern & Ledger",
      },
    },
    {
      slug: "beacon-and-bulletin/campaigns/murder-in-metal-city/index",
      frontmatter: {
        type: "campaign",
        status: "upcoming",
        site_publication: "Beacon & Bulletin",
      },
    },
    {
      slug: "campaigns/rusthenge/index",
      frontmatter: {
        type: "campaign",
        status: "archived",
        site_publication: "Lantern & Ledger",
      },
    },
    {
      slug: "campaigns/kingmaker/characters/index",
      frontmatter: { type: "directory", status: "active" },
    },
  ])

  assert.deepEqual(campaigns, [
    {
      path: "beacon-and-bulletin/campaigns/murder-in-metal-city",
      publication: "beacon-and-bulletin",
      status: "upcoming",
    },
    {
      path: "campaigns/rusthenge",
      publication: "lantern-and-ledger",
      status: "archived",
    },
    {
      path: "lantern-and-ledger/campaigns/kingmaker",
      publication: "lantern-and-ledger",
      status: "active",
    },
  ])
})
