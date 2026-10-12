import { motionReduced } from "./motion";

export function portraitReaderLayout() {
  return matchMedia("(max-width:700px), (max-width:1280px) and (orientation:portrait)").matches;
}

// Freeze only the outgoing presentation, never application state or routing.
// It stays hidden while fetching and exits when the next page is committed.
export function captureRouteFrame(direction: "left" | "right") {
  if (motionReduced()) return null;
  const main = document.querySelector<HTMLElement>("main:not([data-route-copy])");
  if (!main) return null;
  const rect = main.getBoundingClientRect();
  const frame = document.createElement("div");
  frame.className = `nur-route-snapshot exit-${direction}`;
  frame.setAttribute("aria-hidden", "true");
  frame.inert = true;
  frame.hidden = true;
  const copy = main.cloneNode(true) as HTMLElement;
  copy.dataset.routeCopy = "true";
  copy.querySelectorAll("[id]").forEach(node => node.removeAttribute("id"));
  copy.removeAttribute("id");
  copy.querySelectorAll("script,audio,video,.modal-layer,.onboarding-layer").forEach(node => node.remove());
  Object.assign(copy.style, { position: "absolute", margin: "0", left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, minHeight: `${rect.height}px` });
  frame.append(copy);
  document.body.append(frame);
  return frame;
}

export function playRouteFrame(frame: HTMLElement | null) {
  if (!frame) return;
  if (motionReduced()) { frame.remove(); return; }
  frame.hidden = false;
  frame.classList.add("playing");
  frame.addEventListener("animationend", event => { if (event.target === frame) frame.remove(); }, { once: true });
  setTimeout(() => frame.remove(), 350);
}
