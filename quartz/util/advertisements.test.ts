import assert from "node:assert/strict"
import test from "node:test"
import {
  AdvertisementRecord,
  eligibleAdvertisements,
  pageAdvertisementLocations,
  parseGolarionDate,
  selectAdvertisement,
  stableBucket,
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

test("filters advertisements by publication date while treating location as a preference", () => {
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
    ["Available", "Elsewhere", "Global"],
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

test("uses half the deterministic buckets for limited-run advertisements", () => {
  const limited = advertisement("Lecture", {
    limitedRun: true,
    runStartDate: "4721-Abadius-1",
    runEndDate: "4721-Gozran-1",
  })
  const ordinary = advertisement("Shop")
  const seeds = new Map<number, string>()
  for (let index = 0; seeds.size < 2 && index < 1000; index += 1) {
    const seed = `page-${index}`
    seeds.set(stableBucket(`${seed}|limited-run-bucket`, 2), seed)
  }

  assert.equal(seeds.size, 2)
  for (const [bucket, seed] of seeds) {
    const selected = selectAdvertisement([limited, ordinary], {
      pageDate: "4721-Calistril-1",
      pageLocations: ["Absalom"],
      seed,
    })
    assert.equal(selected?.limitedRun, bucket === 0)
  }
})

test("uses half the deterministic buckets for matching locations and half for all ads", () => {
  const local = advertisement("Local", { locations: ["Willowshore"] })
  const elsewhere = advertisement("Elsewhere", { locations: ["Kintargo"] })
  const seeds = new Map<number, string[]>()
  for (let index = 0; index < 1000; index += 1) {
    const seed = `location-page-${index}`
    const bucket = stableBucket(`${seed}|location-bucket`, 2)
    seeds.set(bucket, [...(seeds.get(bucket) ?? []), seed])
  }

  assert.equal(seeds.size, 2)
  for (const seed of seeds.get(0) ?? []) {
    const selected = selectAdvertisement([local, elsewhere], {
      pageDate: "4721-Abadius-2",
      pageLocations: ["Willowshore"],
      seed,
    })
    assert.equal(selected?.title, "Local")
  }

  const randomBucketTitles = new Set(
    (seeds.get(1) ?? []).map(
      (seed) =>
        selectAdvertisement([local, elsewhere], {
          pageDate: "4721-Abadius-2",
          pageLocations: ["Willowshore"],
          seed,
        })?.title,
    ),
  )
  assert.deepEqual(randomBucketTitles, new Set(["Local", "Elsewhere"]))
})

test("falls back to date-eligible advertisements when no location matches", () => {
  const records = [
    advertisement("Pathfinder Society", { locations: ["Absalom"] }),
    advertisement("Kintargo Opera House", { locations: ["Kintargo"] }),
  ]
  const selected = selectAdvertisement(records, {
    pageDate: "4723-Abadius-2",
    pageLocations: ["Willowshore"],
    seed: "season-of-ghosts-page",
  })
  assert.ok(selected)
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

test("uses datelines, bureaus, and campaign location suggestions", () => {
  assert.deepEqual(pageAdvertisementLocations({ dateline: "Vellumis" }), ["Vellumis"])
  assert.deepEqual(pageAdvertisementLocations({ bureau: "Absalom" }), ["Absalom", "Otari"])
  assert.deepEqual(pageAdvertisementLocations({ campaign: "[[Campaigns/Kingmaker|Kingmaker]]" }), [
    "Thumpington",
  ])
  assert.deepEqual(
    pageAdvertisementLocations({
      campaign: "[[Campaigns/Claws of the Tyrant|Claws of the Tyrant]]",
    }),
    ["Vellumis"],
  )
  assert.deepEqual(
    pageAdvertisementLocations({
      campaign: "[[Campaigns/Season of Ghosts|Season of Ghosts]]",
    }),
    ["Absalom"],
  )
})
