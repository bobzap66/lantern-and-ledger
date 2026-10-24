import { Node } from "hast"
import path from "node:path"
import {
  pageAdvertisementLocations,
  readAdvertisementCatalog,
  selectAdvertisement,
  semanticName,
} from "../util/advertisements"
import { FilePath, FullSlug, resolveRelative, simplifySlug, slugifyFilePath } from "../util/path"
import { readImageDimensions } from "../plugins/transformers/imageAltText"
import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"

type AdvertisementPlacement = "sidebar" | "strip"
type AdvertisementOptions = { placement?: AdvertisementPlacement }

function hasExistingAdvertisement(node: Node): boolean {
  const candidate = node as Node & {
    properties?: Record<string, unknown>
    children?: Node[]
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

function videoMimeType(asset: string) {
  const extension = path.extname(asset).toLowerCase()
  if (extension === ".mp4" || extension === ".m4v") return "video/mp4"
  if (extension === ".webm") return "video/webm"
  if (extension === ".ogv" || extension === ".ogg") return "video/ogg"
  return undefined
}

export default (({ placement = "sidebar" }: AdvertisementOptions = {}) => {
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
      pagePublication: String(fm.site_publication ?? "Lantern & Ledger"),
      placement,
      seed: `${pageSlug}|${pageDate}|${placement}|${String(fm.advertisement_seed ?? "")}`,
      pinned: typeof fm.advertisement === "string" ? fm.advertisement : undefined,
    })
    if (!advertisement) return null

    const imageSrc = resolveRelative(fileData.slug, advertisement.asset as FullSlug)
    const imageDimensions = readImageDimensions(
      path.resolve(ctx.argv.directory, advertisement.asset),
    )
    const videoSrc = advertisement.videoAsset
      ? resolveRelative(fileData.slug, advertisement.videoAsset as FullSlug)
      : undefined
    const captionsSrc = advertisement.videoCaptionsAsset
      ? resolveRelative(fileData.slug, advertisement.videoCaptionsAsset as FullSlug)
      : undefined
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
        class={`random-advertisement random-advertisement--${placement} ${displayClass ?? ""}`.trim()}
        aria-label={`Advertisement: ${advertisement.headline}`}
        data-advertisement={advertisement.title}
        data-advertisement-placement={placement}
      >
        <div class="random-advertisement__label">Paid Advertisement</div>
        <div class="random-advertisement__layout">
          <figure class="random-advertisement__image world-anvil-side-content">
            {videoSrc ? (
              <video
                aria-label={advertisement.caption ?? `${advertisement.headline} advertisement`}
                controls
                loop={advertisement.autoplay}
                muted={advertisement.autoplay}
                playsInline
                poster={imageSrc}
                preload="none"
                data-advertisement-autoplay={advertisement.autoplay ? "true" : undefined}
              >
                {captionsSrc && (
                  <track kind="captions" src={captionsSrc} srcLang="en" label="English" default />
                )}
                <source src={videoSrc} type={videoMimeType(advertisement.videoAsset!)} />
                Your browser does not support embedded video.
              </video>
            ) : (
              <img
                src={imageSrc}
                alt={advertisement.caption ?? `${advertisement.headline} advertisement`}
                width={imageDimensions?.width}
                height={imageDimensions?.height}
                loading="lazy"
                decoding="async"
              />
            )}
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
  margin: 1rem 0;
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
  grid-template-columns: minmax(0, 1fr);
  align-items: stretch;
}

.random-advertisement__image {
  display: grid;
  place-items: center;
  min-width: 0;
  margin: 0;
  border-bottom: 1px solid var(--isr-rule, var(--lightgray));
}

.random-advertisement__image img {
  display: block;
  width: 100%;
  height: auto;
  max-height: none;
  margin: 0;
  border: 0;
  border-radius: 0;
  box-shadow: none;
  object-fit: contain;
}

.random-advertisement__image video {
  display: block;
  width: 100%;
  height: auto;
  aspect-ratio: 16 / 9;
  background: var(--dark);
  object-fit: contain;
}

.random-advertisement--strip .random-advertisement__layout {
  grid-template-columns: minmax(0, 1.4fr) minmax(13rem, 0.8fr);
}

.random-advertisement--strip .random-advertisement__image {
  border-right: 1px solid var(--isr-rule, var(--lightgray));
  border-bottom: 0;
}

@media (max-width: 700px) {
  .random-advertisement--strip .random-advertisement__layout {
    grid-template-columns: minmax(0, 1fr);
  }

  .random-advertisement--strip .random-advertisement__image {
    border-right: 0;
    border-bottom: 1px solid var(--isr-rule, var(--lightgray));
  }
}

.random-advertisement__copy {
  align-self: center;
  min-width: 0;
  padding: 0.85rem 0.9rem 0.9rem;
  text-align: center;
}

.random-advertisement__copy h2 {
  margin: 0 0 0.8rem;
  color: var(--advertisement-ink);
  font-family: var(--headerFont);
  font-size: 1.1rem;
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
  font-size: 0.82rem;
  line-height: 1.45;
}

.random-advertisement__copy p:first-of-type {
  color: var(--advertisement-ink);
  font-size: 0.9rem;
  font-weight: 650;
}
`

  Advertisement.afterDOMLoaded = `
(() => {
  const videos = [...document.querySelectorAll("video[data-advertisement-autoplay='true']")]
  if (videos.length === 0 || !("IntersectionObserver" in window)) return

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)")
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const video = entry.target
      if (reducedMotion.matches || !entry.isIntersecting) {
        video.dataset.visibilityPaused = "true"
        video.pause()
      } else if (video.dataset.userPaused !== "true") {
        delete video.dataset.visibilityPaused
        video.play().catch(() => {})
      }
    }
  }, { threshold: 0.4 })

  for (const video of videos) {
    video.addEventListener("pause", () => {
      if (video.dataset.visibilityPaused !== "true") video.dataset.userPaused = "true"
    })
    video.addEventListener("play", () => {
      delete video.dataset.userPaused
      delete video.dataset.visibilityPaused
    })
    observer.observe(video)
  }

  reducedMotion.addEventListener("change", () => {
    if (reducedMotion.matches) {
      for (const video of videos) video.pause()
    }
  })
})()
`

  return Advertisement
}) satisfies QuartzComponentConstructor<AdvertisementOptions | undefined>
