/**
 * Settings for request interception feature.
 * Persists enabled state to chrome.storage.local.
 */

const STORAGE_KEY = "interceptEnabled";

/** Retrieves the stored intercept enabled state, defaulting to false. */
export async function getInterceptEnabled(): Promise<boolean> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return result[STORAGE_KEY] ?? false;
}

/** Saves the intercept enabled state. */
export async function setInterceptEnabled(enabled: boolean): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: enabled });
}

/** Listens for changes to the intercept enabled state. Returns unsubscribe function. */
export function onInterceptEnabledChange(
  callback: (enabled: boolean) => void,
): () => void {
  const listener = (
    changes: Record<string, chrome.storage.StorageChange>,
    area: string,
  ) => {
    if (area === "local" && changes[STORAGE_KEY]) {
      callback(changes[STORAGE_KEY].newValue ?? false);
    }
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}
