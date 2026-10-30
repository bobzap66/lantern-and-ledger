import { QuartzComponent, QuartzComponentConstructor } from "./types"
import lanternLedgerStyles from "../styles/publications/lantern-and-ledger.scss"
import beaconBulletinStyles from "../styles/publications/beacon-and-bulletin.scss"
import beaconBulletinLightStyles from "../styles/publications/beacon-and-bulletin-light.scss"
import greeneGamingStyles from "../styles/publications/greene-gaming.scss"
import greeneGamingCardArtStyles from "../styles/publications/greene-gaming-card-art.scss"

export default (() => {
  const PublicationStyles: QuartzComponent = () => null
  PublicationStyles.css = `${lanternLedgerStyles}\n${beaconBulletinStyles}\n${beaconBulletinLightStyles}\n${greeneGamingStyles}\n${greeneGamingCardArtStyles}\n.site-publication-header--greene-gaming .site-publication-switcher { display: none; }\n@media (min-width: 801px) {\n  .site-publication-header--lantern-and-ledger .site-publication-masthead img,\n  .site-publication-header--beacon-and-bulletin .site-publication-masthead img {\n    width: min(100%, 56rem);\n  }\n}`
  return PublicationStyles
}) satisfies QuartzComponentConstructor
