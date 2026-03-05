/**
 * Theme management for the extension popup and data pages.
 * Supports light, dark, and system preference modes.
 */

export type ThemePreference = "light" | "dark" | "system";

const THEME_KEY = "themePreference";

/** Retrieves the stored theme preference, defaulting to 'system'. */
export async function getThemePreference(): Promise<ThemePreference> {
  const result = await chrome.storage.local.get(THEME_KEY);
  return result[THEME_KEY] || "system";
}

/** Saves the theme preference and applies it immediately. */
export async function setThemePreference(pref: ThemePreference): Promise<void> {
  await chrome.storage.local.set({ [THEME_KEY]: pref });
  applyTheme(pref);
}

/** Applies the theme to the document based on preference. */
export function applyTheme(pref: ThemePreference): void {
  const isDark =
    pref === "dark" ||
    (pref === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = isDark ? "dark" : "light";
}

/** Initializes theme on page load and sets up listeners for changes. */
export async function initTheme(): Promise<void> {
  const pref = await getThemePreference();
  applyTheme(pref);

  // Listen for system preference changes
  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", async () => {
      const currentPref = await getThemePreference();
      if (currentPref === "system") {
        applyTheme("system");
      }
    });

  // Listen for theme changes from other pages (e.g., popup -> data page)
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes[THEME_KEY]) {
      applyTheme(changes[THEME_KEY].newValue as ThemePreference);
    }
  });
}
