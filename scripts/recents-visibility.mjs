export function isVisibleInRecents(frontmatter, nonRecentTypes = new Set()) {
  const noteType = String(frontmatter.type ?? "")
    .trim()
    .toLowerCase()
  return !(
    frontmatter.draft === true ||
    frontmatter.publish === false ||
    frontmatter.unlisted === true ||
    frontmatter.hidden === true ||
    String(frontmatter.visibility ?? "")
      .trim()
      .toLowerCase() === "hidden" ||
    nonRecentTypes.has(noteType)
  )
}
