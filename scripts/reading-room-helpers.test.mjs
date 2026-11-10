import test from "node:test"
import assert from "node:assert/strict"
import {
  isPublicEditorial,
  normalizeAuthor,
  authorKey,
  parseDisplayDate,
  dateParts,
  relativeStoryHref,
  storySlug,
  renderReadingRoom,
} from "./reading-room-helpers.mjs"

test("public editorial must explicitly opt out of spoilers", () => {
  assert.equal(isPublicEditorial({ type: "vignette", spoiler: false }, true), true)
  assert.equal(isPublicEditorial({ type: "session-report", spoiler: false }, true), true)
  for (const fm of [
    { type: "article", spoiler: true },
    { type: "article" },
    { type: "vignette", spoiler: false, draft: true },
    { type: "vignette", spoiler: false, publish: false },
    { type: "vignette", spoiler: false, unlisted: true },
    { type: "vignette", spoiler: false, hidden: true },
    { type: "vignette", spoiler: false, visibility: "hidden" },
    { type: "campaign", spoiler: false },
    { type: "index", spoiler: false },
  ]) {
    assert.equal(isPublicEditorial(fm, true), false, JSON.stringify(fm))
  }
  assert.equal(isPublicEditorial({ type: "article", spoiler: false }, false), false)
})

test("date-only values stay on their calendar day in the publication timezone", () => {
  assert.equal(dateParts(parseDisplayDate("2026-10-23")).label, "Oct 23, 2026")
  assert.equal(dateParts(parseDisplayDate("2026-11-06")).year, "2026")
  assert.equal(parseDisplayDate("325-Rova-14"), null)
})

test("byline aliases resolve to the same author identity", () => {
  assert.equal(normalizeAuthor("[[../../Staff/The Unfinished Proof of Joy|Joy]]"), "Joy")
  assert.equal(authorKey("[[../../Staff/The Unfinished Proof of Joy|Joy]]"), "joy")
})

test("reading room emits linked stories and resolved staff profile without unescaped HTML", () => {
  const entries = [{
    rel: "Beacon and Bulletin/Articles/Test Story.md",
    title: "<Spoiler> & Signal",
    description: "A public-facing report.",
    campaign: "Murder in Metal City",
    type: "Article",
    author: "Joy",
    authorProfileRel: "Beacon and Bulletin/Staff/The Unfinished Proof of Joy.md",
    date: parseDisplayDate("2026-11-06"),
  }]
  const index = "Beacon and Bulletin/Articles/index.md"
  const rendered = renderReadingRoom(entries, index, "Beacon & Bulletin")
  assert.match(rendered, /&lt;Spoiler&gt; &amp; Signal/)
  assert.doesNotMatch(rendered, /<Spoiler>/)
  assert.match(rendered, /data-campaign="Murder in Metal City"/)
  assert.match(rendered, /data-author="Joy"/)
  assert.match(rendered, /data-year="2026"/)
  assert.match(rendered, /By <a data-slug=/)
  assert.ok(rendered.includes(storySlug(entries[0].authorProfileRel)))
  assert.ok(rendered.includes(relativeStoryHref(entries[0].rel, index)))
  assert.match(rendered, /editorial-reading-room__query/)
  assert.match(rendered, /editorial-reading-room__reset/)
})
