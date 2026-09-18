# Image publishing and Cloudflare R2

Lantern and Ledger keeps its authoring image library in `bobzap66/inner-sea-region-vault`, but production image delivery is handled by Cloudflare R2. This keeps the GitHub Pages deployment artifact small while preserving normal local/Obsidian authoring.

## Source of truth

`inner-sea-region-vault/assets/images/` is the canonical image library. Markdown and metadata in the vault should continue to reference local assets rather than public R2 URLs.

The R2 bucket is a published mirror, not a second authoring location.

## Vault-to-R2 synchronization

Changes under `assets/images/**` on the vault's `main` branch trigger the vault workflow `.github/workflows/sync-images-to-r2.yml`.

Before upload, that workflow creates a temporary Quartz-compatible tree. Path components are lowercased and spaces are replaced with hyphens while existing punctuation is preserved. It fails before synchronization if two source paths would normalize to the same R2 key.

The temporary tree is mirrored to:

`s3://lantern-and-ledger/assets/images/`

The sync uses `--delete`, so R2 follows the canonical vault: removed vault images are removed from R2 on the next successful sync.

After a successful automatic R2 sync, the vault workflow sends the `vault-updated` repository dispatch to this repository. The vault's general notification workflow ignores image-only changes so that Quartz cannot publish a page before its new image is available in R2.

## Quartz build behavior

The production workflow still checks out the complete vault, including images. This is intentional: build-time scripts, gallery expansion, Quartz rendering, and internal-link validation can continue to operate against local files.

After Quartz has built the site and `scripts/check-built-links.mjs` has validated the local output, `scripts/externalize-published-images.mjs`:

1. rewrites rendered references to `assets/images/` so they use the public R2 image base;
2. removes `public/assets/images/`.

Only then is the GitHub Pages artifact-size check run and the `public/` directory uploaded to Pages.

The current public image base is:

`https://pub-1a4993afa4544a3195fc51c9ddfa25a8.r2.dev`

It is configured centrally as `PUBLIC_IMAGE_BASE_URL` in `.github/workflows/deploy.yml`. If image delivery later moves to a custom domain, change that centralized value rather than rewriting vault content.

## Normal publishing flow

For a content-only vault change:

`vault commit -> Quartz rebuild -> GitHub Pages`

For a vault change that includes images:

`vault commit -> R2 synchronization -> Quartz rebuild -> externalize image URLs -> GitHub Pages`

The R2 synchronization can also be run manually from GitHub Actions through `workflow_dispatch`.

## Credentials and maintenance

R2 credentials live only as GitHub Actions secrets in the vault repository. The required secret names are `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, and `R2_ENDPOINT`; `PUBLISH_TOKEN` is used to trigger this repository after synchronization. Never commit their values.

Because the R2 sync uses `--delete`, the temporary normalized tree must always represent the complete intended published image library. The collision check and successful staging step occur before the R2 command for this reason.

The former build-time `optimize-vault-images.mjs` step has been removed from the production deployment. R2 serves the canonical vault image files, so Quartz must not create a temporary, differently optimized image library during its build. Image-format conversion and recompression should be performed on the canonical vault assets before they are published to R2.

At the time this architecture was adopted, the vault still contained two PNG files and hundreds of WebP files larger than 1 MiB. Those are source-library optimization opportunities rather than GitHub Pages artifact concerns; they should be normalized deliberately in the vault instead of being silently transformed during deployment.
