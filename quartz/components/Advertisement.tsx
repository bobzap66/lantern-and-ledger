import { Node } from "hast"
import {
  pageAdvertisementLocations,
  readAdvertisementCatalog,
  selectAdvertisement,
  semanticName,
} from "../util/advertisements"
import { FilePath, FullSlug, resolveRelative, simplifySlug, slugifyFilePath } from "../util/path"
import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"

function hasExistingAdvertisement(node: Node): boolean {
  const candidate = node as Node & {
    type?: string
    value?: string
    properties?: Record<string, unknown>
    children?: Node[]
  }
  if (candidate.type === "text" && /\bpaid advertisement\b/i.test(candidate.value ?? "")) {
    return true
  }
  if (
    candidate.properties?.["data-advertisement"] != null ||
    candidate.properties?.dataAdvertisement != null
  )
    return true
  return candidate.children?.some(hasExistingAdvertisement) ?? false
}

function wikilinkTarget(value: string | undefined) {
  if (!value) return undefined
  const match = /^\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]$/.exec(value.trim())
  return match?.[1]?.trim()
}

function copyParagraphs(copy: string, headline: string) {
  const paragraphs = copy
    .split(/\r?\n\s*\r?\n/)
    .map((paragraph) => paragraph.replace(/\s*\r?\n\s*/g, " ").trim())
    .filter(Boolean)
  if (/^paid advertisement\.?$/i.test(paragraphs[0] ?? "")) paragraphs.shift()
  if (semanticName(paragraphs[0] ?? "") === semanticName(headline)) paragraphs.shift()
  return paragraphs
}

export default (() => {
  const Advertisement: QuartzComponent = ({
    ctx,
    fileData,
    tree,
    displayClass,
  }: QuartzComponentProps) => {
    const fm = (fileData.frontmatter ?? {}) as Record<string, unknown>
    if (fm.advertisements === false || String(fm.advertisements).toLowerCase() === "false") {
      return null
    }
    if (!fileData.slug || hasExistingAdvertisement(tree)) return null

    const pageDate = String(fm.publication_date ?? fm.campaign_date ?? "").trim()
    if (!pageDate) return null

    const pageSlug = simplifySlug(fileData.slug)
    const pageLocations = pageAdvertisementLocations(fm, pageSlug)
    const advertisement = selectAdvertisement(readAdvertisementCatalog(ctx.argv.directory), {
      pageDate,
      pageLocations,
      seed: `${pageSlug}|${pageDate}|${String(fm.advertisement_seed ?? "")}`,
      pinned: typeof fm.advertisement === "string" ? fm.advertisement : undefined,
    })
    if (!advertisement) return null

    const imageSrc = resolveRelative(fileData.slug, advertisement.asset as FullSlug)
    const advertiserTarget = wikilinkTarget(advertisement.advertiserRecord)
    const advertiserHref = advertiserTarget
      ? resolveRelative(
          fileData.slug,
          simplifySlug(slugifyFilePath(`${advertiserTarget}.md` as FilePath)),
        )
      : undefined
    const paragraphs = copyParagraphs(advertisement.copy, advertisement.headline)

    return (
      <aside
        class={`random-advertisement ${displayClass ?? ""}`.trim()}
        aria-label={`Advertisement: ${advertisement.headline}`}
        data-advertisement={advertisement.title}
      >
        <div class="random-advertisement__label">Paid Advertisement</div>
        <div class="random-advertisement__layout">
          <figure class="random-advertisement__image">
            <img
              src={imageSrc}
              alt={advertisement.caption ?? `${advertisement.headline} advertisement`}
              loading="lazy"
              decoding="async"
            />
          </figure>
          <div class="random-advertisement__copy">
            <h2>
              {advertiserHref ? (
                <a class="internal" href={advertiserHref}>
                  {advertisement.headline}
                </a>
              ) : (
                advertisement.headline
              )}
            </h2>
            {paragraphs.map((paragraph) => (
              <p>{paragraph}</p>
            ))}
          </div>
        </div>
      </aside>
    )
  }

  Advertisement.css = `
.random-advertisement {
  --advertisement-ink: var(--dark);
  margin: 2.25rem 0 1.25rem;
  overflow: hidden;
  border: 1px solid var(--isr-rule, var(--lightgray));
  border-top: 4px double var(--advertisement-ink);
  border-bottom: 4px double var(--advertisement-ink);
  background: color-mix(in srgb, var(--light) 94%, var(--lightgray) 6%);
  box-shadow: 0 0.2rem 0.65rem color-mix(in srgb, var(--dark) 9%, transparent);
}

.random-advertisement__label {
  padding: 0.38rem 0.8rem 0.32rem;
  border-bottom: 1px solid var(--isr-rule, var(--lightgray));
  color: var(--gray);
  font-size: 0.63rem;
  font-weight: 700;
  letter-spacing: 0.16em;
  line-height: 1.2;
  text-align: center;
  text-transform: uppercase;
}

.random-advertisement__layout {
  display: grid;
  grid-template-columns: minmax(12rem, 38%) minmax(0, 1fr);
  align-items: stretch;
}

.random-advertisement__image {
  min-width: 0;
  margin: 0;
  border-right: 1px solid var(--isr-rule, var(--lightgray));
}

.random-advertisement__image img {
  display: block;
  width: 100%;
  height: 100%;
  min-height: 14rem;
  max-height: 24rem;
  margin: 0;
  border: 0;
  border-radius: 0;
  box-shadow: none;
  object-fit: cover;
}

.random-advertisement__copy {
  align-self: center;
  min-width: 0;
  padding: 1.1rem 1.2rem 1rem;
  text-align: center;
}

.random-advertisement__copy h2 {
  margin: 0 0 0.8rem;
  color: var(--advertisement-ink);
  font-family: var(--headerFont);
  font-size: clamp(1.15rem, 3vw, 1.65rem);
  letter-spacing: 0.035em;
  line-height: 1.2;
  text-transform: uppercase;
}

.random-advertisement__copy h2 a {
  color: inherit;
  text-decoration-thickness: 1px;
  text-underline-offset: 0.15em;
}

.random-advertisement__copy p {
  margin: 0.52rem 0 0;
  color: var(--darkgray);
  font-size: 0.9rem;
  line-height: 1.45;
}

.random-advertisement__copy p:first-of-type {
  color: var(--advertisement-ink);
  font-size: 1rem;
  font-weight: 650;
}

@media (max-width: 680px) {
  .random-advertisement__layout {
    grid-template-columns: minmax(0, 1fr);
  }

  .random-advertisement__image {
    max-height: 18rem;
    border-right: 0;
    border-bottom: 1px solid var(--isr-rule, var(--lightgray));
  }

  .random-advertisement__image img {
    min-height: 0;
    max-height: 18rem;
    object-position: center;
  }

  .random-advertisement__copy {
    padding: 0.95rem 1rem 1rem;
  }
}
`

  return Advertisement
}) satisfies QuartzComponentConstructor
