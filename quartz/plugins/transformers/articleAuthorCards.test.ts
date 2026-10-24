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
author: "[[../Staff/The Unfinished Proof of Joy|The Unfinished Proof of Joy]]"
---
`,
    )
    const vignettePath = writeNote(
      root,
      "Campaigns/Murder in Metal City/Vignettes/GM Vignettes/Lunch Review.md",
      `---
title: Lunch Review
type: vignette
publication: "Beacon & Bulletin"
author: "[[../../../../Beacon and Bulletin/Staff/The Unfinished Proof of Joy|Joy]]"
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
      assert.match(tree.children[cardIndex].value, /2 published posts in the archive/)
    }

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
