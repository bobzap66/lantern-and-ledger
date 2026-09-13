import { QuartzTransformerPlugin } from "../types"

export const CharacterCardLinks: QuartzTransformerPlugin = () => ({
  name: "CharacterCardLinks",
  markdownPlugins() {
    return []
  },
  externalResources() {
    return {
      css: [{
        inline: true,
        content: `
.isr-character-card > a {
  position: relative;
  z-index: 1;
}

.isr-character-card-image {
  pointer-events: none;
}
`,
      }],
    }
  },
})
