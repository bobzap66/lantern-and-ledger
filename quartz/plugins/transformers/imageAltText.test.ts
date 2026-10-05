import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import sharp from "sharp"
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

test("fills missing image alt text without replacing authored text", async () => {
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
    const transform = (htmlPlugins[0] as () => (tree: unknown, file: unknown) => Promise<void>)()
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

    await transform(tree, { path: path.join(root, "Campaigns", "article.md") })
    assert.equal(tree.children[0].properties.alt, "A deliberately written description.")
    assert.equal(tree.children[1].properties.alt, "Authored alt")
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test("adds intrinsic dimensions and defers non-leading content images", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "image-dimensions-"))
  try {
    fs.mkdirSync(path.join(root, "Campaigns"))
    fs.mkdirSync(path.join(root, "assets", "images"), { recursive: true })
    const asset = path.join(root, "assets", "images", "example.webp")
    await sharp({
      create: { width: 3, height: 2, channels: 3, background: "#c58b2b" },
    })
      .webp()
      .toFile(asset)

    const plugin = ImageAltText()
    const transform = (
      plugin.htmlPlugins!({ argv: { directory: root } } as never)[0] as () => (
        tree: unknown,
        file: unknown,
      ) => Promise<void>
    )()
    const image = (src: string) => ({
      type: "element",
      tagName: "img",
      properties: { src },
      children: [],
    })
    const tree = {
      type: "root",
      children: [image("../assets/images/example.webp"), image("../assets/images/example.webp")],
    }

    await transform(tree, { path: path.join(root, "Campaigns", "article.md") })

    assert.deepEqual(
      tree.children.map((node) => ({
        width: (node.properties as Record<string, unknown>).width,
        height: (node.properties as Record<string, unknown>).height,
        loading: (node.properties as Record<string, unknown>).loading,
        decoding: (node.properties as Record<string, unknown>).decoding,
      })),
      [
        { width: 3, height: 2, loading: "eager", decoding: "async" },
        { width: 3, height: 2, loading: "lazy", decoding: "async" },
      ],
    )
  } finally {
    sharp.cache(false)
    fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 })
  }
})
