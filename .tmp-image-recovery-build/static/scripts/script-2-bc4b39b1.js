
const closeCompactExplorer = () => {
  if (!window.matchMedia("(max-width: 1199px)").matches) return
  const explorer = document.querySelector(".explorer")
  if (!explorer) return
  explorer.classList.add("collapsed")
  explorer.setAttribute("aria-expanded", "false")
  explorer.querySelector(".mobile-explorer")?.setAttribute("aria-expanded", "false")
  document.documentElement.classList.remove("mobile-no-scroll")
  document.querySelector("#quartz-body")?.classList.remove("lock-scroll")
}

const installCompactExplorerBehavior = () => {
  window.setTimeout(closeCompactExplorer, 0)
}

document.addEventListener("nav", installCompactExplorerBehavior)
document.addEventListener("click", (event) => {
  const target = event.target
  if (target instanceof Element && target.closest(".explorer-content a")) closeCompactExplorer()
})
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeCompactExplorer()
})
installCompactExplorerBehavior()
