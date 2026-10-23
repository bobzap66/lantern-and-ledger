import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { CampaignSpoilerGate } from "./CampaignSpoilerGate"
import { getSitePublication } from "../util/sitePublication"

const Header: QuartzComponent = (props: QuartzComponentProps) => {
  const { children, cfg, ctx, fileData } = props
  const frontmatter = fileData.frontmatter as Record<string, unknown> | undefined
  const sitePublication = getSitePublication(frontmatter)
  const isLanternLedger = sitePublication.key === "lantern-and-ledger"
  const siteRoot =
    ctx.argv.serve || !cfg.baseUrl
      ? ""
      : new URL(`https://${cfg.baseUrl}`).pathname.replace(/\/$/, "")
  const encodedHomeSlug = sitePublication.homeSlug
    .split("/")
    .filter(Boolean)
    .map(encodeURIComponent)
    .join("/")
  const homePath = encodedHomeSlug ? `${siteRoot}/${encodedHomeSlug}` : `${siteRoot}/`
  const spoilerControllerPath = `${siteRoot}/static/campaign-spoilers.js`
  const preferencesControllerPath = `${siteRoot}/static/preferences.js`
  const preferencesStylesPath = `${siteRoot}/static/preferences.css`
  const golarionPageLoaderPath = `${siteRoot}/static/golarion-page-loader.js`
  // Quartz's Assets emitter slugifies file paths as it copies them into public/.
  // The source folder is "lantern and ledger branding", so its published path is
  // "lantern-and-ledger-branding" rather than a URL-encoded space-separated path.
  const brandingRoot = `${siteRoot}/assets/images/lantern-and-ledger-branding`
  const mastheadPath = `${brandingRoot}/wide_vintage_newspaper_masthead_style_illustration.webp`
  const compactPath = `${brandingRoot}/lantern-and-ledger-compact.webp`
  const faviconPath = isLanternLedger ? `${brandingRoot}/lantern-and-ledger-favicon.webp` : ""

  return (
    <>
      <link rel="stylesheet" href={preferencesStylesPath} />
      <script src={spoilerControllerPath}></script>
      <script src={preferencesControllerPath}></script>
      <script src={golarionPageLoaderPath}></script>
      <header
        class={`site-publication-header site-publication-header--${sitePublication.key}`}
        data-site-publication={sitePublication.key}
        data-site-publication-title={sitePublication.title}
        data-site-publication-home={homePath}
        data-favicon-path={faviconPath || undefined}
      >
        <a class="site-publication-masthead" href={homePath} aria-label={`${sitePublication.title} home`}>
          {isLanternLedger ? (
            <picture>
              <source media="(max-width: 800px)" srcSet={compactPath} width={1254} height={1254} />
              <img
                src={mastheadPath}
                alt="The Lantern and Ledger — Light for the Present. Record for the Future."
                width={2048}
                height={768}
                decoding="async"
              />
            </picture>
          ) : (
            <span class="site-publication-wordmark">
              <span class="site-publication-wordmark__title">{sitePublication.title}</span>
              <span class="site-publication-wordmark__subtitle">
                {sitePublication.wordmarkSubtitle}
              </span>
            </span>
          )}
        </a>
        <div class="site-publication-archive-rule" aria-hidden="true">
          <span>{sitePublication.archiveLabel}</span>
        </div>
        {children.length > 0 && <div class="site-publication-header-children">{children}</div>}
      </header>
    </>
  )
}

Header.css = `${CampaignSpoilerGate.css ?? ""}
#quartz-body.campaign-spoiler-pending > :not(.campaign-spoiler-gate) {
  visibility: hidden !important;
  pointer-events: none !important;
}

#quartz-body.campaign-spoiler-pending > .campaign-spoiler-gate {
  visibility: visible !important;
  pointer-events: auto !important;
}

:root {
  --isr-gold: #c58b2b !important;
  --isr-gold-soft: rgba(197, 139, 43, 0.14) !important;
  --isr-navy: #405c68 !important;
  --isr-burgundy: #685238 !important;
  --isr-paper: #eee1c3 !important;
  --isr-ink: #17140f !important;
  --isr-rule: rgba(104, 82, 56, 0.28) !important;
  --isr-shadow: 0 12px 32px rgba(72, 52, 28, 0.09) !important;
  --site-publication-accent: var(--isr-gold);
  --site-publication-secondary: var(--isr-navy);
  --site-publication-rule: var(--isr-rule);
  --site-publication-glow: var(--isr-shadow);
}

[saved-theme="dark"] {
  --isr-gold: #d6a64c !important;
  --isr-gold-soft: rgba(214, 166, 76, 0.14) !important;
  --isr-navy: #89a4ae !important;
  --isr-burgundy: #b9a27d !important;
  --isr-paper: #1b1915 !important;
  --isr-ink: #eee1c3 !important;
  --isr-rule: rgba(238, 225, 195, 0.2) !important;
  --isr-shadow: 0 12px 32px rgba(0, 0, 0, 0.24) !important;
}

#quartz-body.site-publication--beacon-and-bulletin,
.site-publication-header--beacon-and-bulletin {
  --site-publication-accent: #3f7fa3;
  --site-publication-secondary: #29445f;
  --site-publication-rule: rgba(63, 127, 163, 0.3);
  --site-publication-glow: 0 12px 32px rgba(41, 68, 95, 0.12);
}

#quartz-body.site-publication--beacon-and-bulletin {
  --secondary: #3f7fa3 !important;
  --tertiary: #5b6fa8 !important;
  --highlight: rgba(63, 127, 163, 0.14) !important;
  --textHighlight: rgba(91, 111, 168, 0.2) !important;
}

[saved-theme="dark"] #quartz-body.site-publication--beacon-and-bulletin,
[saved-theme="dark"] .site-publication-header--beacon-and-bulletin {
  --site-publication-accent: #79b7d7;
  --site-publication-secondary: #a9c7da;
  --site-publication-rule: rgba(121, 183, 215, 0.28);
  --site-publication-glow: 0 12px 32px rgba(0, 0, 0, 0.28);
}

[saved-theme="dark"] #quartz-body.site-publication--beacon-and-bulletin {
  --secondary: #79b7d7 !important;
  --tertiary: #a8a9db !important;
  --highlight: rgba(121, 183, 215, 0.15) !important;
  --textHighlight: rgba(168, 169, 219, 0.22) !important;
}

/* The old shared cover is superseded by the publication masthead. */
.global-page-cover {
  display: none !important;
}

.site-publication-header {
  display: block;
  width: 100%;
  margin: 0 0 1.6rem;
}

.site-publication-masthead {
  display: block;
  width: 100%;
  color: inherit;
  text-decoration: none;
}

.site-publication-masthead picture,
.site-publication-masthead img {
  display: block;
  width: 100%;
}

.site-publication-masthead img {
  width: min(100%, 24rem);
  height: auto;
  max-height: none;
  margin-inline: auto;
  object-fit: contain;
  aspect-ratio: 8 / 3;
  border: 1px solid var(--site-publication-rule);
  border-radius: 0.22rem;
  background: var(--light);
  box-shadow: var(--site-publication-glow);
}

.site-publication-wordmark {
  display: grid;
  place-items: center;
  width: min(100%, 24rem);
  min-height: 8rem;
  margin-inline: auto;
  padding: 1.25rem 1.5rem 1.1rem;
  box-sizing: border-box;
  border: 1px solid var(--site-publication-rule);
  border-radius: 0.22rem;
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--site-publication-secondary) 8%, transparent), transparent 52%),
    var(--light);
  box-shadow: var(--site-publication-glow);
  text-align: center;
}

.site-publication-wordmark__title {
  color: var(--dark);
  font-family: var(--headerFont);
  font-size: clamp(1.75rem, 5vw, 2.8rem);
  font-weight: 700;
  line-height: 1.05;
  letter-spacing: 0.015em;
}

.site-publication-wordmark__subtitle {
  margin-top: 0.65rem;
  color: var(--site-publication-accent);
  font-family: var(--codeFont, var(--bodyFont));
  font-size: 0.66rem;
  font-weight: 600;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.site-publication-archive-rule {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  margin: 0.7rem 0 0;
  color: var(--darkgray);
  font-family: var(--bodyFont);
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  white-space: nowrap;
}

.site-publication-archive-rule::before,
.site-publication-archive-rule::after {
  content: "";
  flex: 1;
  height: 1px;
  background: var(--site-publication-rule);
}

.site-publication-header-children {
  margin-top: 1rem;
}

/* Keep the sidebar's site identity synchronized with the page publication. */
.page-title::after {
  color: var(--site-publication-accent, var(--tertiary)) !important;
  font-family: var(--bodyFont) !important;
  font-size: 0.62rem !important;
  font-weight: 700 !important;
  letter-spacing: 0.18em !important;
}

#quartz-body.site-publication--lantern-and-ledger .page-title::after {
  content: "THE LANTERN AND LEDGER · ARCHIVES" !important;
}

#quartz-body.site-publication--beacon-and-bulletin .page-title::after {
  content: "BEACON & BULLETIN · ARCHIVES" !important;
}

@media (max-width: 800px) {
  .site-publication-header {
    margin-bottom: 1.1rem;
  }

  .site-publication-masthead picture {
    display: grid;
    place-items: center;
  }

  .site-publication-masthead img {
    width: clamp(6rem, 28vw, 7.5rem);
    max-height: none;
    margin-inline: auto;
    border: 0;
    background: transparent;
    box-shadow: none;
    object-fit: contain;
    aspect-ratio: 1;
  }

  .site-publication-wordmark {
    width: min(100%, 18rem);
    min-height: 6.5rem;
    padding: 1rem 1.1rem 0.9rem;
  }

  .site-publication-wordmark__title {
    font-size: clamp(1.5rem, 8vw, 2.15rem);
  }

  .site-publication-wordmark__subtitle {
    font-size: 0.58rem;
    letter-spacing: 0.12em;
  }

  .site-publication-archive-rule {
    margin-top: 0.55rem;
    font-size: 0.6rem;
    letter-spacing: 0.12em;
  }
}

@media (max-width: 430px) {
  .site-publication-archive-rule {
    gap: 0.45rem;
    font-size: 0.55rem;
    letter-spacing: 0.08em;
  }
}
`

Header.afterDOMLoaded = `
const syncSitePublicationChrome = () => {
  const body = document.querySelector("#quartz-body[data-site-publication]")
  const header = document.querySelector(".site-publication-header[data-site-publication]")
  const publicationKey = body?.getAttribute("data-site-publication") || "lantern-and-ledger"
  const publicationTitle =
    body?.getAttribute("data-site-publication-title") ||
    header?.getAttribute("data-site-publication-title") ||
    "The Lantern and Ledger"
  const publicationHome = header?.getAttribute("data-site-publication-home") || "/"
  const pageTitle = document.querySelector(".page-title a, a.page-title")

  if (pageTitle) {
    pageTitle.textContent = publicationTitle
    pageTitle.setAttribute("aria-label", publicationTitle + " home")
    pageTitle.setAttribute("href", publicationHome)
  }

  let icon = document.querySelector('link[rel~="icon"]')
  if (!icon) {
    icon = document.createElement("link")
    icon.setAttribute("rel", "icon")
    document.head.appendChild(icon)
  }

  if (!icon.hasAttribute("data-site-publication-original-href")) {
    icon.setAttribute("data-site-publication-original-href", icon.getAttribute("href") || "")
  }

  const faviconPath = header?.getAttribute("data-favicon-path") || ""
  if (publicationKey === "lantern-and-ledger" && faviconPath) {
    icon.setAttribute("href", faviconPath)
  } else {
    const originalHref = icon.getAttribute("data-site-publication-original-href")
    if (originalHref) icon.setAttribute("href", originalHref)
  }
}

document.addEventListener("nav", syncSitePublicationChrome)
syncSitePublicationChrome()
`

export default (() => Header) satisfies QuartzComponentConstructor
