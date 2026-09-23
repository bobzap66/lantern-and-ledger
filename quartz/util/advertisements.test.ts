import assert from "node:assert/strict"
import test from "node:test"
import {
  AdvertisementRecord,
  eligibleAdvertisements,
  pageAdvertisementLocations,
  parseGolarionDate,
  selectAdvertisement,
  stableHash,
} from "./advertisements"

function advertisement(
  title: string,
  overrides: Partial<AdvertisementRecord> = {},
): AdvertisementRecord {
  return {
    sourcePath: `${title}.md`,
    title,
    asset: `assets/images/${title}.webp`,
    headline: title,
    copy: `${title} copy`,
    locations: ["Absalom"],
    publicationDate: "4721-Abadius-1",
    limitedRun: false,
    ...overrides,
  }
}

test("parses named and numeric Golarion dates on the same calendar", () => {
  assert.equal(parseGolarionDate("4721-Abadius-15"), parseGolarionDate("4721-01-15"))
  assert.equal(parseGolarionDate("4721-Calistril"), parseGolarionDate("4721-02-01"))
  assert.equal(parseGolarionDate("not-a-date"), undefined)
})

test("filters advertisements by publication date and location", () => {
  const records = [
    advertisement("Available"),
    advertisement("Future", { publicationDate: "4721-Calistril-1" }),
    advertisement("Elsewhere", { locations: ["Vellumis"] }),
    advertisement("Global", { locations: [] }),
  ]

  assert.deepEqual(
    eligibleAdvertisements(records, "4721-Abadius-15", ["[[Places/Absalom|Absalom]]"]).map(
      (record) => record.title,
    ),
    ["Available", "Global"],
  )
})

test("limits time-bound advertisements to their run window", () => {
  const limited = advertisement("Lecture", {
    limitedRun: true,
    runStartDate: "4721-Abadius-10",
    runEndDate: "4721-Gozran-10",
  })

  assert.equal(eligibleAdvertisements([limited], "4721-Abadius-9", ["Absalom"]).length, 0)
  assert.equal(eligibleAdvertisements([limited], "4721-Abadius-10", ["Absalom"]).length, 1)
  assert.equal(eligibleAdvertisements([limited], "4721-Gozran-10", ["Absalom"]).length, 1)
  assert.equal(eligibleAdvertisements([limited], "4721-Gozran-11", ["Absalom"]).length, 0)
})

test("uses three of four deterministic buckets for limited-run advertisements", () => {
  const limited = advertisement("Lecture", {
    limitedRun: true,
    runStartDate: "4721-Abadius-1",
    runEndDate: "4721-Gozran-1",
  })
  const ordinary = advertisement("Shop")
  const seeds = new Map<number, string>()
  for (let index = 0; seeds.size < 4 && index < 1000; index += 1) {
    const seed = `page-${index}`
    seeds.set(stableHash(`${seed}|limited-run-bucket`) % 4, seed)
  }

  assert.equal(seeds.size, 4)
  for (const [bucket, seed] of seeds) {
    const selected = selectAdvertisement([limited, ordinary], {
      pageDate: "4721-Calistril-1",
      pageLocations: ["Absalom"],
      seed,
    })
    assert.equal(selected?.limitedRun, bucket < 3)
  }
})

test("honors an eligible pinned advertisement", () => {
  const records = [advertisement("First"), advertisement("Chosen Ad")]
  const selected = selectAdvertisement(records, {
    pageDate: "4721-Abadius-2",
    pageLocations: ["Absalom"],
    seed: "stable-page",
    pinned: "Chosen Ad",
  })
  assert.equal(selected?.title, "Chosen Ad")
})

test("uses datelines and bureaus, with a Thumpington fallback for Kingmaker", () => {
  assert.deepEqual(pageAdvertisementLocations({ dateline: "Vellumis" }), ["Vellumis"])
  assert.deepEqual(pageAdvertisementLocations({ bureau: "Absalom" }), ["Absalom"])
  assert.deepEqual(pageAdvertisementLocations({ campaign: "[[Campaigns/Kingmaker|Kingmaker]]" }), [
    "Thumpington",
  ])
})
