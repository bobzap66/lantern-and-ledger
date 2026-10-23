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

`Header.tsx` uses the same resolver for the masthead and archive rule, and synchronizes the Quartz sidebar page title after SPA navigation. Future explorer filtering or publication-specific directory components should key off the same resolver/data attribute rather than re-parsing the raw frontmatter independently.

## Adding another publication

Add the new canonical frontmatter value and display metadata to `SITE_PUBLICATIONS` in `quartz/util/sitePublication.ts`, then add any publication-specific theme selectors or branding assets in the site header. Do not overload the article-level `publication` field.
