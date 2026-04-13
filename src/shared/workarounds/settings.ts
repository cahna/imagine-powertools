/**
 * Storage helpers for workaround settings.
 * Persists enabled workarounds to chrome.storage.local.
 */

import { type WorkaroundSettings, DEFAULT_WORKAROUND_SETTINGS } from "./types";

const STORAGE_KEY = "workaroundSettings";

/** Retrieves workaround settings from chrome.storage.local. */
export async function getWorkaroundSettings(): Promise<WorkaroundSettings> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return result[STORAGE_KEY] ?? DEFAULT_WORKAROUND_SETTINGS;
}

/** Saves workaround settings to chrome.storage.local. */
export async function saveWorkaroundSettings(
  settings: WorkaroundSettings,
): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: settings });
}

/** Enables a workaround by ID. */
export async function enableWorkaround(workaroundId: string): Promise<void> {
  const settings = await getWorkaroundSettings();
  if (!settings.enabledWorkarounds.includes(workaroundId)) {
    settings.enabledWorkarounds.push(workaroundId);
    await saveWorkaroundSettings(settings);
  }
}

/** Disables a workaround by ID. */
export async function disableWorkaround(workaroundId: string): Promise<void> {
  const settings = await getWorkaroundSettings();
  settings.enabledWorkarounds = settings.enabledWorkarounds.filter(
    (id) => id !== workaroundId,
  );
  await saveWorkaroundSettings(settings);
}

/** Toggles a workaround by ID. */
export async function toggleWorkaround(
  workaroundId: string,
  enabled: boolean,
): Promise<void> {
  if (enabled) {
    await enableWorkaround(workaroundId);
  } else {
    await disableWorkaround(workaroundId);
  }
}

/** Checks if a workaround is enabled. */
export async function isWorkaroundEnabled(
  workaroundId: string,
): Promise<boolean> {
  const settings = await getWorkaroundSettings();
  return settings.enabledWorkarounds.includes(workaroundId);
}
