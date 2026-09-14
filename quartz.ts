import { loadQuartzConfig, loadQuartzLayout } from "./quartz/plugins/loader/config-loader"
import { CampaignDossiers } from "./quartz/plugins/transformers/campaignDossiers"
import { CharacterCards } from "./quartz/plugins/transformers/characterCards"
import { NpcCards } from "./quartz/plugins/transformers/npcCards"
import { CharacterCardLinks } from "./quartz/plugins/transformers/characterCardLinks"
import { ArticleAuthorCards } from "./quartz/plugins/transformers/articleAuthorCards"
import { FolderGallery } from "./quartz/plugins/transformers/folderGallery"
import { ImageMetadataGallery } from "./quartz/plugins/transformers/imageMetadataGallery"
import { ImageMetadataCarousel } from "./quartz/plugins/transformers/imageMetadataCarousel"
import { VignetteIndexes } from "./quartz/plugins/transformers/vignetteIndexes"
import CharacterVignettes from "./quartz/components/CharacterVignettes"
import VignetteNavigation from "./quartz/components/VignetteNavigation"
import ExplorerCurator from "./quartz/components/ExplorerCurator"
import { componentRegistry } from "./quartz/components/registry"

const characterVignettes = CharacterVignettes()
const vignetteNavigation = VignetteNavigation()
const explorerCurator = ExplorerCurator()
const localLayout = {
  beforeBody: [characterVignettes],
  afterBody: [vignetteNavigation, explorerCurator],
}

componentRegistry.register("character-vignettes", characterVignettes, "local")
componentRegistry.register("vignette-navigation", vignetteNavigation, "local")
componentRegistry.register("explorer-curator", explorerCurator, "local")

const config = await loadQuartzConfig(undefined, localLayout)
config.plugins.transformers.push(FolderGallery())
config.plugins.transformers.push(ImageMetadataGallery())
config.plugins.transformers.push(ImageMetadataCarousel())
config.plugins.transformers.push(CharacterCards())
config.plugins.transformers.push(NpcCards())
config.plugins.transformers.push(CharacterCardLinks())
config.plugins.transformers.push(ArticleAuthorCards())
config.plugins.transformers.push(VignetteIndexes())
config.plugins.transformers.push(CampaignDossiers())

const layout = await loadQuartzLayout(undefined, localLayout)

export default config
export { layout }
