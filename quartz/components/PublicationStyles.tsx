import { QuartzComponent, QuartzComponentConstructor } from "./types"
import lanternLedgerStyles from "../styles/publications/lantern-and-ledger.scss"
import beaconBulletinStyles from "../styles/publications/beacon-and-bulletin.scss"
import greeneGamingStyles from "../styles/publications/greene-gaming.scss"

export default (() => {
  const PublicationStyles: QuartzComponent = () => null
  PublicationStyles.css = `${lanternLedgerStyles}\n${beaconBulletinStyles}\n${greeneGamingStyles}`
  return PublicationStyles
}) satisfies QuartzComponentConstructor
