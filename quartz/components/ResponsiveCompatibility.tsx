import { QuartzComponent, QuartzComponentConstructor } from "./types"

/**
 * Quartz's core layout uses the site's 1200px compact breakpoint, while a few
 * stock components still hard-code 800px for their mobile presentation.
 * Bridge that 801-1199px gap so landscape phones and compact tablets behave
 * like the rest of the single-column layout without patching installed plugins.
 */
export default (() => {
  const ResponsiveCompatibility: QuartzComponent = () => null

  ResponsiveCompatibility.css = `
@media (min-width: 801px) and (max-width: 1199px) {
  /* The printed-folio surround uses negative side insets that do not belong
     once the page shell has collapsed to its compact single-column layout. */
  .page > #quartz-body .center::before {
    display: none;
  }

  /* Explorer: mirror Quartz's <=800px drawer behavior throughout the site's
     complete compact range. The Explorer script keys off button visibility,
     so these CSS rules also make its existing JS choose the mobile state. */
  .page > #quartz-body > :not(.sidebar.left:has(.explorer)) {
    transition: transform 0.3s ease-in-out;
  }

  .page > #quartz-body.lock-scroll > :not(.sidebar.left:has(.explorer)) {
    transform: translate(100dvw);
  }

  .page > #quartz-body .sidebar.left:has(.explorer) {
    box-sizing: border-box;
    position: sticky;
    margin: 0;
    padding: 1rem 0;
    background-color: var(--light);
  }

  .page > #quartz-body .hide-until-loaded ~ .explorer-content {
    display: none;
  }

  .page > #quartz-body .explorer {
    order: -1;
    align-self: flex-start;
    flex-shrink: 0;
    height: initial;
    margin-top: auto;
    margin-bottom: auto;
    overflow: hidden;
  }

  .page > #quartz-body .explorer button.mobile-explorer {
    display: flex;
  }

  .page > #quartz-body .explorer button.desktop-explorer {
    display: none;
  }

  .page > #quartz-body .explorer.collapsed,
  .page > #quartz-body .explorer:not(.collapsed) {
    flex: 0 0 34px;
  }

  .page > #quartz-body .explorer.collapsed > .explorer-content {
    visibility: hidden;
    transform: translate(-100vw);
  }

  .page > #quartz-body .explorer:not(.collapsed) > .explorer-content {
    visibility: visible;
    transform: translate(0);
  }

  .page > #quartz-body .explorer .explorer-content {
    box-sizing: border-box;
    position: absolute;
    z-index: 100;
    top: 0;
    left: 0;
    width: 100vw;
    max-width: 100vw;
    height: 100dvh;
    max-height: 100dvh;
    margin-top: 0;
    padding: 4rem 0 2rem;
    overflow: hidden;
    visibility: hidden;
    background-color: var(--light);
    transform: translate(-100vw);
    transition: transform 0.2s, visibility 0.2s;
  }

  .page > #quartz-body .explorer .mobile-explorer {
    z-index: 101;
    margin: 0;
    padding: 5px;
  }

  .page > #quartz-body .explorer .mobile-explorer.hide-until-loaded {
    display: none;
  }

  .page > #quartz-body .explorer .mobile-explorer .lucide-menu {
    stroke: var(--darkgray);
  }

  .mobile-no-scroll .explorer-content > .explorer-ul {
    overscroll-behavior: contain;
  }

  /* Search: use the compact one-column result list instead of squeezing a
     results pane and preview pane side by side on landscape-phone widths. */
  .page > #quartz-body .search {
    flex-grow: 0.3;
  }

  .search > .search-container > .search-space > .search-layout {
    flex-direction: column;
  }

  .search > .search-container > .search-space > .search-layout > .preview-container {
    display: none !important;
  }

  .search > .search-container > .search-space > .search-layout[data-preview] > .results-container {
    flex: 0 0 100%;
    width: 100%;
    height: auto;
    max-height: 60vh;
    border-right: 0;
    border-radius: 5px;
  }

  .search > .search-container > .search-space > .search-layout[data-preview] .result-card > p.card-description {
    display: block;
  }
}
`

  return ResponsiveCompatibility
}) satisfies QuartzComponentConstructor
