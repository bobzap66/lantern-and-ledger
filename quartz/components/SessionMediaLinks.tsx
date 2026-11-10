import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"

const SessionMediaLinks: QuartzComponent = ({ fileData }: QuartzComponentProps) => {
  const metadata = (fileData.frontmatter ?? {}) as Record<string, unknown>
  const type = String(metadata.type ?? "").trim().toLowerCase()
  if (type !== "session-note" && type !== "session-report") return null

  const urlFor = (field: string) => {
    const value = metadata[field]
    if (typeof value !== "string") return ""
    const url = value.trim()
    return /^https:\/\/[^\s/]+/.test(url) ? url : ""
  }

  const sources = [
    { label: "Watch on YouTube", url: urlFor("youtube_url") },
    { label: "Watch on Twitch", url: urlFor("twitch_url") },
    { label: "Listen to Podcast", url: urlFor("podcast_url") },
    { label: "Watch or Listen", url: urlFor("recording_url") },
  ]
  const seen = new Set<string>()
  const links = sources.filter(({ url }) => {
    if (!url || seen.has(url)) return false
    seen.add(url)
    return true
  })
  if (links.length === 0) return null

  return (
    <nav class="session-media-links" aria-label="Session recordings">
      <h2 class="session-media-links__heading">Watch or Listen</h2>
      <p class="session-media-links__intro">Experience the original tabletop session.</p>
      <div class="session-media-links__list">
        {links.map(({ label, url }) => (
          <a href={url} target="_blank" rel="noopener noreferrer">
            {label} <span aria-hidden="true">↗</span>
          </a>
        ))}
      </div>
    </nav>
  )
}

SessionMediaLinks.css = `
.session-media-links {
  margin: 1.6rem 0;
  padding: 1rem 1.1rem;
  border: 1px solid var(--lightgray);
  border-left: 3px solid var(--campaign-page-accent, var(--tertiary));
  border-radius: 0.5rem;
  background: color-mix(in srgb, var(--light) 95%, var(--campaign-page-accent, var(--tertiary)) 5%);
}
.session-media-links__heading {
  margin: 0 0 0.25rem;
  color: var(--darkgray);
  font-size: 1.12rem;
}
.session-media-links__intro {
  margin: 0 0 0.75rem;
  color: var(--darkgray);
}
.session-media-links__list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
}
.session-media-links__list a {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.5rem 0.8rem;
  border: 1px solid var(--lightgray);
  border-radius: 0.35rem;
  background: var(--light);
  color: var(--darkgray);
  text-decoration: none;
  font-weight: 650;
}
.session-media-links__list a:hover,
.session-media-links__list a:focus-visible {
  border-color: var(--campaign-page-accent, var(--secondary));
  text-decoration: underline;
}
`

export default (() => SessionMediaLinks) satisfies QuartzComponentConstructor
