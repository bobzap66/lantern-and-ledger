import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import { ImageAltText, readImageAltText } from "./imageAltText"

test("reads accessible text from image metadata captions", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "image-alt-"))
  try {
    fs.mkdirSync(path.join(root, "Image Metadata"))
    fs.writeFileSync(
      path.join(root, "Image Metadata", "example.md"),
      `---\ntype: image\nasset: assets/images/example.webp\ncaption: A courier raises a signal lantern.\n---\n`,
    )
    assert.deepEqual(readImageAltText(root), [
      {
        asset: "assets/images/example.webp",
        alt: "A courier raises a signal lantern.",
      },
    ])
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test("fills missing image alt text without replacing authored text", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "image-alt-"))
  try {
    fs.mkdirSync(path.join(root, "Image Metadata"))
    fs.mkdirSync(path.join(root, "Campaigns"))
    fs.writeFileSync(
      path.join(root, "Image Metadata", "example.md"),
      `---\ntype: image\nasset: assets/images/example.webp\nalt: A deliberately written description.\ncaption: A shorter caption.\n---\n`,
    )

    const plugin = ImageAltText()
    const htmlPlugins = plugin.htmlPlugins!({ argv: { directory: root } } as never)
    const transform = (htmlPlugins[0] as () => (tree: unknown, file: unknown) => void)()
    const tree = {
      type: "root",
      children: [
        {
          type: "element",
          tagName: "img",
          properties: { src: "../assets/images/example.webp", alt: "" },
          children: [],
        },
        {
          type: "element",
          tagName: "img",
          properties: { src: "../assets/images/example.webp", alt: "Authored alt" },
          children: [],
        },
      ],
    }

    transform(tree, { path: path.join(root, "Campaigns", "article.md") })
    assert.equal(tree.children[0].properties.alt, "A deliberately written description.")
    assert.equal(tree.children[1].properties.alt, "Authored alt")
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})
