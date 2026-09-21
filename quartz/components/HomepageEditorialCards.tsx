import { editorialCardCss } from "./EditorialCard"
import { QuartzComponent, QuartzComponentConstructor } from "./types"

const HomepageEditorialCards: QuartzComponent = () => null

HomepageEditorialCards.css = `
${editorialCardCss}

body[data-slug="index"] article .home-recents {
  margin-top: 1.8rem;
}

body[data-slug="index"] article .home-recent-section {
  margin-top: 2.15rem;
}

body[data-slug="index"] article .home-recent-section:first-child {
  margin-top: 0;
}

body[data-slug="index"] article .home-recent-section__header {
  margin-bottom: 0.9rem;
}

body[data-slug="index"] article .home-recent-section__header h2 {
  margin: 0;
}

body[data-slug="index"] article .home-recent-section__header p {
  margin: 0.28rem 0 0;
  color: var(--gray);
  font-size: 0.9rem;
  line-height: 1.45;
}

body[data-slug="index"] article .home-editorial-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.85rem;
}

body[data-slug="index"] article a.home-editorial-card.editorial-card.internal {
  --editorial-card-accent: var(--tertiary);
  --editorial-card-rule: var(--isr-rule, var(--lightgray));
  height: 100%;
  padding: 0;
  box-sizing: border-box;
  background: color-mix(in srgb, var(--light) 94%, var(--editorial-card-accent) 6%);
}

body[data-slug="index"] article a.home-editorial-card.editorial-card.internal:hover {
  background: color-mix(in srgb, var(--light) 91%, var(--editorial-card-accent) 9%);
}

body[data-slug="index"] article .home-editorial-card--kingmaker {
  --editorial-card-accent: #b98532 !important;
}

body[data-slug="index"] article .home-editorial-card--abomination-vaults {
  --editorial-card-accent: #4e9b86 !important;
}

body[data-slug="index"] article .home-editorial-card--season-of-ghosts {
  --editorial-card-accent: #c68b2c !important;
}

body[data-slug="index"] article .home-editorial-card--claws-of-the-tyrant {
  --editorial-card-accent: #a94b46 !important;
}

body[data-slug="index"] article .home-editorial-card .editorial-card__copy {
  min-height: 9rem;
}

body[data-slug="index"] article .home-editorial-card .editorial-card__description {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

body[data-slug="index"] article .home-editorial-card .editorial-card__footer {
  margin-top: auto;
}

body[data-slug="index"] article .home-recent-empty {
  margin: 0;
  color: var(--gray);
  font-size: 0.88rem;
}

@media (max-width: 700px) {
  body[data-slug="index"] article .home-editorial-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  body[data-slug="index"] article .home-editorial-card .editorial-card__copy {
    min-height: 0;
  }
}
`

export default (() => HomepageEditorialCards) satisfies QuartzComponentConstructor
