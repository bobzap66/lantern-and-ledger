import assert from "node:assert/strict"
import test from "node:test"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { ImageMetadataCarousel } from "./imageMetadataCarousel"
import { ImageMetadataGallery } from "./imageMetadataGallery"

for (const [language, factory] of [["image-carousel", ImageMetadataCarousel], ["image-gallery", ImageMetadataGallery]] as const) {
  test(`${language}: tag selection, all/any, deduplication and legacy filters`, () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "image-tags-"))
    try {
      fs.mkdirSync(path.join(root, "Image Metadata"))
      const records = [
        ["a.webp", ["subject/linzi", "location/thumpington", "advertisement"], "Kingmaker"],
        ["b.webp", ["subject/amiri"], "Kingmaker"],
        ["a.webp", ["subject/linzi"], "Kingmaker"],
        ["c.webp", ["subject/linzi"], "Other"],
      ]
      records.forEach(([asset, tags, campaign], index) => fs.writeFileSync(path.join(root, "Image Metadata", `${index}.md`),
        `---\ntype: image\nasset: assets/${asset}\ntags: ${JSON.stringify(tags)}\ncampaign: ${campaign}\nnpcs: [Linzi]\nalt: 'Linzi & an "open" journal'\n---\n`))
      const plugin = factory()
      const plugins = plugin.markdownPlugins!({ argv: { directory: root } } as any)
      const transform = (plugins[0] as any)()
      const render = (query: string) => {
        const tree = { children: [{ type: "code", lang: language, value: query }] }
        transform(tree, { path: path.join(root, "index.md") })
        return tree.children[0].value
      }
      const count = (html: string) => (html.match(/<figure/g) ?? []).length
      assert.equal(count(render("tags: [subject/linzi, subject/amiri]\nmatch: any")), 3)
      assert.equal(count(render("tags: [subject/linzi, location/thumpington]\nmatch: all")), 1)
      assert.equal(count(render("tags: [subject/linzi, subject/amiri]\nmatch: all")), 0)
      assert.equal(count(render("tag: '#SUBJECT/LINZI'\ncampaign: Kingmaker")), 1)
      assert.equal(count(render("npc: Linzi\ncampaign: Kingmaker")), 2)
      assert.equal(count(render("tags: [advertisement, subject/linzi]\nmatch: all")), 1)
      assert.match(render("tag: advertisement"), /alt="Linzi &amp; an &quot;open&quot; journal"/)
      assert.match(render("tags: [missing]"), /No matching images/)
      for (const invalid of ["tags: []", "tags: [42]", "tags: subject/linzi\nmatch: every", "[subject/linzi]", "tags: {"]) {
        assert.match(render(invalid), /Invalid image-/)
      }
    } finally { fs.rmSync(root, { recursive: true, force: true }) }
  })
}
