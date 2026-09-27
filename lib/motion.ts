export function motionReduced() {
  return document.documentElement.dataset.motion === "reduced" ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function scrollMotion(): ScrollBehavior {
  return motionReduced() ? "auto" : "smooth";
}
