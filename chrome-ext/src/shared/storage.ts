// Shared storage types and utilities for Imagine Power Tools
// Now backed by IndexedDB for better performance with large datasets

import * as db from "./db";

export interface HistoryEntry {
  text: string;
  timestamp: number;
  submitCount?: number;
}

export interface PostHistory {
  [postId: string]: HistoryEntry[];
}

// Legacy key - kept for reference but no longer used
export const STORAGE_KEY = "postHistory";

/** Retrieves all prompt history across all posts as a single object. */
export async function getAllHistory(): Promise<PostHistory> {
  const records = await db.getAllRecords();
  const history: PostHistory = {};
  for (const [postId, entries] of records) {
    history[postId] = entries;
  }
  return history;
}

/** Retrieves prompt history entries for a specific post ID. */
export async function getPostHistory(postId: string): Promise<HistoryEntry[]> {
  return db.getEntries(postId);
}

/** Saves a prompt to history, incrementing submitCount if the same text exists. */
export async function saveToPostHistory(
  postId: string,
  text: string,
): Promise<void> {
  const entries = await db.getEntries(postId);

  // Check if this exact text already exists
  const existingIndex = entries.findIndex((entry) => entry.text === text);

  if (existingIndex !== -1) {
    // Increment counter and update timestamp
    const existing = entries[existingIndex];
    existing.submitCount = (existing.submitCount || 1) + 1;
    existing.timestamp = Date.now();
  } else {
    // Add new entry with submitCount: 1
    entries.push({
      text,
      timestamp: Date.now(),
      submitCount: 1,
    });
  }

  await db.setEntries(postId, entries);
}

/** Deletes a specific history entry by its timestamp. */
export async function deleteFromPostHistory(
  postId: string,
  timestamp: number,
): Promise<void> {
  const entries = await db.getEntries(postId);
  const filtered = entries.filter((entry) => entry.timestamp !== timestamp);
  await db.setEntries(postId, filtered);
}

/** Type guard that validates imported data conforms to PostHistory structure. */
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

/** Merges incoming history into existing, skipping duplicate post IDs. */
export function mergeHistories(
  existing: PostHistory,
  incoming: PostHistory,
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

/** Bulk imports history records to IndexedDB in a single transaction. */
export async function bulkImportHistory(history: PostHistory): Promise<void> {
  const records = new Map<string, HistoryEntry[]>();
  for (const postId in history) {
    records.set(postId, history[postId]);
  }
  await db.bulkSetRecords(records);
}

/** Deletes all history data from IndexedDB. */
export async function clearAllHistory(): Promise<void> {
  await db.clearAll();
}
