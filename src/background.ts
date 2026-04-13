// Background service worker for Imagine Power Tools

import {
  HistoryEntry,
  getPostHistory,
  saveToPostHistory,
  getExtendHistory,
  saveToExtendHistory,
  deleteFromExtendHistory,
} from "./shared/storage";
import { logger } from "./shared/logger";
import {
  ContentMessageType,
  StorageMessageType,
  ExtendStorageMessageType,
  PromptMessageType,
  AutosubmitMessageType,
  JobsMessageType,
} from "./shared/messageTypes";

type Mode = "favorites" | "results" | "post" | "post-extend" | "none";

// Autosubmit state type (matches content.ts)
type AutosubmitState =
  | { status: "idle" }
  | {
      status: "running";
      attempt: number;
      maxRetries: number;
      phase: "submitting" | "generating" | "waiting";
    }
  | { status: "success"; attempt: number }
  | {
      status: "stopped";
      reason:
        | "cancelled"
        | "rate_limited"
        | "max_retries"
        | "timeout"
        | "navigated";
      attempt: number;
    };

// Job info for the Jobs tab
interface JobInfo {
  tabId: number;
  tabTitle: string;
  sourceImageId: string;
  promptText: string;
  maxRetries: number;
  state: AutosubmitState;
  startedAt: number;
  updatedAt: number;
  jobType: "video" | "extend";
}

// Video option types
// Note: "fun" mood option has been removed from Grok Imagine
type VideoOption = "6s" | "10s" | "480p" | "720p" | "spicy" | "normal";

// Mapping from command name to video option
// Note: "fun" mood option has been removed from Grok Imagine
const VIDEO_COMMANDS: Record<string, VideoOption> = {
  "video-6s": "6s",
  "video-10s": "10s",
  "video-480p": "480p",
  "video-720p": "720p",
  "video-spicy": "spicy",
  "video-normal": "normal",
};

// Store mode per tab
const tabModes = new Map<number, Mode>();

// =============================================================================
// Job Registry for tracking autosubmit jobs across tabs
// =============================================================================

const activeJobs = new Map<number, JobInfo>();

// =============================================================================
// LRU Cache for hot-path storage reads
// =============================================================================

const CACHE_MAX_SIZE = 100;

interface CacheEntry {
  entries: HistoryEntry[];
  accessTime: number;
}

const historyCache = new Map<string, CacheEntry>();

/** Retrieves cached history entries for a post ID, updating access time for LRU. */
function cacheGet(postId: string): HistoryEntry[] | null {
  const entry = historyCache.get(postId);
  if (entry) {
    entry.accessTime = Date.now();
    return entry.entries;
  }
  return null;
}

/** Stores history entries in cache, evicting the oldest entry if cache is full. */
function cacheSet(postId: string, entries: HistoryEntry[]): void {
  // Evict oldest entries if cache is full
  if (historyCache.size >= CACHE_MAX_SIZE) {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;
    for (const [key, entry] of historyCache) {
      if (entry.accessTime < oldestTime) {
        oldestTime = entry.accessTime;
        oldestKey = key;
      }
    }
    if (oldestKey) {
      historyCache.delete(oldestKey);
    }
  }

  historyCache.set(postId, {
    entries,
    accessTime: Date.now(),
  });
}

/** Removes a post ID from the cache, typically after a write operation. */
function cacheInvalidate(postId: string): void {
  historyCache.delete(postId);
}

// =============================================================================
// LRU Cache for extend history reads
// =============================================================================

const extendHistoryCache = new Map<string, CacheEntry>();

/** Retrieves cached extend history entries for a video ID, updating access time for LRU. */
function extendCacheGet(videoId: string): HistoryEntry[] | null {
  const entry = extendHistoryCache.get(videoId);
  if (entry) {
    entry.accessTime = Date.now();
    return entry.entries;
  }
  return null;
}

/** Stores extend history entries in cache, evicting the oldest entry if cache is full. */
function extendCacheSet(videoId: string, entries: HistoryEntry[]): void {
  // Evict oldest entries if cache is full
  if (extendHistoryCache.size >= CACHE_MAX_SIZE) {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;
    for (const [key, entry] of extendHistoryCache) {
      if (entry.accessTime < oldestTime) {
        oldestTime = entry.accessTime;
        oldestKey = key;
      }
    }
    if (oldestKey) {
      extendHistoryCache.delete(oldestKey);
    }
  }

  extendHistoryCache.set(videoId, {
    entries,
    accessTime: Date.now(),
  });
}

/** Removes a video ID from the extend cache, typically after a write operation. */
function extendCacheInvalidate(videoId: string): void {
  extendHistoryCache.delete(videoId);
}

// =============================================================================
// Cached storage operations
// =============================================================================

/** Retrieves post history with LRU caching for fast repeated access. */
async function getCachedPostHistory(postId: string): Promise<HistoryEntry[]> {
  const cached = cacheGet(postId);
  if (cached !== null) {
    return cached;
  }

  const entries = await getPostHistory(postId);
  cacheSet(postId, entries);
  return entries;
}

/** Saves a prompt to history and invalidates the cache entry for consistency. */
async function cachedSaveToPostHistory(
  postId: string,
  text: string,
): Promise<void> {
  await saveToPostHistory(postId, text);
  cacheInvalidate(postId);
}

/** Retrieves the most recent history entry for a post, sorted by timestamp. */
async function getMostRecentHistoryEntry(
  postId: string,
): Promise<HistoryEntry | null> {
  try {
    const entries = await getCachedPostHistory(postId);

    if (!entries || entries.length === 0) {
      return null;
    }

    // Sort by timestamp descending and return the most recent
    const sorted = [...entries].sort((a, b) => b.timestamp - a.timestamp);
    return sorted[0];
  } catch (error) {
    logger.error("Failed to get history:", error);
    return null;
  }
}

// =============================================================================
// Cached extend history operations
// =============================================================================

/** Retrieves extend history with LRU caching for fast repeated access. */
async function getCachedExtendHistory(
  videoId: string,
): Promise<HistoryEntry[]> {
  const cached = extendCacheGet(videoId);
  if (cached !== null) {
    return cached;
  }

  const entries = await getExtendHistory(videoId);
  extendCacheSet(videoId, entries);
  return entries;
}

/** Saves an extend prompt to history and invalidates the cache entry for consistency. */
async function cachedSaveToExtendHistory(
  videoId: string,
  text: string,
): Promise<void> {
  await saveToExtendHistory(videoId, text);
  extendCacheInvalidate(videoId);
}

/** Deletes an extend prompt from history and invalidates the cache entry. */
async function cachedDeleteFromExtendHistory(
  videoId: string,
  timestamp: number,
): Promise<void> {
  await deleteFromExtendHistory(videoId, timestamp);
  extendCacheInvalidate(videoId);
}

/** Retrieves the most recent extend history entry for a video, sorted by timestamp. */
async function getMostRecentExtendHistoryEntry(
  videoId: string,
): Promise<HistoryEntry | null> {
  try {
    const entries = await getCachedExtendHistory(videoId);

    if (!entries || entries.length === 0) {
      return null;
    }

    // Sort by timestamp descending and return the most recent
    const sorted = [...entries].sort((a, b) => b.timestamp - a.timestamp);
    return sorted[0];
  } catch (error) {
    logger.error("[extend] Failed to get extend history:", error);
    return null;
  }
}

// =============================================================================
// Extension lifecycle
// =============================================================================

// Listen for extension installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    logger.log("Extension installed");
  } else if (details.reason === "update") {
    logger.log("Extension updated");
  }
});

// =============================================================================
// Message handling
// =============================================================================

// Listen for messages from content scripts or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case ContentMessageType.MODE_CHANGE: {
      const tabId = sender.tab?.id;
      if (tabId !== undefined) {
        const previousMode = tabModes.get(tabId);
        tabModes.set(tabId, message.mode);
        logger.log(
          `Tab ${tabId} mode: ${previousMode ?? "unknown"} -> ${message.mode}`,
        );
      }
      sendResponse({ status: "ok" });
      break;
    }

    case ContentMessageType.GET_MODE: {
      const mode = tabModes.get(message.tabId) ?? "none";
      sendResponse({ mode });
      break;
    }

    case ContentMessageType.OPEN_TAB: {
      chrome.tabs.create({ url: message.url, active: false });
      sendResponse({ status: "ok" });
      break;
    }

    // Storage operations for content script (IndexedDB not accessible from content scripts)
    case StorageMessageType.GET_POST_HISTORY: {
      (async () => {
        try {
          const entries = await getCachedPostHistory(message.postId);
          sendResponse({ success: true, entries });
        } catch (error) {
          logger.error("storage:getPostHistory failed:", error);
          sendResponse({ success: false, error: String(error) });
        }
      })();
      return true; // Keep channel open for async response
    }

    case StorageMessageType.SAVE_TO_POST_HISTORY: {
      (async () => {
        try {
          await cachedSaveToPostHistory(message.postId, message.text);
          sendResponse({ success: true });
        } catch (error) {
          logger.error("storage:saveToPostHistory failed:", error);
          sendResponse({ success: false, error: String(error) });
        }
      })();
      return true; // Keep channel open for async response
    }

    // Extend history storage operations
    case ExtendStorageMessageType.GET_EXTEND_HISTORY: {
      (async () => {
        try {
          const entries = await getCachedExtendHistory(message.videoId);
          logger.log(
            "[extend] getExtendHistory:",
            message.videoId,
            entries.length,
            "entries",
          );
          sendResponse({ success: true, entries });
        } catch (error) {
          logger.error("[extend] storage:getExtendHistory failed:", error);
          sendResponse({ success: false, error: String(error) });
        }
      })();
      return true;
    }

    case ExtendStorageMessageType.SAVE_TO_EXTEND_HISTORY: {
      (async () => {
        try {
          await cachedSaveToExtendHistory(message.videoId, message.text);
          logger.log(
            "[extend] saveToExtendHistory:",
            message.videoId,
            message.text.substring(0, 30),
          );
          sendResponse({ success: true });
        } catch (error) {
          logger.error("[extend] storage:saveToExtendHistory failed:", error);
          sendResponse({ success: false, error: String(error) });
        }
      })();
      return true;
    }

    case ExtendStorageMessageType.DELETE_FROM_EXTEND_HISTORY: {
      (async () => {
        try {
          await cachedDeleteFromExtendHistory(
            message.videoId,
            message.timestamp,
          );
          logger.log(
            "[extend] deleteFromExtendHistory:",
            message.videoId,
            message.timestamp,
          );
          sendResponse({ success: true });
        } catch (error) {
          logger.error(
            "[extend] storage:deleteFromExtendHistory failed:",
            error,
          );
          sendResponse({ success: false, error: String(error) });
        }
      })();
      return true;
    }

    // Job registry operations for the Jobs tab
    case JobsMessageType.REGISTER: {
      const tabId = sender.tab?.id;
      if (tabId !== undefined) {
        // Prevent concurrent autosubmits on the same tab
        const existingJob = activeJobs.get(tabId);
        if (existingJob && existingJob.state.status === "running") {
          logger.log(
            `[jobs] Autosubmit already running on tab ${tabId}, ignoring`,
          );
          sendResponse({ success: false, error: "Autosubmit already running" });
          break;
        }

        const now = Date.now();
        const jobType = message.jobType || "video";
        const job: JobInfo = {
          tabId,
          tabTitle: message.tabTitle || sender.tab?.title || "Unknown",
          sourceImageId: message.sourceImageId,
          promptText: message.promptText,
          maxRetries: message.maxRetries,
          state: {
            status: "running",
            attempt: 1,
            maxRetries: message.maxRetries,
            phase: "submitting",
          },
          startedAt: now,
          updatedAt: now,
          jobType,
        };
        activeJobs.set(tabId, job);
        logger.log(
          `[jobs] ${jobType} job registered for tab ${tabId}:`,
          job.promptText.substring(0, 50),
        );
      }
      sendResponse({ success: true });
      break;
    }

    case JobsMessageType.GET_ALL: {
      const jobs = Array.from(activeJobs.values());
      sendResponse({ success: true, jobs });
      break;
    }

    case JobsMessageType.REMOVE: {
      const tabId = message.tabId;
      if (tabId !== undefined && activeJobs.has(tabId)) {
        activeJobs.delete(tabId);
        logger.log(`Job removed for tab ${tabId}`);
      }
      sendResponse({ success: true });
      break;
    }

    case AutosubmitMessageType.STATUS: {
      // Update job state when content script reports status
      const tabId = sender.tab?.id;
      if (tabId !== undefined && activeJobs.has(tabId)) {
        const job = activeJobs.get(tabId)!;
        job.state = message.state;
        job.updatedAt = Date.now();
        logger.log(`Job updated for tab ${tabId}:`, message.state.status);
      }
      sendResponse({ success: true });
      break;
    }

    default:
      sendResponse({ status: "unknown message type" });
  }

  return true;
});

// Clean up when tabs are closed
chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabModes.has(tabId)) {
    tabModes.delete(tabId);
    logger.log(`Cleaned up mode for tab ${tabId}`);
  }
  if (activeJobs.has(tabId)) {
    activeJobs.delete(tabId);
    logger.log(`Cleaned up job for tab ${tabId}`);
  }
});

// =============================================================================
// Tab navigation
// =============================================================================

/** Switches to the adjacent tab in the specified direction with wraparound. */
async function handleTabNavigation(direction: "left" | "right"): Promise<void> {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  const activeTab = tabs.find((t) => t.active);

  if (!activeTab || activeTab.index === undefined) {
    return;
  }

  const currentIndex = activeTab.index;
  const tabCount = tabs.length;

  // Calculate new index with wrapping
  const newIndex =
    direction === "left"
      ? (currentIndex - 1 + tabCount) % tabCount
      : (currentIndex + 1) % tabCount;

  const targetTab = tabs.find((t) => t.index === newIndex);
  if (targetTab?.id) {
    await chrome.tabs.update(targetTab.id, { active: true });
  }
}

// =============================================================================
// Keyboard command handling
// =============================================================================

// Handle keyboard commands
chrome.commands.onCommand.addListener(async (command) => {
  // Tab navigation commands
  if (command === "tab-left") {
    await handleTabNavigation("left");
    return;
  }
  if (command === "tab-right") {
    await handleTabNavigation("right");
    return;
  }

  // Video option commands
  if (command in VIDEO_COMMANDS) {
    const option = VIDEO_COMMANDS[command];
    logger.log(`Video option command: ${option}`);

    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (!tab?.id) {
        logger.log("No active tab found");
        return;
      }

      const url = tab.url || "";
      if (!url.startsWith("https://grok.com/imagine")) {
        logger.log("Not on grok.com/imagine page");
        return;
      }

      // Send message to content script to click video option
      try {
        const result = await chrome.tabs.sendMessage(tab.id, {
          type: PromptMessageType.CLICK_VIDEO_OPTION,
          option,
        });

        if (result && !result.ok) {
          logger.error("Click video option failed:", result.error);
        }
      } catch (error) {
        logger.error("Failed to send clickVideoOption:", error);
      }
    } catch (error) {
      logger.error("Video option command error:", error);
    }
    return;
  }

  // Download video command
  if (command === "download-video") {
    logger.log("Download video command triggered");

    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (!tab?.id) {
        logger.log("No active tab found");
        return;
      }

      const url = tab.url || "";
      if (!url.startsWith("https://grok.com/imagine")) {
        logger.log("Not on grok.com/imagine page");
        return;
      }

      // Send message to content script to click download button
      try {
        const result = await chrome.tabs.sendMessage(tab.id, {
          type: PromptMessageType.CLICK_DOWNLOAD,
        });

        if (result && !result.ok) {
          logger.error("Click download failed:", result.error);
        }
      } catch (error) {
        logger.error("Failed to send clickDownload:", error);
      }
    } catch (error) {
      logger.error("Download command error:", error);
    }
    return;
  }

  // Extend video command
  if (command === "extend-video") {
    logger.log("Extend video command triggered");

    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (!tab?.id) {
        logger.log("No active tab found");
        return;
      }

      const url = tab.url || "";
      if (!url.startsWith("https://grok.com/imagine")) {
        logger.log("Not on grok.com/imagine page");
        return;
      }

      // Send message to content script to extend video
      try {
        const result = await chrome.tabs.sendMessage(tab.id, {
          type: PromptMessageType.EXTEND_VIDEO,
        });

        if (result && !result.ok) {
          logger.error("Extend video failed:", result.error);
        }
      } catch (error) {
        logger.error("Failed to send extendVideo:", error);
      }
    } catch (error) {
      logger.error("Extend video command error:", error);
    }
    return;
  }

  // Carousel navigation commands
  if (command === "carousel-prev" || command === "carousel-next") {
    logger.log(
      `Carousel ${command === "carousel-prev" ? "prev" : "next"} command triggered`,
    );

    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (!tab?.id) {
        logger.log("No active tab found");
        return;
      }

      const url = tab.url || "";
      if (!url.startsWith("https://grok.com/imagine")) {
        logger.log("Not on grok.com/imagine page");
        return;
      }

      const messageType =
        command === "carousel-prev"
          ? PromptMessageType.CAROUSEL_PREV
          : PromptMessageType.CAROUSEL_NEXT;

      try {
        const result = await chrome.tabs.sendMessage(tab.id, {
          type: messageType,
        });

        if (result && !result.ok) {
          logger.error("Carousel navigation failed:", result.error);
        }
      } catch (error) {
        logger.error("Failed to send carousel navigation:", error);
      }
    } catch (error) {
      logger.error("Carousel command error:", error);
    }
    return;
  }

  // Extend focus command - enter extend mode and focus prompt input
  if (command === "extend-focus") {
    logger.log("[extend] Extend focus command triggered");

    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (!tab?.id) {
        logger.log("[extend] No active tab found");
        return;
      }

      const url = tab.url || "";
      if (!url.startsWith("https://grok.com/imagine")) {
        logger.log("[extend] Not on grok.com/imagine page");
        return;
      }

      try {
        const result = await chrome.tabs.sendMessage(tab.id, {
          type: PromptMessageType.EXTEND_FOCUS,
        });

        if (result && !result.ok) {
          logger.error("[extend] Extend focus failed:", result.error);
        }
      } catch (error) {
        logger.error("[extend] Failed to send extendFocus:", error);
      }
    } catch (error) {
      logger.error("[extend] Extend focus command error:", error);
    }
    return;
  }

  if (
    command !== "resubmit-last" &&
    command !== "submit-clipboard" &&
    command !== "autosubmit"
  ) {
    return;
  }

  logger.log(`${command} command triggered`);

  try {
    // Get the active tab
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (!tab?.id) {
      logger.log("No active tab found");
      return;
    }

    // Check if we're on a grok.com/imagine page
    const url = tab.url || "";
    if (!url.startsWith("https://grok.com/imagine")) {
      logger.log("Not on grok.com/imagine page");
      return;
    }

    // Query the content script for mode and post ID
    let modeResponse;
    try {
      modeResponse = await chrome.tabs.sendMessage(tab.id, {
        type: ContentMessageType.GET_MODE,
      });
    } catch (error) {
      logger.log("Content script not responding:", error);
      return;
    }

    if (!modeResponse) {
      logger.log("No response from content script");
      return;
    }

    const { mode, sourceImageId, postId } = modeResponse;
    const isExtendMode = mode === "post-extend";

    // Allow both "post" and "post-extend" modes
    if (mode !== "post" && mode !== "post-extend") {
      logger.log("Not in post or post-extend mode, current mode:", mode);
      return;
    }

    // For extend mode, we need the video ID (from URL postId)
    // For normal post mode, we need the source image ID
    if (isExtendMode) {
      if (!postId) {
        logger.log("[extend] No post ID (video ID) available");
        return;
      }
    } else {
      if (!sourceImageId) {
        logger.log("No source image ID available");
        return;
      }
    }

    // Use the correct ID based on mode
    const videoId = postId; // Video UUID from URL for extend operations
    const imageId = sourceImageId; // Source image UUID for post operations

    if (command === "resubmit-last") {
      if (isExtendMode) {
        // Extend mode: use extend history
        const entry = await getMostRecentExtendHistoryEntry(videoId);

        if (!entry) {
          logger.log("[extend] No extend history entries for video:", videoId);
          return;
        }

        logger.log(
          "[extend] Re-submitting extend prompt:",
          entry.text.substring(0, 50) + "...",
        );

        // Update extend history and invalidate cache
        await cachedSaveToExtendHistory(videoId, entry.text);

        // Send fillAndSubmitExtend to the content script
        try {
          const result = await chrome.tabs.sendMessage(tab.id, {
            type: PromptMessageType.FILL_AND_SUBMIT_EXTEND,
            text: entry.text,
          });

          if (result && !result.ok) {
            logger.error(
              "[extend] Fill and submit extend failed:",
              result.error,
            );
          }
        } catch (error) {
          logger.error("[extend] Failed to send fillAndSubmitExtend:", error);
        }
      } else {
        // Normal mode: use post history
        const entry = await getMostRecentHistoryEntry(imageId!);

        if (!entry) {
          logger.log("No history entries for source image:", imageId);
          return;
        }

        logger.log("Re-submitting:", entry.text.substring(0, 50) + "...");

        // Update history (increments submitCount) and invalidate cache
        await cachedSaveToPostHistory(imageId!, entry.text);

        // Send fillAndSubmit to the content script
        try {
          const result = await chrome.tabs.sendMessage(tab.id, {
            type: PromptMessageType.FILL_AND_SUBMIT,
            text: entry.text,
          });

          if (result && !result.ok) {
            logger.error("Fill and submit failed:", result.error);
          }
        } catch (error) {
          logger.error("Failed to send fillAndSubmit:", error);
        }
      }
    } else if (command === "submit-clipboard") {
      if (isExtendMode) {
        // Extend mode: use extend clipboard handler
        try {
          const result = await chrome.tabs.sendMessage(tab.id, {
            type: PromptMessageType.SUBMIT_FROM_CLIPBOARD_EXTEND,
            videoId,
          });

          if (result && !result.ok) {
            logger.error(
              "[extend] Submit from clipboard extend failed:",
              result.error,
            );
          }
        } catch (error) {
          logger.error(
            "[extend] Failed to send submitFromClipboardExtend:",
            error,
          );
        }
      } else {
        // Normal mode: use post clipboard handler
        try {
          const result = await chrome.tabs.sendMessage(tab.id, {
            type: PromptMessageType.SUBMIT_FROM_CLIPBOARD,
            sourceImageId: imageId,
          });

          if (result && !result.ok) {
            logger.error("Submit from clipboard failed:", result.error);
          }
        } catch (error) {
          logger.error("Failed to send submitFromClipboard:", error);
        }
      }
    } else if (command === "autosubmit") {
      if (isExtendMode) {
        // Extend mode: use extend history for autosubmit
        const entry = await getMostRecentExtendHistoryEntry(videoId);

        if (!entry) {
          logger.log("[extend] No extend history entries for video:", videoId);
          return;
        }

        logger.log(
          "[extend] Autosubmit starting with extend prompt:",
          entry.text.substring(0, 50) + "...",
        );

        // Send autosubmit:start with extend flag
        try {
          const result = await chrome.tabs.sendMessage(tab.id, {
            type: AutosubmitMessageType.START,
            maxRetries: 10,
            isExtend: true,
          });

          if (result && !result.success) {
            logger.error("[extend] Autosubmit start failed:", result.error);
          }
        } catch (error) {
          logger.error("[extend] Failed to send autosubmit:start:", error);
        }
      } else {
        // Normal mode: use post history
        const entry = await getMostRecentHistoryEntry(imageId!);

        if (!entry) {
          logger.log("No history entries for source image:", imageId);
          return;
        }

        logger.log(
          "Autosubmit starting with:",
          entry.text.substring(0, 50) + "...",
        );

        // Send autosubmit:start to the content script with default retries
        try {
          const result = await chrome.tabs.sendMessage(tab.id, {
            type: AutosubmitMessageType.START,
            maxRetries: 10,
          });

          if (result && !result.success) {
            logger.error("Autosubmit start failed:", result.error);
          }
        } catch (error) {
          logger.error("Failed to send autosubmit:start:", error);
        }
      }
    }
  } catch (error) {
    logger.error("Command handler error:", error);
  }
});

export {};
