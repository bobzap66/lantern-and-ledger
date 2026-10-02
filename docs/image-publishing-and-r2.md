# Asset publishing and Cloudflare R2

Lantern and Ledger keeps its authoring asset library in `bobzap66/inner-sea-region-vault`, while production delivery for large media is handled by Cloudflare R2. This keeps the GitHub Pages deployment artifact small while preserving normal local/Obsidian authoring.

## Sources of truth

The vault remains canonical:

- `inner-sea-region-vault/assets/images/` — published campaign and reference imagery.
- `inner-sea-region-vault/assets/audio/` — published website audio, including the Curtain Call session score.

R2 is a published mirror, not a second authoring location. Do not edit the R2 copy directly.

For Curtain Call, keep archival master audio such as WAV files outside the website repository. Only the web-ready MP3 belongs under `assets/audio/curtain-call/`.

## Vault-to-R2 synchronization

Changes under either `assets/images/**` or `assets/audio/**` on the vault's `main` branch trigger the vault workflow `.github/workflows/sync-images-to-r2.yml`. The filename is historical; the workflow now publishes both asset families.

Before upload, the workflow creates temporary Quartz-compatible trees. Path components are lowercased and spaces are replaced with hyphens while existing punctuation is preserved. It fails before synchronization if two source paths would normalize to the same R2 key.

The trees are mirrored to:

- `s3://lantern-and-ledger/assets/images/`
- `s3://lantern-and-ledger/assets/audio/`

Each sync uses `--delete`, so R2 follows the canonical vault for that asset family. Removed vault files are removed from R2 on the next successful sync.

After a successful asset sync, the vault workflow sends the `vault-updated` repository dispatch to this repository so Quartz rebuilds only after the referenced media is available in R2.

## Quartz build behavior

The production workflow checks out the complete vault, including images and audio. This is intentional: Quartz rendering and internal asset validation can operate against local files before publication.

After Quartz builds the site and `scripts/check-built-links.mjs` validates local output, `scripts/externalize-published-images.mjs` rewrites rendered references to both `assets/images/` and `assets/audio/` so they use the public R2 asset base. It then removes the corresponding local directories from the Pages artifact.

The script name is retained for compatibility, but its job now covers published media generally.

The current public asset base is:

`https://pub-1a4993afa4544a3195fc51c9ddfa25a8.r2.dev`

It is configured centrally as `PUBLIC_ASSET_BASE_URL` in `.github/workflows/deploy.yml`. If delivery later moves to a custom domain, change that centralized value rather than rewriting vault content.

## Normal publishing flow

For a content-only vault change:

`vault commit -> Quartz rebuild -> GitHub Pages`

For a vault change that includes published media:

`vault commit -> R2 synchronization -> Quartz rebuild -> externalize media URLs -> GitHub Pages`

The R2 synchronization can also be run manually from GitHub Actions through `workflow_dispatch`.

## Curtain Call audio

Web copies live at:

`assets/audio/curtain-call/`

Use normalized, descriptive filenames such as:

`session-01-a-matter-of-salted-fish.mp3`

Session notes should use an HTML `<audio controls preload="none">` player inside the reusable `[!opera]` callout. The build validates the local audio reference before replacing it with the R2 URL.

See `docs/curtain-call-audio.md` for the authoring pattern.

## Credentials and maintenance

R2 credentials live only as GitHub Actions secrets in the vault repository. The required secret names are `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, and `R2_ENDPOINT`; `PUBLISH_TOKEN` is used to trigger this repository after synchronization. Never commit their values.

Because each R2 sync uses `--delete`, the temporary normalized tree must always represent the complete intended published library for that asset family. Collision checks and staging complete before either R2 command runs.
