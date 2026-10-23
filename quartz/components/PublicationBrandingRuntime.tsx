import { QuartzComponent, QuartzComponentConstructor } from "./types"

export default (() => {
  const PublicationBrandingRuntime: QuartzComponent = () => null

  PublicationBrandingRuntime.css = `
@media (max-width: 800px) {
  .site-publication-header--beacon-and-bulletin .site-publication-masthead__beacon {
    width: clamp(7rem, 32vw, 8.5rem);
    max-height: none;
    margin-inline: auto;
    border: 0;
    background: transparent;
    box-shadow: none;
    object-fit: contain;
    aspect-ratio: 1;
  }
}
`

  PublicationBrandingRuntime.afterDOMLoaded = `
const syncPublicationBrandingAssets = () => {
  const body = document.querySelector("#quartz-body[data-site-publication]")
  const header = document.querySelector(".site-publication-header[data-site-publication]")
  if (!body || !header) return
  if (body.getAttribute("data-site-publication") !== "beacon-and-bulletin") return

  const beaconImage = header.querySelector(".site-publication-masthead__beacon")
  if (!beaconImage) return

  const siteRoot = header.getAttribute("data-site-root") || ""
  const compact = window.matchMedia("(max-width: 800px)").matches
  beaconImage.setAttribute(
    "src",
    compact
      ? siteRoot + "/static/branding/beacon-and-bulletin-compact.webp"
      : siteRoot + "/static/branding/beacon-and-bulletin-masthead.webp",
  )
  beaconImage.setAttribute("width", compact ? "1254" : "2048")
  beaconImage.setAttribute("height", compact ? "1254" : "768")
}

document.addEventListener("nav", syncPublicationBrandingAssets)
syncPublicationBrandingAssets()

if (!window.__sitePublicationBrandingMediaBound) {
  window.__sitePublicationBrandingMediaBound = true
  window.matchMedia("(max-width: 800px)").addEventListener("change", syncPublicationBrandingAssets)
}
`

  return PublicationBrandingRuntime
}) satisfies QuartzComponentConstructor
