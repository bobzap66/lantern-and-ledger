import assert from "node:assert/strict"
import { execFile } from "node:child_process"
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"
import test from "node:test"

const execFileAsync = promisify(execFile)
const normalizer = fileURLToPath(new URL("./normalize-vault-note-links.mjs", import.meta.url))
const checker = fileURLToPath(new URL("./check-link-conventions.mjs", import.meta.url))

test("folder wikilinks resolve directly to a publication campaign index", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "vault-link-normalizer-"))

  try {
    const campaign = path.join(root, "Lantern and Ledger", "Campaigns", "Test Campaign")
    const characters = path.join(campaign, "Characters")
    const vignettes = path.join(campaign, "Vignettes", "Hero")
    await mkdir(characters, { recursive: true })
    await mkdir(vignettes, { recursive: true })
    await writeFile(path.join(campaign, "index.md"), "# Test Campaign\n")
    await writeFile(path.join(characters, "index.md"), "# Characters\n")
    await writeFile(
      path.join(characters, "Hero.md"),
      'campaign: "[[Campaigns/Test Campaign|Test Campaign]]"\nparent: "[[Lantern and Ledger/Campaigns/Test Campaign/Characters|Characters]]"\n',
    )
    await writeFile(
      path.join(vignettes, "Memory.md"),
      'campaign: "[[Campaigns/Test Campaign|Test Campaign]]"\n',
    )

    await execFileAsync(process.execPath, [normalizer, root])

    const hero = await readFile(path.join(characters, "Hero.md"), "utf8")
    const memory = await readFile(path.join(vignettes, "Memory.md"), "utf8")
    assert.match(hero, /\[\[\.\.\/index\|Test Campaign\]\]/)
    assert.match(hero, /\[\[\.\/index\|Characters\]\]/)
    assert.match(memory, /\[\[\.\.\/\.\.\/index\|Test Campaign\]\]/)

    await execFileAsync(process.execPath, [checker, root])
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test("legacy Campaigns links resolve into Beacon & Bulletin when that target exists", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "vault-link-normalizer-beacon-"))

  try {
    const campaign = path.join(root, "Beacon and Bulletin", "Campaigns", "Murder in Metal City")
    const articleDir = path.join(root, "Beacon and Bulletin", "Articles")
    await mkdir(campaign, { recursive: true })
    await mkdir(articleDir, { recursive: true })
    await writeFile(path.join(campaign, "index.md"), "# Murder in Metal City\n")
    await writeFile(
      path.join(articleDir, "Example.md"),
      'campaign: "[[Campaigns/Murder in Metal City|Murder in Metal City]]"\n',
    )

    await execFileAsync(process.execPath, [normalizer, root])

    const article = await readFile(path.join(articleDir, "Example.md"), "utf8")
    assert.match(article, /\[\[\.\.\/Campaigns\/Murder in Metal City\/index\|Murder in Metal City\]\]/)

    await execFileAsync(process.execPath, [checker, root])
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
