# Campaign character and vignette structure

Every campaign uses the same character-vignette contract. The site components depend on metadata and archive membership, not on campaign-specific code.

## Canonical folders

```text
Campaigns/<Campaign>/
├── Characters/
│   └── <Character>.md
└── Vignettes/
    └── <Character>/
        ├── index.md
        └── <Vignette>.md
```

A character may use `Characters/<Character>/index.md` when it owns child notes. The site treats that as the same logical character page as `Characters/<Character>.md`.

Older archive pages named `Vignettes/<Character>/<Character>.md` remain supported during migration, but new and renamed archives should use `index.md`.

## Character page

Required frontmatter:

```yaml
type: person
```

When a matching archive exists, the shared `CharacterVignettes` component automatically links to it. A `vignette_index` override is supported for an exceptional archive location, but it should not be needed for the canonical structure.

## Character vignette archive

The archive is `Vignettes/<Character>/index.md` with:

```yaml
type: index
campaign: "[[../../index|<Campaign>]]"
character: "[[../../Characters/<Character>|<Character>]]"
parent: "[[../index|Vignettes]]"
```

The archive page is generated from every `type: vignette` note in its own folder. Its `character` link is the authoritative association back to the character page.

## Vignette page

Required frontmatter:

```yaml
type: vignette
campaign: "[[../../index|<Campaign>]]"
character: "[[../../Characters/<Character>|<Character>]]"
parent: "[[./index|<Character> Vignettes]]"
```

Use `date` for the real-world publication date when it is known:

```yaml
date: 2026-09-12
```

Use `campaign_date_name` for the in-world date. A vignette may have both fields; the archive and Previous/Next navigation use publication date first when it exists, while retaining the campaign date as separate metadata.

```yaml
campaign_date_name: 17 Erastus 4722 AR
```

If a publication date is uncertain, record that explicitly rather than inventing one:

```yaml
date_status: uncertain
```

## Navigation rules

- Previous and Next are limited to `type: vignette` notes in the same character archive folder.
- Vignettes in different campaigns can never become siblings merely because their characters share a name.
- The archive backlink resolves to the `type: index` note in that folder.
- Special collections such as GM vignettes, newspapers, and intelligence reports may use their own archive conventions; they do not participate in a character archive unless they follow the contract above.
