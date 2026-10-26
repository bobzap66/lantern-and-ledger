# Public article archive

The Lantern & Ledger site exposes a public `/articles/` index for campaign material that is explicitly safe to read without opting into campaign spoilers.

## Metadata contract

Campaign pages default to spoiler-gated. A campaign record bypasses the gate only when its frontmatter explicitly contains:

```yaml
spoiler: false
```

Missing `spoiler` metadata is therefore treated the same as `spoiler: true`.

The public article archive is stricter than the normal campaign recents lists. An entry is eligible only when it is publishable, belongs to Lantern & Ledger, and is explicitly spoiler-free:

```yaml
site_publication: "Lantern & Ledger"
spoiler: false
```

`draft: true`, `publish: false`, and `unlisted: true` records are excluded. Index, reference, and timeline-metadata records are also excluded from the generated article list.

`site_featured: true` is separate editorial metadata reserved for homepage promotion. It does not make a page spoiler-free and is not required for inclusion in `/articles/`.

## Generator

Implementation:

```text
scripts/generate-public-articles.mjs
```

The generator scans the checked-out vault, sorts eligible entries newest-first, and replaces the generated region in the canonical `Articles.md` page:

```html
<!-- PUBLIC_ARTICLES_START -->
<!-- PUBLIC_ARTICLES_END -->
```

Generated entries link to the original campaign record. The archive does not copy or relocate article content, so the campaign URL remains canonical.

The production deployment runs this generator after homepage recents are generated and before the Quartz build.
