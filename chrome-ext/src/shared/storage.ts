// Shared storage types and utilities for Grok Imagine Power Tools

export interface HistoryEntry {
  text: string;
  timestamp: number;
  submitCount?: number;
}

export interface PostHistory {
  [postId: string]: HistoryEntry[];
}

export const STORAGE_KEY = "postHistory";

export async function getAllHistory(): Promise<PostHistory> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return result[STORAGE_KEY] || {};
}

export async function getPostHistory(postId: string): Promise<HistoryEntry[]> {
  const history = await getAllHistory();
  return history[postId] || [];
}

export async function saveToPostHistory(postId: string, text: string): Promise<void> {
  const history = await getAllHistory();

  if (!history[postId]) {
    history[postId] = [];
  }

  // Check if this exact text already exists
  const existingIndex = history[postId].findIndex((entry) => entry.text === text);

  if (existingIndex !== -1) {
    // Increment counter and update timestamp
    const existing = history[postId][existingIndex];
    existing.submitCount = (existing.submitCount || 1) + 1;
    existing.timestamp = Date.now();
  } else {
    // Add new entry with submitCount: 1
    history[postId].push({
      text,
      timestamp: Date.now(),
      submitCount: 1,
    });
  }

  await chrome.storage.local.set({ [STORAGE_KEY]: history });
}

export async function deleteFromPostHistory(postId: string, timestamp: number): Promise<void> {
  const history = await getAllHistory();

  if (history[postId]) {
    history[postId] = history[postId].filter((entry) => entry.timestamp !== timestamp);
    await chrome.storage.local.set({ [STORAGE_KEY]: history });
  }
}

export function validatePostHistory(data: unknown): data is PostHistory {
  if (typeof data !== "object" || data === null) {
    return false;
  }

  for (const postId in data as Record<string, unknown>) {
    const entries = (data as Record<string, unknown>)[postId];
    if (!Array.isArray(entries)) {
      return false;
    }
    for (const entry of entries) {
      if (typeof entry !== "object" || entry === null) {
        return false;
      }
      if (typeof (entry as HistoryEntry).text !== "string") {
        return false;
      }
      if (typeof (entry as HistoryEntry).timestamp !== "number") {
        return false;
      }
      // submitCount is optional, but if present must be a number
      const submitCount = (entry as HistoryEntry).submitCount;
      if (submitCount !== undefined && typeof submitCount !== "number") {
        return false;
      }
    }
  }
  return true;
}

export function mergeHistories(
  existing: PostHistory,
  incoming: PostHistory
): {
  merged: PostHistory;
  addedCount: number;
  skippedCount: number;
} {
  const merged = { ...existing };
  let addedCount = 0;
  let skippedCount = 0;

  for (const postId in incoming) {
    if (!merged[postId]) {
      merged[postId] = incoming[postId];
      addedCount++;
    } else {
      skippedCount++;
    }
  }

  return { merged, addedCount, skippedCount };
}
