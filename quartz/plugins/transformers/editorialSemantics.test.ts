import assert from "node:assert/strict"
import test from "node:test"
import { EditorialSemantics, descriptionFromMarkdown } from "./editorialSemantics"

test("builds a social description from the first substantial prose paragraph", () => {
  const source = `---\ntitle: Session 64: No More Curves\n---\n\n# Session 64: No More Curves\n\n> [!side]\n> ![Illustration](image.webp)\n\nThis account has been prepared from interviews with the returned expedition and records of the resurrection performed at the temple.`
  assert.equal(
    descriptionFromMarkdown(source),
    "This account has been prepared from interviews with the returned expedition and records of the resurrection performed at the temple.",
  )
})

test("skips newspaper datelines when choosing a social description", () => {
  const source = `---\ntitle: Session 64: No More Curves\n---\n\n**Gozran 24, 4716 AR** · Published in Thumpington · Linzi, Editor · Mara Venn, Managing Editor · Price 1 cp\n\n*This account has been prepared from interviews with the returned expedition, records of the resurrection, and reports submitted during the subsequent survey into Numeria.*`
  assert.equal(
    descriptionFromMarkdown(source),
    "This account has been prepared from interviews with the returned expedition, records of the resurrection, and reports submitted during the subsequent survey into Numeria.",
  )
})

test("removes a duplicated editorial h1 and preserves section headings", () => {
  const plugin = EditorialSemantics()
  const transform = plugin.htmlPlugins!({} as never)[0] as () => (
    tree: unknown,
    file: unknown,
  ) => void
  const tree = {
    type: "root",
    children: [
      {
        type: "element",
        tagName: "h1",
        properties: {},
        children: [{ type: "text", value: "Session 64: No More Curves" }],
      },
      {
        type: "element",
        tagName: "h2",
        properties: {},
        children: [{ type: "text", value: "Everyone Came Home" }],
      },
    ],
  }
  const frontmatter = { title: "Session 64: No More Curves", type: "session-note" }

  transform()(tree, {
    data: { slug: "campaigns/kingmaker/session-notes/session-64", frontmatter },
    value: "",
  })

  assert.deepEqual(
    tree.children.map((node) => node.tagName),
    ["h2"],
  )
})
