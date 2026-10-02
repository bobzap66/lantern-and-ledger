# Curtain Call session music

Curtain Call can publish one original operatic number for each session. The website MP3 is stored in the vault and delivered from Cloudflare R2; archival masters stay outside the website repository.

## File convention

Put the web-ready MP3 in:

`assets/audio/curtain-call/`

Use:

`session-NN-short-song-title.mp3`

Example:

`session-01-a-matter-of-salted-fish.mp3`

Prefer lowercase filenames, hyphens, and no spaces.

## Session-note block

Use the custom Curtain Call `opera` callout. For a normal note at `Campaigns/Curtain Call/Session Notes/<note>.md`, the audio path is three levels back to the vault root:

```md
> [!opera] From the Opera
> ### *A Matter of Salted Fish*
> <p class="opera-meta">Opening Ensemble — The Company Assembles</p>
>
> <audio controls preload="none">
>   <source src="../../../assets/audio/curtain-call/session-01-a-matter-of-salted-fish.mp3" type="audio/mpeg">
>   Your browser does not support the audio element.
> </audio>
>
> [Lyrics and production notes](../Music/A%20Matter%20of%20Salted%20Fish)
```

Use `preload="none"` so opening a session note does not automatically fetch the full MP3.

If a note lives at a different folder depth, adjust the relative `../` prefix. The existing content-asset normalization step will correct relative `assets/` prefixes during production builds.

## Soundtrack pages

The campaign soundtrack index is:

`Campaigns/Curtain Call/Music/index.md`

Each finished track may also have its own note containing:

- song title and session number;
- musical form or dramatic function;
- in-world performer/character perspective where relevant;
- lyrics;
- production notes;
- a link back to the session note.

The session article should contain the compact player. The track page can hold the full lyrics and commentary.

## Publishing flow

1. Generate and finalize the song in Suno.
2. Preserve the archival master outside the website repository.
3. Export a web-ready MP3.
4. Add it to `assets/audio/curtain-call/`.
5. Add the `[!opera]` block to the session note.
6. Commit the vault.
7. The vault workflow mirrors audio to R2 and then triggers the Quartz rebuild.
8. Quartz validates the local MP3, rewrites its public URL to R2, and removes the local audio copy from the Pages artifact.
