# Site publications

The archive supports multiple site-level publication identities through the `site_publication` frontmatter field. This field controls site chrome and must remain separate from the existing `publication` field, which identifies an in-world newspaper, journal, report series, or other publication attached to an individual article.

## Supported values

```yaml
site_publication: "Lantern & Ledger"
```

Uses the existing Lantern & Ledger masthead, archive label, favicon, and warm archive theme hooks. Its publication home is the site root (`/`).

```yaml
site_publication: "Beacon & Bulletin"
```

Uses the Beacon & Bulletin site identity and Starfinder-oriented holo-news theme. Its publication home is `/Beacon and Bulletin/`. Until dedicated Beacon & Bulletin image assets are added, the header renders a responsive text wordmark rather than requesting missing image files. The temporary wordmark uses the brand line `Current Signals. Lasting Record.`

## Fallback behavior

Pages with no `site_publication`, or with an unrecognized value, fall back to `Lantern & Ledger`. This keeps legacy content and generated pages safe while allowing new Starfinder content to opt into Beacon & Bulletin one page at a time.

## Rendering contract

`quartz/util/sitePublication.ts` is the canonical mapping between frontmatter values and publication display metadata, including each publication's `homeSlug`. `Body.tsx` exposes the resolved publication as:

- a `site-publication--<key>` class on `#quartz-body`;
- `data-site-publication` and publication label/title data attributes; and
- publication theme hooks such as `--site-publication-accent`.

`Header.tsx` uses the same resolver for the masthead, archive rule, sidebar identity, home route, and favicon behavior. The masthead and sidebar title always return to the current publication's own home page. The Lantern favicon is resolved with the configured site base path so it remains valid on GitHub Pages; Beacon & Bulletin falls back to the configured default favicon until dedicated assets are added.

## Publication styles

Publication-specific presentation belongs outside the shared header component. `quartz/components/PublicationStyles.tsx` is a null-rendering Quartz component that imports the publication SCSS files and exposes their compiled CSS through the standard `QuartzComponent.css` pipeline.

The publication styles live at:

- `quartz/styles/publications/lantern-and-ledger.scss`
- `quartz/styles/publications/beacon-and-bulletin.scss`

The established Lantern & Ledger gazetteer theme remains the site's baseline. Its publication stylesheet provides a dedicated extension point without duplicating the existing theme. Beacon & Bulletin is fully scoped beneath `site-publication--beacon-and-bulletin` and supplies its own dark-space palette, orbital/holographic masthead treatment, holo-news cards, article typography, campaign-directory treatment, navigation chrome, tables, callouts, responsive behavior, and reduced-motion overrides.

Do not add substantial publication branding directly to `Header.tsx`. Shared structural behavior belongs in the component; publication-specific visual behavior belongs in the publication stylesheet.

## Publication-aware discovery

Discovery surfaces are scoped by `site_publication` so records from one publication do not leak into another publication's navigation or feeds.

- `ExplorerCurator.tsx` derives publication boundaries from the parsed frontmatter in `allFiles`. The Explorer script hides branches and records that do not belong to the current page's publication, while preserving them in the DOM so SPA navigation can restore them when the publication changes.
- `scripts/generate-campaign-directory.mjs` discovers campaign-directory pages by their generation markers, reads each directory/archive pair's publication, and includes only campaign roots with the same publication. This allows `/Campaigns/` and `/Beacon and Bulletin/Campaigns/` to use one canonical campaign tree without duplicating campaign records.
- `scripts/generate-homepage-recents.mjs` discovers publication home pages by the `<!-- HOMEPAGE_RECENTS -->` marker and generates What's New / Recently Updated independently for each home, limited to records with the same `site_publication`. Each campaign's recent-content feed is likewise limited to that campaign's publication.

Generated directory pages that are intended to represent another publication must therefore carry that publication's `site_publication` value. A single URL still has one publication identity; Lantern & Ledger and Beacon & Bulletin use separate home and campaign-directory paths even though campaign roots remain canonical under `Campaigns/`.

## Beacon & Bulletin shell

The canonical Beacon & Bulletin shell is stored in the vault at:

- `Beacon and Bulletin/index.md` — publication home;
- `Beacon and Bulletin/Campaigns/index.md` — publication-scoped campaign directory; and
- `Beacon and Bulletin/Campaigns/Archive.md` — completed-campaign archive.

New Starfinder campaign roots should remain under the canonical `Campaigns/<Campaign>/` hierarchy and use `site_publication: "Beacon & Bulletin"`. The shared directory generator will surface them on the Beacon & Bulletin campaign pages rather than the Lantern & Ledger directory.

## Adding another publication

Add the new canonical frontmatter value, home slug, and display metadata to `SITE_PUBLICATIONS` in `quartz/util/sitePublication.ts`, then add a publication stylesheet and import it through `PublicationStyles.tsx`. Discovery generators that normalize publication values must also recognize the new canonical value. Do not overload the article-level `publication` field.
