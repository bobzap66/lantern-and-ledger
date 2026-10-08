# AGENTS.md

## Purpose

This repository is the Quartz v5 application and publishing pipeline for **Lantern & Ledger**.

Keep changes narrow, preserve existing behavior outside the requested scope, and verify the result before declaring a task complete. Prefer fixing the root cause over adding workarounds.

## Local repository locations

The user's working copies of the two related repositories live as sibling folders under the Dropbox Obsidian directory:

```text
Dropbox/Obsidian/lantern-and-ledger
Dropbox/Obsidian/Inner_Sea_Region_Obsidian_Prototype
```

Treat these as paths relative to the user's Dropbox root rather than assuming a particular operating-system home-directory prefix.

When working locally from this repository, the canonical vault is normally available at:

```text
../Inner_Sea_Region_Obsidian_Prototype
```

Prefer that sibling checkout when a task requires editing canonical campaign/editorial content. A `content/` directory inside this repository is a build checkout/worktree of the vault and must not be mistaken for the canonical local authoring copy.

## Repository boundaries

This repository owns the site implementation, including:

- `quartz/components/` — local layout and UI components
- `quartz/plugins/transformers/` — custom Markdown/content transformers
- `quartz/styles/` — shared and campaign-aware styling
- `scripts/` — build, validation, normalization, generation, and publishing helpers
- `quartz.ts` — local component/transformer registration and project configuration
- `.github/workflows/` — deployment and automation
- `docs/` — internal developer documentation

The canonical published campaign/editorial content is **not** owned here. CI checks out `bobzap66/inner-sea-region-vault` into `content/` before building.

If a local `content/` directory exists, treat it as the separate vault checkout. Do not accidentally commit vault content to this repository. When a task spans both repositories, keep ownership explicit and make each change in the repository that owns it.

## Read these before editing related systems

Use the existing project documentation as the source of truth instead of re-deriving conventions:

- Character/vignette structure: `docs/campaign-character-vignette-structure.md`
- Shared components and metadata contracts: `docs/lantern-and-ledger-components.md`
- Published images/audio and R2 behavior: `docs/image-publishing-and-r2.md`
- Curtain Call audio authoring: `docs/curtain-call-audio.md`
- Production build/deploy sequence: `.github/workflows/deploy.yml`

When a shared component, transformer, metadata contract, or authoring feature changes materially, update the relevant project documentation in the same work.

## Content and asset rules

- The vault is canonical for publishable campaign notes, articles, image metadata, images, and web audio.
- R2 is a published mirror, not an authoring source. Never edit R2 as the source of truth.
- Do not commit credentials, tokens, secret values, or local configuration containing secrets.
- Do not add generated `public/`, `node_modules/`, caches, diagnostics, or temporary verification trees to source control.
- Preserve existing article voice and prose unless the task specifically asks for editorial rewriting.
- Do not invent missing dates, metadata, character associations, or campaign facts. Inspect the source records first.

## Architecture conventions

- Prefer one shared component plus campaign theme variables over campaign-specific copies of the same component.
- Keep campaign-specific appearance in shared theme CSS whenever practical.
- A new transformer or local layout component must be registered through the appropriate path in `quartz.ts`; creating the file alone is not sufficient.
- Reuse existing helpers, metadata contracts, and components before introducing parallel implementations.
- Avoid broad changes to upstream Quartz internals when a local component, transformer, style, or script can solve the problem cleanly.
- Maintain mobile behavior and dark-mode behavior when changing presentation components.
- Preserve accessibility behavior, alt-text handling, keyboard interactions, and reduced-motion behavior when modifying interactive UI.

## Code style

The repository uses Prettier with these important defaults:

- 2-space indentation
- no semicolons
- trailing commas
- 100-character print width

Match surrounding TypeScript/TSX/SCSS/JavaScript style. Avoid unrelated reformatting.

## Runtime and setup

Use Node 22 or newer and npm 10.9.2 or newer.

For a clean checkout:

```bash
npm ci
npx quartz plugin install --from-config --clean
```

Do not casually update dependencies or regenerate `package-lock.json` unless the task requires it.

## Verification

Run the smallest set of checks that actually proves the requested change works. Do not claim checks passed if they were not run.

For TypeScript/TSX/JavaScript changes, normally run:

```bash
npm run typecheck
npm test
```

For formatting-sensitive code, also run an appropriate Prettier check on the changed files or `npm run check` when practical.

For changes that affect rendering, transformers, generated content, routing, links, assets, or build scripts, run a Quartz build when a valid `content/` vault checkout is available:

```bash
npx quartz build
```

When the user indicates that more related changes are queued, defer the full Quartz build and production deployment until the batch is ready. Review each incremental change locally, then run one integrated build and deploy after the user signals the batch is complete.

For deployment, link, asset, or generation work, inspect `.github/workflows/deploy.yml` and run the relevant project scripts from that workflow. The production pipeline performs additional normalization, generation, link checking, media externalization, and artifact-size validation beyond the basic Quartz build.

If the vault checkout or another required external dependency is unavailable, say exactly which verification step could not be run instead of substituting a weaker check and calling the task complete.

## Build failures

When investigating CI or build failures:

1. Read the failing job and step before editing code.
2. Reproduce the failing command locally when possible.
3. Identify the root cause, including differences between local and CI environments.
4. Make the smallest appropriate fix.
5. Re-run the failing command and the checks most likely to catch regressions.
6. Review the final diff for unrelated changes.

Do not repeatedly patch symptoms without revisiting the underlying assumption when a failure changes form after a fix.

## Git and change hygiene

- Inspect the current implementation before modifying it.
- Keep diffs focused on the requested task.
- Do not undo unrelated user changes.
- Do not rename, move, or reorganize files just for cleanliness unless the task calls for it.
- Do not commit generated build output.
- Use descriptive commit messages that state what changed, not merely that files were updated.
- Before finishing, review the diff and summarize any verification performed or remaining limitation.

## Subagents

Use subagents only when the task has genuinely independent lines of investigation or implementation. Routine edits should stay with a single agent.

Good subagent uses include:

- a difficult CI failure with separate workflow, application, and recent-change hypotheses;
- repository-wide investigation where several areas can be inspected independently;
- a substantial feature where research, tests, and implementation can be cleanly separated.

Prefer parallel **read-only investigation** first. The root agent should synthesize findings and own the final implementation. Do not have multiple agents edit the same files concurrently, and do not spawn subagents merely to perform trivial searches or mechanical edits.

## Completion standard

A task is complete when the requested behavior is implemented, relevant documentation is updated when necessary, applicable checks have passed, and the final diff contains no unintended changes. If any of those cannot be established, report the limitation clearly.
