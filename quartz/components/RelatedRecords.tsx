import { EditorialCard, editorialCardCss } from "./EditorialCard"
import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { FullSlug, resolveRelative, simplifySlug } from "../util/path"

type RecordFile = QuartzComponentProps["allFiles"][number]

type RelatedRecordSpec = {
  target: string
  title?: string
  eyebrow?: string
  description?: string
  meta?: string
  cta?: string
}

const MAX_RELATED_RECORDS = 3

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function normalized(value: unknown) {
  return text(value).toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim()
}

function campaignRoot(slug: string | undefined) {
  if (!slug) return undefined
  const simplified = simplifySlug(slug as FullSlug)
  return /^(campaigns\/(?:archived\/[^/]+|[^/]+))(?:\/|$)/i.exec(simplified)?.[1]
}

function titleFor(file: RecordFile) {
  return text(file.frontmatter?.title) || simplifySlug(file.slug!).split("/").at(-1) || "Archive record"
}

function wikilinkParts(value: string) {
  const trimmed = value.trim()
  const match = /^\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|([^\]]+))?\]\]$/.exec(trimmed)
  if (!match) return { target: trimmed, label: "" }
  return { target: match[1].trim(), label: (match[2] ?? "").trim() }
}

function decodeSegment(segment: string) {
  try {
    return decodeURIComponent(segment)
  } catch {
    return segment
  }
}

function slugSegment(segment: string) {
  return decodeSegment(segment)
    .trim()
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
}

function collapsePath(parts: string[]) {
  const result: string[] = []
  for (const rawPart of parts) {
    const part = rawPart.trim()
    if (!part || part === ".") continue
    if (part === "..") {
      result.pop()
      continue
    }
    result.push(slugSegment(part.replace(/\.md$/i, "")))
  }
  if (result.at(-1) === "index") result.pop()
  return result.filter(Boolean).join("/")
}

function targetCandidates(currentSlug: string, target: string) {
  const cleanTarget = target.split("#", 1)[0].replaceAll("\\", "/").replace(/^\/+/, "")
  if (!cleanTarget) return []

  const current = simplifySlug(currentSlug as FullSlug)
  const currentDirectory = current.split("/").slice(0, -1)
  const direct = collapsePath(cleanTarget.split("/"))
  const relative = collapsePath([...currentDirectory, ...cleanTarget.split("/")])

  return Array.from(new Set([direct, relative].filter(Boolean)))
}

function inferredTitleFromTarget(target: string) {
  const last = target
    .replaceAll("\\", "/")
    .replace(/\.md$/i, "")
    .split("/")
    .filter((part) => part && part !== "." && part !== "..")
    .at(-1)
  return last ? decodeSegment(last).replaceAll("-", " ").trim() : ""
}

function preferSameCampaign(files: RecordFile[], currentSlug: string) {
  const root = campaignRoot(currentSlug)
  if (!root) return files[0]
  return files.find((file) => campaignRoot(file.slug) === root) ?? files[0]
}

function findRecord(value: string, fileData: QuartzComponentProps["fileData"], allFiles: RecordFile[]) {
  if (!fileData.slug) return undefined
  const { target, label } = wikilinkParts(value)
  const current = simplifySlug(fileData.slug)
  const candidates = new Set(targetCandidates(fileData.slug, target))

  const exact = allFiles.filter((file) => file.slug && candidates.has(simplifySlug(file.slug)))
  const exactMatch = preferSameCampaign(exact, current)
  if (exactMatch) return exactMatch

  const possibleTitles = [label, inferredTitleFromTarget(target), target]
    .map((candidate) => candidate.trim().toLowerCase())
    .filter(Boolean)
  if (possibleTitles.length === 0) return undefined

  const titleMatches = allFiles.filter((file) => {
    const title = titleFor(file).trim().toLowerCase()
    return possibleTitles.includes(title)
  })
  return preferSameCampaign(titleMatches, current)
}

function recordKind(file: RecordFile) {
  const slug = simplifySlug(file.slug!)
  const type = normalized(file.frontmatter?.type)
  const role = normalized(file.frontmatter?.role)
  const root = campaignRoot(file.slug)

  if (root && slug === root) return "Campaign"
  if (/\/session-notes$/i.test(slug)) return "Session archive"
  if (type === "contributor" || type === "author") return "Contributor"
  if (type === "location" || slug.includes("/locations/")) return "Location"
  if (type === "vignette") return "Vignette"
  if (type === "report" || type === "session" || type === "session note") return "Session"
  if (type === "article") return "Article"
  if (type === "person") {
    if (role === "player character") return "Character"
    if (role === "non player character" || slug.includes("/npcs/")) return "NPC"
    return "Person"
  }

  return "Archive record"
}

function recordDescription(file: RecordFile, kind: string) {
  const fm = file.frontmatter ?? {}
  const descriptionFields = [
    fm.card_description,
    fm.description,
    fm.short_bio,
    fm.card_summary,
    fm.summary,
  ]
  for (const value of descriptionFields) {
    const description = text(value)
    if (description) return description
  }

  const role = text(fm.role)
  if (role && !["player-character", "non-player-character"].includes(role.toLowerCase())) return role

  const fallbacks: Record<string, string> = {
    Campaign: "Open the campaign archive.",
    "Session archive": "Browse the collected session record.",
    Character: "Open this character's archive record.",
    NPC: "Open this person's archive record.",
    Person: "Open this person's archive record.",
    Contributor: "Open this contributor's archive record.",
    Location: "Open this location's archive record.",
    Vignette: "Open this vignette in the archive.",
    Session: "Open this session record.",
    Article: "Open this article in the archive.",
  }
  return fallbacks[kind] ?? "Open this related archive record."
}

function parseCuratedSpec(value: unknown): RelatedRecordSpec | undefined {
  if (typeof value === "string") {
    const target = value.trim()
    return target ? { target } : undefined
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined

  const record = value as Record<string, unknown>
  const target =
    text(record.target) || text(record.link) || text(record.record) || text(record.path)
  if (!target) return undefined

  return {
    target,
    title: text(record.title) || undefined,
    eyebrow:
      text(record.eyebrow) || text(record.kind) || text(record.record_type) || text(record.type) || undefined,
    description: text(record.description) || undefined,
    meta: text(record.meta) || undefined,
    cta: text(record.cta) || undefined,
  }
}

function curatedSpecs(frontmatter: Record<string, unknown>) {
  const raw = frontmatter.related_records
  const values = Array.isArray(raw) ? raw : raw === undefined ? [] : [raw]
  return values.map(parseCuratedSpec).filter((spec): spec is RelatedRecordSpec => Boolean(spec))
}

function automaticSpecs(
  fileData: QuartzComponentProps["fileData"],
  allFiles: RecordFile[],
): RelatedRecordSpec[] {
  if (!fileData.slug) return []
  const fm = (fileData.frontmatter ?? {}) as Record<string, unknown>
  const type = normalized(fm.type)
  const format = normalized(fm.format)
  const slug = simplifySlug(fileData.slug)
  const root = campaignRoot(fileData.slug)

  const eligibleTypes = new Set([
    "article",
    "report",
    "session",
    "session note",
    "vignette",
    "intelligence report",
    "intelligence dossier",
    "scholarly journal",
    "journal article",
    "academic paper",
    "scholarly article",
  ])
  const eligibleFormats = new Set(["oral history", "player fiction", "gm fiction"])
  if (!eligibleTypes.has(type) && !eligibleFormats.has(format)) return []

  const specs: RelatedRecordSpec[] = []
  const add = (target: unknown) => {
    const value = text(target)
    if (value) specs.push({ target: value })
  }

  if (type === "vignette") {
    add(fm.character)
  } else {
    add(fm.narrator)
    if (!fm.narrator) add(fm.character)

    if (slug.includes("/session-notes/")) {
      const parent = slug.split("/").slice(0, -1).join("/")
      if (parent) specs.push({ target: parent, eyebrow: "Session archive" })
    }
  }

  if (root) specs.push({ target: root, eyebrow: "Campaign" })

  // Only keep targets that resolve. This also prevents an inferred relationship from
  // occupying a slot when older campaign metadata points at a record that no longer exists.
  return specs.filter((spec) => findRecord(spec.target, fileData, allFiles)).slice(0, MAX_RELATED_RECORDS)
}

export default (() => {
  const RelatedRecords: QuartzComponent = ({
    fileData,
    allFiles,
    displayClass,
  }: QuartzComponentProps) => {
    if (!fileData.slug) return null
    const fm = (fileData.frontmatter ?? {}) as Record<string, unknown>
    const curated = Object.prototype.hasOwnProperty.call(fm, "related_records")
    const specs = curated ? curatedSpecs(fm) : automaticSpecs(fileData, allFiles)
    if (specs.length === 0) return null

    const currentSlug = simplifySlug(fileData.slug)
    const seen = new Set<string>()
    const cards = specs
      .map((spec) => {
        const file = findRecord(spec.target, fileData, allFiles)
        if (!file?.slug) return undefined
        const targetSlug = simplifySlug(file.slug)
        if (targetSlug === currentSlug || seen.has(targetSlug)) return undefined
        seen.add(targetSlug)

        const kind = recordKind(file)
        return {
          href: resolveRelative(fileData.slug!, targetSlug as FullSlug),
          title: spec.title || titleFor(file),
          eyebrow: spec.eyebrow || kind,
          description: spec.description || recordDescription(file, kind),
          meta: spec.meta,
          cta: spec.cta || "View record",
        }
      })
      .filter((card): card is NonNullable<typeof card> => Boolean(card))
      .slice(0, MAX_RELATED_RECORDS)

    if (cards.length === 0) return null

    return (
      <section
        class={`related-records ${displayClass ?? ""}`.trim()}
        aria-labelledby="related-records-heading"
      >
        <div class="related-records__header">
          <h2 id="related-records-heading">Related Records</h2>
          <p>Further entries from the archive</p>
        </div>
        <div class="related-records__grid">
          {cards.map((card) => (
            <EditorialCard
              href={card.href}
              title={card.title}
              eyebrow={card.eyebrow}
              description={card.description}
              meta={card.meta}
              cta={card.cta}
              className="related-records__card"
            />
          ))}
        </div>
      </section>
    )
  }

  RelatedRecords.css = `
${editorialCardCss}

.related-records {
  margin: 2.8rem 0 0.75rem;
  padding-top: 1.25rem;
  border-top: 1px solid var(--campaign-page-rule, var(--isr-rule, var(--lightgray)));
}

.related-records__header h2 {
  margin: 0;
  color: var(--campaign-page-accent, var(--tertiary));
  font-family: var(--bodyFont);
  font-size: 0.74rem;
  font-weight: 700;
  letter-spacing: 0.13em;
  line-height: 1.3;
  text-transform: uppercase;
}

.related-records__header p {
  margin: 0.18rem 0 0;
  color: var(--gray);
  font-size: 0.82rem;
  font-style: italic;
  line-height: 1.4;
}

.related-records__grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.75rem;
  margin-top: 0.85rem;
}

.related-records__card {
  height: 100%;
  box-sizing: border-box;
}

.related-records__card .editorial-card__copy {
  padding: 0.72rem 0.78rem 0.68rem;
}

.related-records__card .editorial-card__eyebrow {
  font-size: 0.6rem;
}

.related-records__card .editorial-card__title {
  font-size: 0.96rem;
}

.related-records__card .editorial-card__description {
  display: -webkit-box;
  overflow: hidden;
  margin-top: 0.28rem;
  font-size: 0.8rem;
  line-height: 1.38;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.related-records__card .editorial-card__footer {
  margin-top: auto;
  padding-top: 0.42rem;
}

.related-records__card .editorial-card__meta,
.related-records__card .editorial-card__cta {
  font-size: 0.72rem;
}

@media (max-width: 700px) {
  .related-records {
    margin-top: 2.35rem;
  }

  .related-records__grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
`

  return RelatedRecords
}) satisfies QuartzComponentConstructor
