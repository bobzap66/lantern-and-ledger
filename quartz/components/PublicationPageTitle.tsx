import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { getSitePublication } from "../util/sitePublication"

const PublicationPageTitle: QuartzComponent = (props: QuartzComponentProps) => {
  const publication = getSitePublication(props.fileData.frontmatter as Record<string, unknown>)
  const slug = props.fileData.slug ?? "index"
  const baseDir =
    slug
      .split("/")
      .filter(Boolean)
      .slice(0, -1)
      .map(() => "..")
      .join("/") || "."
  const homeSlug = publication.homeSlug.split("/").filter(Boolean).map(encodeURIComponent).join("/")
  const homePath = homeSlug ? `${baseDir}/${homeSlug}/` : `${baseDir}/`

  return (
    <h2 class="page-title">
      <a href={homePath} aria-label={`${publication.title} home`}>
        {publication.title}
      </a>
    </h2>
  )
}

PublicationPageTitle.css = `
.page-title {
  font-size: 1.75rem;
  margin: 0;
  font-family: var(--titleFont);
}
`

export default (() => PublicationPageTitle) satisfies QuartzComponentConstructor
