import { QuartzComponent, QuartzComponentConstructor } from "./types"

export default (() => {
  const PublicationBrandingRuntime: QuartzComponent = () => null

  PublicationBrandingRuntime.css = `
@media (max-width: 800px) {
  .site-publication-header--beacon-and-bulletin .site-publication-masthead__beacon {
    width: min(100%, 24rem);
    height: auto;
    max-height: none;
    margin-inline: auto;
    object-fit: cover;
    aspect-ratio: 8 / 3;
  }
}
`

  return PublicationBrandingRuntime
}) satisfies QuartzComponentConstructor
