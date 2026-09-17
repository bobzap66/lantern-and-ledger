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

test("folder wikilinks resolve directly to the folder's index note", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "vault-link-normalizer-"))

  try {
    const campaign = path.join(root, "Campaigns", "Test Campaign")
    const characters = path.join(campaign, "Characters")
    const vignettes = path.join(campaign, "Vignettes", "Hero")
    await mkdir(characters, { recursive: true })
    await mkdir(vignettes, { recursive: true })
    await writeFile(path.join(campaign, "index.md"), "# Test Campaign\n")
    await writeFile(path.join(characters, "index.md"), "# Characters\n")
    await writeFile(
      path.join(characters, "Hero.md"),
      'campaign: "[[Campaigns/Test Campaign|Test Campaign]]"\nparent: "[[Campaigns/Test Campaign/Characters|Characters]]"\n',
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
