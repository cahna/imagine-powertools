/**
 * Storage operations via message passing to background script.
 * Content scripts cannot access IndexedDB directly, so we proxy through the background.
 */

import { logger } from "../shared/logger";
import {
  StorageMessageType,
  ExtendStorageMessageType,
} from "../shared/messageTypes";

export interface HistoryEntry {
  text: string;
  timestamp: number;
  submitCount?: number;
}

/** Saves a prompt to history via background script. */
export async function saveToPostHistory(
  postId: string,
  text: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { type: StorageMessageType.SAVE_TO_POST_HISTORY, postId, text },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else if (response?.success) {
          resolve();
        } else {
          reject(new Error(response?.error || "Unknown error"));
        }
      },
    );
  });
}

/** Saves an extend prompt to history via background script. */
export async function saveToExtendHistory(
  videoId: string,
  text: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { type: ExtendStorageMessageType.SAVE_TO_EXTEND_HISTORY, videoId, text },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else if (response?.success) {
          logger.log(
            "[extend] Saved to extend history:",
            videoId,
            text.substring(0, 30),
          );
          resolve();
        } else {
          reject(new Error(response?.error || "Unknown error"));
        }
      },
    );
  });
}

/** Retrieves post history from background script. */
export async function getPostHistory(
  postId: string,
): Promise<{ success: boolean; entries?: HistoryEntry[] }> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { type: StorageMessageType.GET_POST_HISTORY, postId },
      (response) => resolve(response || { success: false }),
    );
  });
}

/** Retrieves extend history from background script. */
export async function getExtendHistory(
  videoId: string,
): Promise<{ success: boolean; entries?: HistoryEntry[] }> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { type: ExtendStorageMessageType.GET_EXTEND_HISTORY, videoId },
      (response) => resolve(response || { success: false }),
    );
  });
}
