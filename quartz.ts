import { loadQuartzConfig, loadQuartzLayout } from "./quartz/plugins/loader/config-loader"
import { CampaignDossiers } from "./quartz/plugins/transformers/campaignDossiers"
import { CharacterCards } from "./quartz/plugins/transformers/characterCards"
import { NpcCards } from "./quartz/plugins/transformers/npcCards"
import { CharacterCardLinks } from "./quartz/plugins/transformers/characterCardLinks"
import { ArticleAuthorCards } from "./quartz/plugins/transformers/articleAuthorCards"
import { SeriesContributorStrips } from "./quartz/plugins/transformers/seriesContributorStrips"
import { FolderGallery } from "./quartz/plugins/transformers/folderGallery"
import { ImageMetadataGallery } from "./quartz/plugins/transformers/imageMetadataGallery"
import { ImageMetadataCarousel } from "./quartz/plugins/transformers/imageMetadataCarousel"
import { VignetteIndexes } from "./quartz/plugins/transformers/vignetteIndexes"
import CharacterVignettes from "./quartz/components/CharacterVignettes"
import ChapterLanding from "./quartz/components/ChapterLanding"
import HomepageEditorialCards from "./quartz/components/HomepageEditorialCards"
import LegacySeriesNavCleanup from "./quartz/components/LegacySeriesNavCleanup"
import ReadingProgress from "./quartz/components/ReadingProgress"
import Advertisement from "./quartz/components/Advertisement"
import RelatedRecords from "./quartz/components/RelatedRecords"
import ArchiveReadingActions from "./quartz/components/ArchiveReadingActions"
import ResponsiveCompatibility from "./quartz/components/ResponsiveCompatibility"
import SessionNavigation from "./quartz/components/SessionNavigation"
import VignetteNavigation from "./quartz/components/VignetteNavigation"
import { componentRegistry } from "./quartz/components/registry"

const characterVignettes = CharacterVignettes()
const chapterLanding = ChapterLanding()
const homepageEditorialCards = HomepageEditorialCards()
const legacySeriesNavCleanup = LegacySeriesNavCleanup()
const readingProgress = ReadingProgress()
const advertisement = Advertisement()
const relatedRecords = RelatedRecords()
const sessionArchiveActions = ArchiveReadingActions()
const responsiveCompatibility = ResponsiveCompatibility()
const sessionNavigation = SessionNavigation()
const vignetteNavigation = VignetteNavigation()
const localLayout = {
  beforeBody: [
    responsiveCompatibility,
    legacySeriesNavCleanup,
    homepageEditorialCards,
    readingProgress,
    characterVignettes,
    sessionArchiveActions,
  ],
  right: [advertisement],
  afterBody: [chapterLanding, relatedRecords, sessionNavigation, vignetteNavigation],
}

componentRegistry.register("responsive-compatibility", responsiveCompatibility, "local")
componentRegistry.register("legacy-series-nav-cleanup", legacySeriesNavCleanup, "local")
componentRegistry.register("homepage-editorial-cards", homepageEditorialCards, "local")
componentRegistry.register("reading-progress", readingProgress, "local")
componentRegistry.register("character-vignettes", characterVignettes, "local")
componentRegistry.register("chapter-landing", chapterLanding, "local")
componentRegistry.register("advertisement", advertisement, "local")
componentRegistry.register("related-records", relatedRecords, "local")
componentRegistry.register("session-archive-actions", sessionArchiveActions, "local")
componentRegistry.register("session-navigation", sessionNavigation, "local")
componentRegistry.register("vignette-navigation", vignetteNavigation, "local")

const config = await loadQuartzConfig(undefined, localLayout)
config.configuration.ignorePatterns.push(
  "Templates",
  "Image Metadata",
  "Meta",
  "scripts",
  "tmp",
  "assets/**/*.md",
  "Unused Images Report.md",
)
config.plugins.transformers.push(FolderGallery())
config.plugins.transformers.push(ImageMetadataGallery())
config.plugins.transformers.push(ImageMetadataCarousel())
config.plugins.transformers.push(CharacterCards())
config.plugins.transformers.push(NpcCards())
config.plugins.transformers.push(CharacterCardLinks())
config.plugins.transformers.push(ArticleAuthorCards())
config.plugins.transformers.push(SeriesContributorStrips())
config.plugins.transformers.push(VignetteIndexes())
config.plugins.transformers.push(CampaignDossiers())

const layout = await loadQuartzLayout(undefined, localLayout)

export default config
export { layout }
