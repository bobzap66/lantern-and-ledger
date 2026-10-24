import { QuartzComponent, QuartzComponentConstructor } from "./types"

export default (() => {
  const PublicationBrandingRuntime: QuartzComponent = () => null

  PublicationBrandingRuntime.css = `
@media (max-width: 800px) {
  .site-publication-header--beacon-and-bulletin .site-publication-masthead__beacon {
    width: clamp(7rem, 32vw, 8.5rem);
    height: auto;
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
const syncBeaconAndBulletinMasthead = () => {
  const body = document.querySelector("#quartz-body[data-site-publication]")
  const header = document.querySelector(".site-publication-header[data-site-publication]")
  if (body?.getAttribute("data-site-publication") !== "beacon-and-bulletin") return

  const masthead = header?.querySelector(".site-publication-masthead__beacon")
  if (!masthead) return

  const isCompact = window.matchMedia("(max-width: 800px)").matches
  const compactPath = masthead.getAttribute("data-compact-src")
  const siteRoot = header?.getAttribute("data-site-root") || ""
  const widePath = siteRoot + "/static/branding/beacon-and-bulletin-masthead.webp"
  const nextPath = isCompact ? compactPath : widePath
  if (!nextPath || masthead.getAttribute("src") === nextPath) return

  masthead.setAttribute("src", nextPath)
  masthead.setAttribute("width", isCompact ? "1254" : "2048")
  masthead.setAttribute("height", isCompact ? "1254" : "768")
}

const syncPublicationFooterHome = () => {
  const body = document.querySelector("#quartz-body[data-site-publication]")
  const header = document.querySelector(".site-publication-header[data-site-publication]")
  const footerHome = [...document.querySelectorAll("footer a")].find(
    (link) => link.textContent?.trim() === "Home",
  )
  if (!body || !header || !footerHome) return

  if (body.getAttribute("data-site-publication") === "beacon-and-bulletin") {
    const homePath = header.getAttribute("data-site-publication-home")
    if (homePath) footerHome.setAttribute("href", homePath)
  }
}

document.addEventListener("nav", syncBeaconAndBulletinMasthead)
syncBeaconAndBulletinMasthead()
document.addEventListener("nav", syncPublicationFooterHome)
syncPublicationFooterHome()

if (!window.__sitePublicationBrandingMediaBound) {
  window.__sitePublicationBrandingMediaBound = true
  window.matchMedia("(max-width: 800px)").addEventListener("change", syncBeaconAndBulletinMasthead)
}
`

  return PublicationBrandingRuntime
}) satisfies QuartzComponentConstructor
