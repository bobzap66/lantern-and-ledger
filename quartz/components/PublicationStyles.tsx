import { QuartzComponent, QuartzComponentConstructor } from "./types"
import lanternLedgerStyles from "../styles/publications/lantern-and-ledger.scss"
import beaconBulletinStyles from "../styles/publications/beacon-and-bulletin.scss"

export default (() => {
  const PublicationStyles: QuartzComponent = () => null
  PublicationStyles.css = `${lanternLedgerStyles}\n${beaconBulletinStyles}`
  return PublicationStyles
}) satisfies QuartzComponentConstructor
