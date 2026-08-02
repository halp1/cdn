import { browser } from "$app/environment";

/**
 * Reactive media-query trackers.
 *
 * These are read by components that only ever mount after a user interaction
 * (sheets, action menus, panels), so they never take part in hydration. Markup
 * that IS server-rendered should branch on Tailwind breakpoints instead, so the
 * server and client agree on structure.
 */
const track = (query: string) => {
  const mql = browser ? window.matchMedia(query) : null;
  let matches = $state(mql?.matches ?? false);

  mql?.addEventListener("change", (e) => {
    matches = e.matches;
  });

  return {
    get current() {
      return matches;
    }
  };
};

/** Phone-sized viewport. Matches Tailwind's `md` breakpoint. */
export const mobile = track("(max-width: 767px)");

/** Touch-primary input — no hover, no precise cursor, no drag-and-drop. */
export const coarse = track("(pointer: coarse)");
