# Site publications

The archive supports multiple site-level publication identities through the `site_publication` frontmatter field. This field controls site chrome and must remain separate from the existing `publication` field, which identifies an in-world newspaper, journal, report series, or other publication attached to an individual article.

## Supported values

```yaml
site_publication: "Lantern & Ledger"
```

Uses the existing Lantern & Ledger masthead, archive label, favicon, and warm archive theme hooks.

```yaml
site_publication: "Beacon & Bulletin"
```

Uses the Beacon & Bulletin site identity and cool Starfinder-oriented theme hooks. Until dedicated Beacon & Bulletin image assets are added, the header renders a responsive text wordmark rather than requesting missing image files.

## Fallback behavior

Pages with no `site_publication`, or with an unrecognized value, fall back to `Lantern & Ledger`. This keeps legacy content and generated pages safe while allowing new Starfinder content to opt into Beacon & Bulletin one page at a time.

## Rendering contract

`quartz/util/sitePublication.ts` is the canonical mapping between frontmatter values and publication display metadata. `Body.tsx` exposes the resolved publication as:

- a `site-publication--<key>` class on `#quartz-body`;
- `data-site-publication` and publication label/title data attributes; and
- publication theme hooks such as `--site-publication-accent`.

`Header.tsx` uses the same resolver for the masthead, archive rule, publication palette, sidebar identity, and favicon behavior. The Lantern favicon is resolved with the configured site base path so it remains valid on GitHub Pages; Beacon & Bulletin falls back to the configured default favicon until dedicated assets are added.

## Publication-aware discovery

Discovery surfaces are scoped by `site_publication` so records from one publication do not leak into another publication's navigation or feeds.

- `ExplorerCurator.tsx` derives publication boundaries from the parsed frontmatter in `allFiles`. The Explorer script hides branches and records that do not belong to the current page's publication, while preserving them in the DOM so SPA navigation can restore them when the publication changes.
- `scripts/generate-campaign-directory.mjs` reads the publication on the campaign directory/archive pages and includes only campaign roots with the same publication.
- `scripts/generate-homepage-recents.mjs` reads the homepage publication before generating What's New / Recently Updated and limits each campaign's recent-content feed to that campaign's publication.

Generated directory pages that are intended to represent another publication must therefore carry that publication's `site_publication` value. A single URL still has one publication identity; if Lantern & Ledger and Beacon & Bulletin both need their own campaign landing pages, give them separate content pages/paths and tag each appropriately.

## Adding another publication

Add the new canonical frontmatter value and display metadata to `SITE_PUBLICATIONS` in `quartz/util/sitePublication.ts`, then add any publication-specific theme selectors or branding assets in the site header. Discovery generators that normalize publication values must also recognize the new canonical value. Do not overload the article-level `publication` field.
