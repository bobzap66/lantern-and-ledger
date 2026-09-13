import assert from "node:assert/strict"
import test from "node:test"
import { VignetteNote, archiveForCharacter, vignettesForArchive, vignetteDate } from "./vignettes"

function note(relativePath: string, frontmatter: Record<string, any>): VignetteNote {
  return { absolutePath: relativePath, relativePath, slug: relativePath, frontmatter }
}

test("matches flat and folder-based character pages to their archives", () => {
  const flatCharacter = note("Campaigns/Example/Characters/Ahri.md", { type: "person" })
  const flatArchive = note("Campaigns/Example/Vignettes/Ahri/index.md", {
    type: "index",
    character: "[[../../Characters/Ahri|Ahri]]",
  })
  const folderCharacter = note("Campaigns/Example/Characters/Velka/index.md", { type: "person" })
  const folderArchive = note("Campaigns/Example/Vignettes/Velka/index.md", {
    type: "index",
    character: "[[../../Characters/Velka/index|Velka]]",
  })
  const all = [flatCharacter, flatArchive, folderCharacter, folderArchive]

  assert.equal(archiveForCharacter(flatCharacter, all), flatArchive)
  assert.equal(archiveForCharacter(folderCharacter, all), folderArchive)
})

test("archive membership is directory-scoped even when character names collide", () => {
  const firstArchive = note("Campaigns/First/Vignettes/Comet/index.md", {
    type: "index",
    character: "[[../../Characters/Comet|Comet]]",
  })
  const firstVignette = note("Campaigns/First/Vignettes/Comet/First.md", {
    type: "vignette",
    character: "[[../../Characters/Comet|Comet]]",
  })
  const secondVignette = note("Campaigns/Second/Vignettes/Comet/Second.md", {
    type: "vignette",
    character: "[[../../Characters/Comet|Comet]]",
  })

  assert.deepEqual(
    vignettesForArchive(firstArchive, [firstArchive, firstVignette, secondVignette]),
    [firstVignette],
  )
})

test("publication date takes precedence over campaign date", () => {
  const date = vignetteDate({
    date: "2026-09-12",
    campaign_date_name: "17 Erastus 4722 AR",
  })

  assert.equal(date.kind, "publication")
  assert.equal(date.iso, "2026-09-12")
})
