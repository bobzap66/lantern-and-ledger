import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import { CharacterCards } from "./characterCards"

function writeNote(root: string, relativePath: string, content: string) {
  const filePath = path.join(root, relativePath)
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, content)
  return filePath
}

function characterNote(title: string, portrait?: string) {
  return `---
title: ${title}
type: person
role: player-character
status: active
${portrait ? `portrait: "${portrait}"\n` : ""}---
`
}

function renderCards(root: string, filePath: string, query: string) {
  const plugin = CharacterCards()
  const markdownPlugin = plugin.markdownPlugins!({
    argv: { directory: root },
  } as never)[0] as () => (tree: any, file: any) => void
  const transform = markdownPlugin()
  const tree: any = {
    type: "root",
    children: [{ type: "code", lang: "character-cards", value: query }],
  }
  transform(tree, { path: filePath })
  return tree.children[0].value as string
}

test("renders six explicitly selected characters from different campaign directories", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "character-cards-"))
  try {
    const returning = [
      "August Shepard",
      "Comet",
      "Kiri Steelpaws",
      "Talia Nightclaw",
      "Theron",
    ]
    for (const name of returning) {
      writeNote(
        root,
        `Lantern and Ledger/Campaigns/Abomination Vaults/Characters/${name}.md`,
        characterNote(name, `assets/images/${name.toLowerCase().replaceAll(" ", "-")}.webp`),
      )
    }
    writeNote(
      root,
      "Lantern and Ledger/Campaigns/Curtain Call/Characters/Sylas Starling.md",
      characterNote("Sylas Starling"),
    )
    writeNote(
      root,
      "Lantern and Ledger/Campaigns/Elsewhere/Characters/Other Hero.md",
      characterNote("Other Hero"),
    )

    const index = writeNote(
      root,
      "Lantern and Ledger/Campaigns/Curtain Call/Characters/index.md",
      "# Curtain Call Characters",
    )
    const roster = returning.map((name) =>
      `  - "[[../../Abomination Vaults/Characters/${name}]]"`
    )
    const query = [
      "include:",
      ...roster,
      '  - "[[./Sylas Starling]]"',
      '  - "[[./Sylas Starling]]"', // Duplicates never produce duplicate cards.
    ].join("\n")
    const html = renderCards(root, index, query)

    assert.equal((html.match(/class="isr-character-card"/g) ?? []).length, 6)
    let lastPosition = -1
    for (const name of [...returning, "Sylas Starling"]) {
      const position = html.indexOf(`isr-character-card-name">${name}`)
      assert.ok(position > lastPosition, `${name} should be included in roster order`)
      lastPosition = position
    }
    assert.ok(html.includes('href="./../../Abomination%20Vaults/Characters/August%20Shepard"'))
    assert.match(html, /No portrait available for Sylas Starling/)
    assert.doesNotMatch(html, /Other Hero/)
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test("without an explicit roster, only local character records are shown", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "character-cards-local-"))
  try {
    writeNote(
      root,
      "Campaigns/Local/Characters/Local Hero.md",
      characterNote("Local Hero"),
    )
    writeNote(
      root,
      "Campaigns/Other/Characters/Other Hero.md",
      characterNote("Other Hero"),
    )
    const index = writeNote(root, "Campaigns/Local/Characters/index.md", "# Characters")
    const html = renderCards(root, index, "")

    assert.match(html, /Local Hero/)
    assert.doesNotMatch(html, /Other Hero/)
    assert.equal((html.match(/class="isr-character-card"/g) ?? []).length, 1)
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})
