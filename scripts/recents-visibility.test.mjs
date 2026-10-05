import assert from "node:assert/strict"
import test from "node:test"
import { isVisibleInRecents } from "./recents-visibility.mjs"

test("unlisted easter eggs never appear in generated recents", () => {
  assert.equal(
    isVisibleInRecents({ title: "The Lantern King", unlisted: true, publish: true }),
    false,
  )
})

test("ordinary published notes remain eligible for generated recents", () => {
  assert.equal(isVisibleInRecents({ type: "session-note", publish: true }), true)
})
