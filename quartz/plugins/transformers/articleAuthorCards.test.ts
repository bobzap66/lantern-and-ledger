import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import { ArticleAuthorCards } from "./articleAuthorCards"

function writeNote(root: string, relativePath: string, content: string) {
  const filePath = path.join(root, relativePath)
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, content)
  return filePath
}

test("adds author byline cards to article and vignette posts linked to a staff profile", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "author-cards-"))
  try {
    writeNote(
      root,
      "Beacon and Bulletin/Staff/The Unfinished Proof of Joy.md",
      `---
title: The Unfinished Proof of Joy
type: author
site_publication: "Beacon & Bulletin"
aliases:
  - Joy
role: Blogger
short_bio: A curious contemplative reporting across the Pact Worlds.
---
`,
    )

    const articlePath = writeNote(
      root,
      "Beacon and Bulletin/Articles/Blog.md",
      `---
title: A Blog Post
type: article
publication_date: 324-Sarenith-17
author: "[[../Staff/The Unfinished Proof of Joy|The Unfinished Proof of Joy]]"
---
`,
    )
    const vignettePath = writeNote(
      root,
      "Campaigns/Murder in Metal City/Vignettes/GM Vignettes/Lunch Review.md",
      `---
title: Lunch Review
publication_date: 325-Rova-14
type: vignette
publication: "Beacon & Bulletin"
author: "[[../../../../Beacon and Bulletin/Staff/The Unfinished Proof of Joy|Joy]]"
---
`,
    )

    const sessionReportPath = writeNote(
      root,
      "Beacon and Bulletin/Campaigns/Murder in Metal City/Sessions/Session 1.md",
      `---
title: Incredulous Static
publication_date: 325-Rova-15
type: session-report
publication: "Beacon & Bulletin"
site_publication: "Beacon & Bulletin"
author: "[[../../../Staff/The Unfinished Proof of Joy|Joy]]"
---
`,
    )

    const plugin = ArticleAuthorCards()
    const markdownPlugin = plugin.markdownPlugins!({
      argv: { directory: root },
    } as never)[0] as () => (tree: any, file: any) => void
    const transform = markdownPlugin()

    for (const [filePath, title] of [
      [articlePath, "A Blog Post"],
      [vignettePath, "Lunch Review"],
      [sessionReportPath, "Incredulous Static"],
    ]) {
      const tree: any = {
        type: "root",
        children: [
          { type: "heading", depth: 1, children: [{ type: "text", value: title }] },
          { type: "paragraph", children: [{ type: "text", value: "A short introduction." }] },
          {
            type: "paragraph",
            children: [
              { type: "emphasis", children: [{ type: "text", value: "By Joy, Blogger" }] },
            ],
          },
          { type: "paragraph", children: [{ type: "text", value: "The post begins here." }] },
        ],
      }

      transform(tree, { path: filePath })

      const cardIndex = tree.children.findIndex(
        (node: any) => node.type === "html" && node.value.includes('class="isr-author-card"'),
      )
      assert.notEqual(cardIndex, -1)
      assert.ok(cardIndex > 2)
      assert.equal(tree.children[cardIndex - 1].children[0].children[0].value, "By Joy, Blogger")
      assert.match(tree.children[cardIndex].value, /The Unfinished Proof of Joy/)
      assert.match(tree.children[cardIndex].value, /3 published posts in the archive/)
    }

    const joyProfilePath = path.join(
      root,
      "Beacon and Bulletin/Staff/The Unfinished Proof of Joy.md",
    )
    const joyProfileTree: any = {
      type: "root",
      children: [
        { type: "heading", depth: 1, children: [{ type: "text", value: "The Unfinished Proof of Joy" }] },
      ],
    }
    transform(joyProfileTree, { path: joyProfilePath })
    const joyWork = joyProfileTree.children.find(
      (node: any) => node.type === "html" && node.value.includes('class="isr-author-articles"'),
    )?.value ?? ""
    assert.match(joyWork, /Published Work by The Unfinished Proof of Joy/)
    assert.match(joyWork, /Incredulous Static/)
    assert.match(joyWork, /Lunch Review/)
    assert.match(joyWork, /A Blog Post/)
    assert.ok(joyWork.indexOf("Incredulous Static") < joyWork.indexOf("Lunch Review"))
    assert.ok(joyWork.indexOf("Lunch Review") < joyWork.indexOf("A Blog Post"))
    assert.equal((joyWork.match(/<li>/g) ?? []).length, 3)

    const campaignPath = writeNote(
      root,
      "Beacon and Bulletin/Campaigns/Murder in Metal City/index.md",
      `---
title: Murder in Metal City
type: campaign
editorial_author: "[[../../Staff/The Unfinished Proof of Joy|Joy]]"
---
`,
    )
    const campaignTree: any = {
      type: "root",
      children: [
        { type: "heading", depth: 1, children: [{ type: "text", value: "Murder in Metal City" }] },
        { type: "html", value: '<aside class="campaign-editorial-note">Joy writes here.</aside>' },
        { type: "html", value: "<!-- CAMPAIGN_EDITORIAL_AUTHOR_CARD -->" },
        { type: "html", value: "<!-- CAMPAIGN_RECENTS_START -->" },
      ],
    }
    transform(campaignTree, { path: campaignPath })
    assert.equal(campaignTree.children.length, 4)
    assert.match(campaignTree.children[2].value, /class="isr-author-card"/)
    assert.match(campaignTree.children[2].value, /The Unfinished Proof of Joy/)
    assert.match(campaignTree.children[2].value, /3 published posts in the archive/)
    assert.equal(campaignTree.children[3].value, "<!-- CAMPAIGN_RECENTS_START -->")

    const unrelatedReportPath = writeNote(
      root,
      "Other Campaign/Sessions/Unrelated.md",
      `---
title: Unrelated Report
type: session-report
publication: "The Lantern and Ledger"
author: Joy
---
`,
    )
    const unrelatedReportTree: any = {
      type: "root",
      children: [
        { type: "heading", depth: 1, children: [{ type: "text", value: "Unrelated Report" }] },
      ],
    }
    transform(unrelatedReportTree, { path: unrelatedReportPath })
    assert.equal(
      unrelatedReportTree.children.some(
        (node: any) => node.type === "html" && node.value.includes('class="isr-author-card"'),
      ),
      false,
    )

    const internalThoughtPath = writeNote(
      root,
      "Campaigns/Murder in Metal City/Vignettes/GM Vignettes/Private Thoughts.md",
      `---\ntitle: Private Thoughts\ntype: vignette\nauthor: "[[Beacon and Bulletin/Staff/The Unfinished Proof of Joy|Joy]]"\nsite_publication: "Beacon & Bulletin"\n---\n`,
    )
    const internalThoughtTree: any = {
      type: "root",
      children: [
        { type: "heading", depth: 1, children: [{ type: "text", value: "Private Thoughts" }] },
      ],
    }
    transform(internalThoughtTree, { path: internalThoughtPath })
    assert.equal(
      internalThoughtTree.children.some(
        (node: any) => node.type === "html" && node.value.includes('class="isr-author-card"'),
      ),
      false,
    )
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})
