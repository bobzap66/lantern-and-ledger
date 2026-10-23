import { toChildArray } from "preact"
import { i18n } from "../i18n"
import { FullSlug, joinSegments, pathToRoot } from "../util/path"
import { getSitePublication } from "../util/sitePublication"
import DefaultHeadConstructor from "./Head"
import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"

const DefaultHead = DefaultHeadConstructor()

export default (() => {
  const PublicationHead: QuartzComponent = (props: QuartzComponentProps) => {
    const frontmatter = props.fileData.frontmatter as Record<string, unknown> | undefined
    const publication = getSitePublication(frontmatter)
    const isBeacon = publication.key === "beacon-and-bulletin"
    const rawPageTitle = String(
      props.fileData.frontmatter?.title ?? i18n(props.cfg.locale).propertyDefaults.title,
    )
    const beaconTitleSuffix =
      rawPageTitle.trim().toLowerCase() === publication.title.toLowerCase()
        ? ""
        : ` | ${publication.title}`
    const publicationCfg = isBeacon
      ? {
          ...props.cfg,
          pageTitle: publication.title,
          pageTitleSuffix: beaconTitleSuffix,
        }
      : props.cfg

    const rendered = DefaultHead({ ...props, cfg: publicationCfg })
    if (!rendered || typeof rendered !== "object" || !("props" in rendered)) return rendered

    const slug = props.fileData.slug
    const sitePath = new URL(`https://${props.cfg.baseUrl ?? "example.com"}`).pathname as FullSlug
    const baseDir = slug === "404" ? sitePath : pathToRoot(slug!)
    const faviconPath = isBeacon
      ? joinSegments(baseDir, "static/branding/beacon-and-bulletin-favicon.webp")
      : joinSegments(
          baseDir,
          "assets/images/lantern-and-ledger-branding/lantern-and-ledger-favicon.webp",
        )
    const children = toChildArray(rendered.props.children).filter((child) => {
      if (!child || typeof child !== "object") return true
      const vnode = child as { type?: unknown; props?: { rel?: unknown } }
      return !(vnode.type === "link" && vnode.props?.rel === "icon")
    })

    return (
      <head>
        {children}
        <link rel="icon" type="image/webp" href={faviconPath} />
      </head>
    )
  }

  PublicationHead.css = DefaultHead.css
  PublicationHead.beforeDOMLoaded = DefaultHead.beforeDOMLoaded
  PublicationHead.afterDOMLoaded = DefaultHead.afterDOMLoaded
  return PublicationHead
}) satisfies QuartzComponentConstructor
