import { QuartzTransformerPlugin } from "../types"

const PLAGUESTONE_SLUG = "campaigns/the-fall-of-plaguestone"

/**
 * The Fall of Plaguestone was reconstructed while its public records were
 * deliberately held behind draft flags. The reconstruction workspace remains
 * excluded by Quartz, but the completed public archive should now emit like
 * the site's other archived campaigns without rewriting the preserved source
 * records solely to remove staging flags.
 */
export const PublishPlaguestoneArchive: QuartzTransformerPlugin = () => ({
  name: "PublishPlaguestoneArchive",
  markdownPlugins() {
    return [
      () => (_tree, file) => {
        const data = file.data as {
          slug?: string
          frontmatter?: Record<string, unknown>
        }
        const slug = String(data.slug ?? "").toLowerCase()
        if (slug !== PLAGUESTONE_SLUG && !slug.startsWith(`${PLAGUESTONE_SLUG}/`)) return

        const frontmatter = data.frontmatter
        if (!frontmatter) return

        frontmatter.draft = false
        frontmatter.publish = true
      },
    ]
  },
})
