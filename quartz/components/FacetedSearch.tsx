import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
// @ts-expect-error - Inline script loaded as text by the Quartz esbuild plugin
import searchScript from "./scripts/facetedSearch.inline"

export default (() => {
  const FacetedSearch: QuartzComponent = ({ displayClass }: QuartzComponentProps) => (
    <template class="faceted-search-template">
      <div class={["faceted-search", displayClass].filter(Boolean).join(" ")}>
        <button
          class="faceted-search__trigger"
          type="button"
          aria-haspopup="dialog"
          aria-expanded="false"
        >
          <svg aria-hidden="true" viewBox="0 0 20 20">
            <circle cx="8.25" cy="8.25" r="5.75" fill="none" />
            <path d="m12.5 12.5 5 5" />
          </svg>
          <span>Search archive</span>
          <kbd>Ctrl K</kbd>
        </button>

        <div class="faceted-search__overlay" hidden>
          <section
            class="faceted-search__dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="faceted-search-title"
          >
            <header class="faceted-search__header">
              <div>
                <p class="faceted-search__eyebrow">Lantern &amp; Ledger Archive</p>
                <h2 id="faceted-search-title">Search the records</h2>
              </div>
              <button class="faceted-search__close" type="button" aria-label="Close search">
                ×
              </button>
            </header>

            <label class="faceted-search__query-label">
              <span class="visually-hidden">Search terms</span>
              <svg aria-hidden="true" viewBox="0 0 20 20">
                <circle cx="8.25" cy="8.25" r="5.75" fill="none" />
                <path d="m12.5 12.5 5 5" />
              </svg>
              <input
                class="faceted-search__query"
                type="search"
                autocomplete="off"
                placeholder="Search people, places, sessions, and stories…"
              />
            </label>

            <div class="faceted-search__filters" aria-label="Search filters">
              <label>
                <span>Campaign</span>
                <select class="faceted-search__campaign">
                  <option value="">All campaigns</option>
                </select>
              </label>
              <label>
                <span>Record type</span>
                <select class="faceted-search__type">
                  <option value="">All record types</option>
                </select>
              </label>
              <button class="faceted-search__clear" type="button">
                Clear
              </button>
            </div>

            <div class="faceted-search__status" aria-live="polite">
              Loading the archive…
            </div>
            <div class="faceted-search__results" role="listbox" aria-label="Search results" />
          </section>
        </div>
      </div>
    </template>
  )

  FacetedSearch.css = `
.faceted-search {
  width: 100%;
  min-width: 0;
}

.faceted-search__trigger {
  display: flex;
  align-items: center;
  width: 100%;
  min-width: 0;
  height: 2rem;
  padding: 0 .55rem;
  border: 1px solid var(--lightgray);
  border-radius: 4px;
  background: transparent;
  color: var(--gray);
  font: inherit;
  cursor: pointer;
}

.faceted-search__trigger:hover,
.faceted-search__trigger:focus-visible {
  border-color: var(--secondary);
  color: var(--dark);
}

.faceted-search__trigger svg,
.faceted-search__query-label svg {
  width: 1.05rem;
  min-width: 1.05rem;
  stroke: currentColor;
  stroke-width: 1.6;
  stroke-linecap: round;
}

.faceted-search__trigger span {
  overflow: hidden;
  margin-left: .48rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.faceted-search__trigger kbd {
  margin-left: auto;
  padding-left: .75rem;
  border: 0;
  background: transparent;
  color: var(--gray);
  font: 600 .68rem/1 var(--bodyFont);
  white-space: nowrap;
}

.faceted-search__overlay {
  position: fixed;
  z-index: 10010;
  inset: 0;
  box-sizing: border-box;
  overflow-y: auto;
  padding: clamp(1rem, 7vh, 5rem) 1rem 2rem;
  background: color-mix(in srgb, var(--dark) 34%, transparent);
  backdrop-filter: blur(5px);
}

.faceted-search__overlay[hidden] {
  display: none;
}

.faceted-search__dialog {
  width: min(66rem, 100%);
  margin: 0 auto;
  overflow: hidden;
  border: 1px solid var(--lightgray);
  border-radius: .65rem;
  background: var(--light);
  box-shadow: 0 1.4rem 4rem rgba(20, 16, 11, .32);
}

.faceted-search__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem 1.15rem .7rem;
  border-bottom: 1px solid var(--lightgray);
}

.faceted-search__eyebrow {
  margin: 0 0 .1rem;
  color: var(--gray);
  font-size: .72rem;
  font-weight: 700;
  letter-spacing: .11em;
  text-transform: uppercase;
}

.faceted-search__header h2 {
  margin: 0;
  color: var(--dark);
  font-size: clamp(1.2rem, 3vw, 1.65rem);
}

.faceted-search__close {
  width: 2.25rem;
  height: 2.25rem;
  border: 1px solid var(--lightgray);
  border-radius: 999px;
  background: transparent;
  color: var(--darkgray);
  font: 300 1.7rem/1 var(--bodyFont);
  cursor: pointer;
}

.faceted-search__query-label {
  display: flex;
  align-items: center;
  gap: .65rem;
  margin: 1rem 1.15rem .75rem;
  padding: 0 .8rem;
  border: 1px solid var(--lightgray);
  border-radius: .45rem;
  color: var(--gray);
  background: color-mix(in srgb, var(--light) 88%, var(--lightgray) 12%);
}

.faceted-search__query {
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  padding: .8rem 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--dark);
  font: 500 1rem/1.3 var(--bodyFont);
}

.faceted-search__filters {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
  align-items: end;
  gap: .7rem;
  padding: 0 1.15rem 1rem;
  border-bottom: 1px solid var(--lightgray);
}

.faceted-search__filters label span {
  display: block;
  margin: 0 0 .28rem;
  color: var(--gray);
  font-size: .72rem;
  font-weight: 700;
  letter-spacing: .05em;
  text-transform: uppercase;
}

.faceted-search__filters select,
.faceted-search__clear {
  box-sizing: border-box;
  width: 100%;
  height: 2.35rem;
  border: 1px solid var(--lightgray);
  border-radius: .35rem;
  background: var(--light);
  color: var(--dark);
  font: inherit;
}

.faceted-search__filters select {
  padding: 0 .6rem;
}

.faceted-search__clear {
  width: auto;
  padding: 0 .85rem;
  color: var(--secondary);
  cursor: pointer;
}

.faceted-search__status {
  padding: .65rem 1.15rem;
  color: var(--gray);
  font-size: .84rem;
  border-bottom: 1px solid var(--lightgray);
}

.faceted-search__results {
  max-height: min(58vh, 37rem);
  overflow-y: auto;
  overscroll-behavior: contain;
}

.faceted-search__result {
  display: block;
  padding: .85rem 1.15rem;
  border-bottom: 1px solid var(--lightgray);
  background: transparent;
  color: var(--dark);
  text-decoration: none;
}

.faceted-search__result:last-child {
  border-bottom: 0;
}

.faceted-search__result:hover,
.faceted-search__result:focus,
.faceted-search__result.is-active {
  background: color-mix(in srgb, var(--light) 78%, var(--lightgray) 22%);
  outline: none;
}

.faceted-search__result-title {
  margin: 0;
  color: var(--secondary);
  font: 700 1rem/1.3 var(--headerFont);
}

.faceted-search__result-meta {
  display: flex;
  flex-wrap: wrap;
  gap: .35rem;
  margin: .35rem 0 0;
}

.faceted-search__badge {
  padding: .13rem .42rem;
  border: 1px solid color-mix(in srgb, var(--secondary) 34%, var(--lightgray));
  border-radius: 999px;
  color: var(--darkgray);
  font-size: .7rem;
  line-height: 1.25;
}

.faceted-search__snippet {
  margin: .42rem 0 0;
  color: var(--gray);
  font-size: .86rem;
  line-height: 1.4;
}

.faceted-search__empty {
  margin: 0;
  padding: 2.5rem 1.15rem;
  color: var(--gray);
  text-align: center;
}

body.faceted-search-open {
  overflow: hidden;
}

.visually-hidden {
  position: absolute !important;
  width: 1px !important;
  height: 1px !important;
  padding: 0 !important;
  margin: -1px !important;
  overflow: hidden !important;
  clip: rect(0, 0, 0, 0) !important;
  white-space: nowrap !important;
  border: 0 !important;
}

@media (max-width: 600px) {
  .faceted-search__trigger kbd {
    display: none;
  }

  .faceted-search__overlay {
    padding: .5rem;
  }

  .faceted-search__dialog {
    min-height: calc(100dvh - 1rem);
  }

  .faceted-search__filters {
    grid-template-columns: 1fr 1fr;
  }

  .faceted-search__clear {
    grid-column: 1 / -1;
    width: 100%;
  }

  .faceted-search__results {
    max-height: calc(100dvh - 18.5rem);
  }
}

@media (prefers-reduced-motion: reduce) {
  .faceted-search__overlay {
    backdrop-filter: none;
  }
}
`

  FacetedSearch.afterDOMLoaded = searchScript
  return FacetedSearch
}) satisfies QuartzComponentConstructor
