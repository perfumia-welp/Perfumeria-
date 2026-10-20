/*
 * The startup screen in index.html (#boot): shown only while the site is not
 * ready yet. Called once the catalogue can be shown (or has failed and says
 * so); it fades out from wherever its fade-in had got to, then is removed.
 * Never waits for its own animation.
 */
export function dismissBootScreen() {
  const boot = document.getElementById("boot")
  if (!boot || boot.classList.contains("is-done")) return
  const opacity = getComputedStyle(boot).opacity
  if (opacity === "0") return boot.remove()
  // Hand the animated opacity over to the transition, then fade it out.
  boot.style.opacity = opacity
  boot.style.animation = "none"
  void boot.offsetWidth
  boot.classList.add("is-done")
  boot.style.opacity = ""
  window.setTimeout(() => boot.remove(), 500)
}
