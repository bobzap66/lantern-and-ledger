export interface EditorialCardProps {
  href: string
  title: string
  eyebrow?: string
  description?: string
  meta?: string
  image?: string
  imageAlt?: string
  cta?: string
  className?: string
}

export function EditorialCard({
  href,
  title,
  eyebrow,
  description,
  meta,
  image,
  imageAlt,
  cta = "Open record",
  className,
}: EditorialCardProps) {
  const classes = [
    "editorial-card",
    image ? "editorial-card--with-image" : "",
    className ?? "",
    "internal",
  ]
    .filter(Boolean)
    .join(" ")

  return (
    <a href={href} class={classes}>
      {image && (
        <span class="editorial-card__media">
          <img src={image} alt={imageAlt ?? ""} loading="lazy" />
        </span>
      )}
      <span class="editorial-card__copy">
        {eyebrow && <span class="editorial-card__eyebrow">{eyebrow}</span>}
        <span class="editorial-card__title">{title}</span>
        {description && <span class="editorial-card__description">{description}</span>}
        {(meta || cta) && (
          <span class="editorial-card__footer">
            {meta && <span class="editorial-card__meta">{meta}</span>}
            {cta && (
              <span class="editorial-card__cta">
                {cta} <span aria-hidden="true">→</span>
              </span>
            )}
          </span>
        )}
      </span>
    </a>
  )
}

export const editorialCardCss = `
.editorial-card {
  --editorial-card-accent: var(--campaign-page-accent, var(--tertiary));
  --editorial-card-rule: var(--campaign-page-rule, var(--isr-rule));
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--editorial-card-rule);
  border-left: 3px solid var(--editorial-card-accent);
  border-radius: 0.55rem;
  background: color-mix(in srgb, var(--light) 94%, var(--editorial-card-accent) 6%);
  box-shadow: 0 0.15rem 0.5rem color-mix(in srgb, var(--dark) 7%, transparent);
  color: inherit !important;
  text-decoration: none !important;
  transition:
    transform 140ms ease,
    border-color 140ms ease,
    box-shadow 140ms ease,
    background 140ms ease;
}

.editorial-card--with-image {
  grid-template-columns: clamp(6.5rem, 20%, 9rem) minmax(0, 1fr);
}

.editorial-card:hover {
  border-color: color-mix(in srgb, var(--editorial-card-accent) 65%, var(--editorial-card-rule) 35%);
  background: color-mix(in srgb, var(--light) 91%, var(--editorial-card-accent) 9%);
  box-shadow: 0 0.3rem 0.8rem color-mix(in srgb, var(--dark) 13%, transparent);
  transform: translateY(-1px);
}

.editorial-card:focus-visible {
  outline: 2px solid var(--editorial-card-accent);
  outline-offset: 3px;
}

.editorial-card__media {
  display: block;
  min-height: 100%;
  overflow: hidden;
  border-right: 1px solid var(--editorial-card-rule);
}

.editorial-card__media img {
  display: block;
  width: 100%;
  height: 100%;
  min-height: 7.5rem;
  margin: 0;
  border: 0;
  border-radius: 0;
  box-shadow: none;
  object-fit: cover;
  transition: transform 180ms ease;
}

.editorial-card:hover .editorial-card__media img {
  transform: scale(1.025);
}

.editorial-card__copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  padding: 0.9rem 1rem 0.85rem;
}

.editorial-card__eyebrow {
  margin-bottom: 0.22rem;
  color: var(--editorial-card-accent);
  font-size: 0.64rem;
  font-weight: 700;
  letter-spacing: 0.11em;
  line-height: 1.2;
  text-transform: uppercase;
}

.editorial-card__title {
  color: var(--dark);
  font-family: var(--headerFont);
  font-size: 1.08rem;
  font-weight: 700;
  line-height: 1.25;
}

.editorial-card__description {
  margin-top: 0.35rem;
  color: var(--darkgray);
  font-size: 0.88rem;
  line-height: 1.45;
}

.editorial-card__footer {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem 1rem;
  margin-top: 0.7rem;
  padding-top: 0.55rem;
  border-top: 1px solid color-mix(in srgb, var(--editorial-card-rule) 78%, transparent);
}

.editorial-card__meta {
  color: var(--gray);
  font-size: 0.75rem;
  font-weight: 600;
}

.editorial-card__cta {
  margin-left: auto;
  color: var(--editorial-card-accent);
  font-size: 0.8rem;
  font-weight: 700;
  white-space: nowrap;
}

@media (max-width: 520px) {
  .editorial-card--with-image {
    grid-template-columns: 5.75rem minmax(0, 1fr);
  }

  .editorial-card__copy {
    padding: 0.75rem 0.8rem 0.72rem;
  }

  .editorial-card__description {
    font-size: 0.84rem;
  }

  .editorial-card__footer {
    margin-top: 0.55rem;
    padding-top: 0.45rem;
  }
}

@media (max-width: 360px) {
  .editorial-card--with-image {
    grid-template-columns: minmax(0, 1fr);
  }

  .editorial-card__media {
    max-height: 8rem;
    border-right: 0;
    border-bottom: 1px solid var(--editorial-card-rule);
  }
}

@media (prefers-reduced-motion: reduce) {
  .editorial-card,
  .editorial-card__media img {
    transition: none;
  }
}
`
