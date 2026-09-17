# Lantern and Ledger component reference

> **Internal developer documentation.** This file lives in the Quartz repository's `docs/` directory, not in the Obsidian vault checked out as `content/`, so it is not published on the Lantern and Ledger site.

This document records the project-specific authoring components, metadata contracts, generators, and theme hooks used by Lantern and Ledger. When a shared component is added or materially changed, update this document in the same work.

## Publishing boundary

The GitHub Pages workflow checks `bobzap66/inner-sea-region-vault` out into `content/` and runs Quartz against that directory. Files under this repository's `docs/` directory are repository documentation only and are not part of the public site content.

## Campaign identity and page theming

Campaign pages automatically receive a body class based on their campaign slug:

```text
campaign--kingmaker
campaign--abomination-vaults
campaign--season-of-ghosts
campaign--claws-of-the-tyrant
```

Shared page styling lives in:

```text
quartz/styles/campaign-page-theme.scss
```

Shared timeline styling lives in:

```text
quartz/styles/campaign-timeline.scss
```

The campaign class controls theme variables rather than creating separate copies of components. Ordinary campaign pages inherit campaign-specific accents for article-title rules, section rules, H3 headings, drop caps, links, blockquotes, tables, profile callouts, session galleries, character cards, and NPC cards. Timeline components use the same campaign identity but retain their own stronger component styling.

## `character-cards`

Implementation:

```text
quartz/plugins/transformers/characterCards.ts
```

Purpose: render player-character portrait cards from character frontmatter.

Basic usage:

````markdown
```character-cards
```
````

Supported query options:

```yaml
status: active
# Include only this card_group.
group: willowshore-company
# Exclude this card_group.
exclude_group: inactive
# Include matching character notes in child folders.
recursive: true
```

Character records must use:

```yaml
type: person
role: player-character
```

Useful optional fields:

```yaml
title: Ally Grainger
status: active
portrait: assets/images/...
card_order: 6
card_group: willowshore-company
card_subtitle: Human Wizard
```

Cards automatically display the number of matching character vignettes when the vignette metadata can be associated with the character.

Card appearance inherits the current campaign theme. On narrow phone layouts the shared CSS changes the presentation to a more compact horizontal portrait-and-text treatment.

## `npc-cards`

Implementation:

```text
quartz/plugins/transformers/npcCards.ts
```

Purpose: render a compact, portrait-driven NPC directory suitable for larger casts and for repeated editorial groupings.

Basic usage:

````markdown
```npc-cards
```
````

Supported query options include:

```yaml
# Either status or npc_status may be used.
status: active

# Match any listed NPC role.
npc_role:
  - official
  - ruler

# Singular/plural affiliation aliases are accepted.
affiliations:
  - Republic of Thumping Waters

# Curate an exact group by title. This is useful when a person
# intentionally appears in more than one editorial section.
include:
  - Akiros Insmort
  - Jubilost Narthropple

# Remove specific titles from an otherwise metadata-driven group.
exclude:
  - Example NPC

# Include NPC notes in child folders.
recursive: true

# Per-directory description overrides. Keys are NPC titles.
descriptions:
  Granny Hu: Retired imperial guard captain, Willowshore elder, and uncompromising advocate for preparedness.
```

The affiliation query accepts `affiliation`, `affiliations`, `npc_affiliation`, or `npc_affiliations`. `npc_role` and `npc_roles` are both accepted. Query lists use OR matching: an NPC matches when any requested role or affiliation is present.

NPC records are recognized when they are `type: person` and are explicitly marked `role: non-player-character`, carry `npc_role` metadata, or live in an `NPCs` folder. This supports both the newer campaign schema and older Kingmaker records.

Useful optional fields include:

```yaml
title: Granny Hu
status: active
# Older records may instead use:
npc_status: alive

portrait: assets/images/season-of-ghosts/npcs/granny-hu.webp
card_order: 10
card_subtitle: Retired Imperial Guard Captain
card_description: Willowshore elder, hard-edged defender, and one of the principal witnesses to the town's oral history.

npc_role:
  - ally
  - official
npc_affiliations:
  - Republic of Thumping Waters
```

### NPC subtitle fallback

The displayed subtitle uses the first available value from:

```text
card_subtitle
occupation
title_role
office
npc_role
```

Arrays are joined with a centered dot.

### NPC description fallback

Description precedence is:

1. a matching `descriptions:` override in the current `npc-cards` block;
2. the first available explicit NPC field from `card_description`, `card_summary`, `summary`, or `description`;
3. the first sentence of the first meaningful body paragraph, limited when unusually long.

This allows a directory to curate concise browsing copy without rewriting every NPC article, while still allowing `card_description` on individual records when the description should travel with the NPC everywhere.

The status pill reads from `status` first and falls back to `npc_status`. If an NPC has no portrait, the card renders an initials placeholder.

NPC card appearance inherits the current campaign theme.

## Folder gallery: `gallery`

Implementation:

```text
quartz/plugins/transformers/folderGallery.ts
```

Purpose: create a carousel from every supported image file in a folder.

Usage:

````markdown
```gallery
./Gallery Folder
```
````

Paths beginning with `./` or `../` are resolved relative to the current note. Other paths are resolved from the vault root. Supported image extensions include AVIF, GIF, JPEG/JPG, PNG, and WebP.

The component sorts filenames naturally, supports previous/next buttons and keyboard navigation, and uses a mobile-friendly control layout.

Use this when the folder itself defines membership. Use the metadata-driven components below when gallery membership should be semantic rather than folder-based.

## Metadata image gallery: `image-gallery`

Implementation:

```text
quartz/plugins/transformers/imageMetadataGallery.ts
```

Purpose: render a static image grid from records in `Image Metadata`.

Example:

````markdown
```image-gallery
campaign: Kingmaker
character: Ally Grainger
```
````

Supported filter keys accept singular or plural forms where applicable:

```text
player_character / player_characters
character / characters
npc / npcs
subject / subjects
campaign / campaigns
group / groups
location / locations
event / events
tag / tags
session / sessions
article / articles
campaign_date / campaign_dates
```

Image metadata records must use:

```yaml
type: image
asset: assets/images/...
title: Image title
caption: Optional display caption
```

The remaining semantic fields on an image record are used by the filters above.

## Metadata image carousel: `image-carousel`

Implementation:

```text
quartz/plugins/transformers/imageMetadataCarousel.ts
```

Purpose: render the same metadata-selected image set as an interactive carousel.

Example:

````markdown
```image-carousel
character: Ally Grainger
interval: 10
```
````

It supports the same semantic filters as `image-gallery` plus:

```yaml
interval: 10
```

`interval` is the automatic advance interval in seconds. `0` disables automatic advancement. Values are clamped between 0 and 120 seconds. Automatic motion pauses for reduced-motion users, while hovered, while keyboard focus is inside the carousel, when the carousel is offscreen, and when the browser tab is hidden.

## Campaign timelines

Generator:

```text
scripts/generate-campaign-timelines.mjs
```

Presentation:

```text
quartz/styles/campaign-timeline.scss
```

Purpose: build one shared timeline presentation from campaign records while allowing each campaign to inherit its own visual identity.

A generated timeline page uses frontmatter such as:

```yaml
title: Kingmaker Timeline
type: timeline
generated_timeline: true
timeline_grouping: year
```

`timeline_grouping` may be `year` or `season`.

The generated region must be bounded by:

```html
<!-- CAMPAIGN_TIMELINE_START -->
<!-- CAMPAIGN_TIMELINE_END -->
```

The generator writes timeline callouts between those markers.

### Timeline source records

Campaign records can participate through campaign/event dates or explicit inclusion. Relevant fields include:

```yaml
campaign_date: 4710-Desnus-1
campaign_date_start: 4710-Desnus-1
campaign_date_end: 4710-Desnus-3

timeline_include: true
timeline_exclude: true

timeline_importance: major
timeline_title: Optional timeline title
timeline_label: Optional eyebrow/record label
timeline_summary: Optional short summary
timeline_date_label: Optional replacement date label
timeline_link_label: Optional source-link label
```

If `timeline_importance` is omitted, the first event in a generated group is treated as major; otherwise events are minor unless marked `major`.

Timeline rendering alternates left/right and uses `timeline-major-*` and `timeline-minor-*` callouts. The CSS supplies the shared geometry while campaign body classes provide theme variables.

### Manual timeline events

A timeline page or `type: timeline-metadata` record can contain manual events:

```html
<!-- timeline-event
Title: Founding of Thumping Waters
Date: 4710-Desnus-1
Label: Civic history
Importance: major
Summary: The Republic of Thumping Waters was formally founded.
Links: [[./Thumping Waters/index|Republic of Thumping Waters]]
-->
```

Manual records support start/end forms as well as `date`.

## Article author and contributor cards

Implementation:

```text
quartz/plugins/transformers/articleAuthorCards.ts
```

Purpose: automatically attach author/contributor presentation to published article content and build authored/contributed article lists on author pages.

Author/contributor records use:

```yaml
type: author
# or
type: contributor
```

Article records use:

```yaml
type: article
author: Roald Celinnas
contributors:
  - Another Contributor
publication_date: 4716-Rova-12
```

The transformer matches author/contributor names case-insensitively. Published notes with `draft: true` or `publish: false` are excluded from its index.

This system is automatic; authors do not insert a fenced component block into the article body.

## Related Records

Implementation:

```text
quartz/components/RelatedRecords.tsx
quartz/components/EditorialCard.tsx
```

Purpose: add a compact editorial strip of up to three genuinely related archive records after article content. The component is registered in `quartz.ts` as an `afterBody` component before `VignetteNavigation`, so vignette pages render in this order:

```text
article content
Related Records
previous / archive / next vignette navigation
```

Related Records uses the shared `EditorialCard` presentation, inherits the active campaign accent and rule colors, renders three columns on wider screens, and collapses to one column below 700px.

### Automatic relationships

When `related_records` is absent, the component only runs automatically on article-like records. Supported `type` values include:

```text
article
report
session
session note
vignette
intelligence report
intelligence dossier
scholarly journal
journal article
academic paper
scholarly article
```

The following `format` values are also eligible:

```text
oral history
player fiction
gm fiction
```

Automatic inference is intentionally conservative:

1. Vignettes link to their `character` record, then to the campaign.
2. Other eligible records first link to `narrator` when present; if there is no narrator, `character` is used when present.
3. Records inside a `Session Notes` folder link to that session archive index.
4. Campaign records are added as a final safe relationship.
5. Unresolvable targets are skipped rather than occupying a card slot.
6. At most three unique records are rendered, and the current page is never linked to itself.

This keeps automatic results predictable and avoids trying to derive recommendations from every inline link or backlink in an article.

### Curated `related_records`

Any page can replace the automatic relationships by defining `related_records` in frontmatter. The simplest form is a list of record links or paths:

```yaml
related_records:
  - "[[../Locations/Willowshore|Willowshore]]"
  - "[[../Contributors/Granny Hu Ban-niang]]"
  - "../Session Notes"
```

Each item may instead be an object when the displayed card needs editorial overrides:

```yaml
related_records:
  - target: "[[../Locations/Willowshore|Willowshore]]"
    eyebrow: Location
    description: The isolated town at the center of the Willowshore oral history.
    cta: View location
  - target: "[[../Contributors/Granny Hu Ban-niang]]"
    title: Granny Hu Ban-niang
    kind: Contributor
    meta: Oral-history narrator
  - target: "../Session Notes"
    record_type: Session archive
```

The target field may be named `target`, `link`, `record`, or `path`. Optional display fields are:

```text
title
eyebrow
kind
record_type
type
description
meta
cta
```

`eyebrow`, `kind`, `record_type`, and `type` are aliases for the same card label override. If an override is omitted, the component uses the target record's metadata and inferred record kind.

The target record supplies fallback description text in this order:

```text
card_description
description
short_bio
card_summary
summary
role
record-type fallback copy
```

Curated records fully replace automatic inference; they are not merged with it. An explicit empty list therefore suppresses the section on a page that would otherwise qualify automatically:

```yaml
related_records: []
```

Unresolved curated targets are skipped. If no configured target resolves, the Related Records section is not rendered.

## Character/vignette navigation and dossiers

Implementation files include:

```text
quartz/components/CharacterVignettes.tsx
quartz/components/VignetteNavigation.tsx
quartz/plugins/transformers/vignetteIndexes.ts
quartz/plugins/transformers/campaignDossiers.ts
```

The canonical character/vignette metadata and folder contract is documented separately in:

```text
docs/campaign-character-vignette-structure.md
```

Keep that document authoritative for vignette folder structure, `character` links, publication dates, campaign dates, and previous/next navigation rules.

## Registration

Custom Markdown transformers are registered in:

```text
quartz.ts
```

Local layout components such as `CharacterVignettes`, `RelatedRecords`, and `VignetteNavigation` are also imported, instantiated, registered in the component registry, and added to the appropriate `beforeBody` or `afterBody` layout arrays in `quartz.ts`.

A newly created transformer or local layout component will not run simply because its file exists; it must also be registered in the corresponding configuration path.

## Styling rule

Prefer one shared component plus campaign theme variables over campaign-specific copies of the same component. Campaign identity should alter accents, rules, surfaces, marker treatments, and restrained ornament while preserving common layout and behavior.

## Maintenance checklist

When adding or materially changing a component:

1. Keep rendering/behavior in the shared component or transformer.
2. Keep campaign-specific appearance in shared theme CSS whenever practical.
3. Add or update a real usage example in the vault.
4. Update this reference with syntax, options, fallback behavior, and implementation path.
5. Confirm mobile behavior and dark mode.
6. Confirm the component remains outside `docs/` only when it is actual publishable campaign content; this documentation itself must remain internal to the Quartz repository.
