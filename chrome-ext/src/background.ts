// Background service worker for Imagine Power Tools

import {
  HistoryEntry,
  getPostHistory,
  saveToPostHistory,
} from "./shared/storage";
import { logger } from "./shared/logger";

type Mode = "favorites" | "results" | "post" | "none";

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
      reason: "cancelled" | "rate_limited" | "max_retries" | "timeout" | "navigated";
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
}

// Video option types
type VideoOption = "6s" | "10s" | "480p" | "720p" | "spicy" | "fun" | "normal";

// Mapping from command name to video option
const VIDEO_COMMANDS: Record<string, VideoOption> = {
  "video-6s": "6s",
  "video-10s": "10s",
  "video-480p": "480p",
  "video-720p": "720p",
  "video-spicy": "spicy",
  "video-fun": "fun",
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

function cacheGet(postId: string): HistoryEntry[] | null {
  const entry = historyCache.get(postId);
  if (entry) {
    entry.accessTime = Date.now();
    return entry.entries;
  }
  return null;
}

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

function cacheInvalidate(postId: string): void {
  historyCache.delete(postId);
}

// =============================================================================
// Cached storage operations
// =============================================================================

// Get post history with caching
async function getCachedPostHistory(postId: string): Promise<HistoryEntry[]> {
  const cached = cacheGet(postId);
  if (cached !== null) {
    return cached;
  }

  const entries = await getPostHistory(postId);
  cacheSet(postId, entries);
  return entries;
}

// Save to post history and invalidate cache
async function cachedSaveToPostHistory(postId: string, text: string): Promise<void> {
  await saveToPostHistory(postId, text);
  cacheInvalidate(postId);
}

// Get the most recent history entry for a post (cached)
async function getMostRecentHistoryEntry(postId: string): Promise<HistoryEntry | null> {
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
    case "modeChange": {
      const tabId = sender.tab?.id;
      if (tabId !== undefined) {
        const previousMode = tabModes.get(tabId);
        tabModes.set(tabId, message.mode);
        logger.log(
          `Tab ${tabId} mode: ${previousMode ?? "unknown"} -> ${message.mode}`
        );
      }
      sendResponse({ status: "ok" });
      break;
    }

    case "getMode": {
      const mode = tabModes.get(message.tabId) ?? "none";
      sendResponse({ mode });
      break;
    }

    case "openTab": {
      chrome.tabs.create({ url: message.url, active: false });
      sendResponse({ status: "ok" });
      break;
    }

    // Storage operations for content script (IndexedDB not accessible from content scripts)
    case "storage:getPostHistory": {
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

    case "storage:saveToPostHistory": {
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

    // Job registry operations for the Jobs tab
    case "jobs:register": {
      const tabId = sender.tab?.id;
      if (tabId !== undefined) {
        const now = Date.now();
        const job: JobInfo = {
          tabId,
          tabTitle: message.tabTitle || sender.tab?.title || "Unknown",
          sourceImageId: message.sourceImageId,
          promptText: message.promptText,
          maxRetries: message.maxRetries,
          state: { status: "running", attempt: 1, maxRetries: message.maxRetries, phase: "submitting" },
          startedAt: now,
          updatedAt: now,
        };
        activeJobs.set(tabId, job);
        logger.log(`Job registered for tab ${tabId}:`, job.promptText.substring(0, 50));
      }
      sendResponse({ success: true });
      break;
    }

    case "jobs:getAll": {
      const jobs = Array.from(activeJobs.values());
      sendResponse({ success: true, jobs });
      break;
    }

    case "jobs:remove": {
      const tabId = message.tabId;
      if (tabId !== undefined && activeJobs.has(tabId)) {
        activeJobs.delete(tabId);
        logger.log(`Job removed for tab ${tabId}`);
      }
      sendResponse({ success: true });
      break;
    }

    case "autosubmit:status": {
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

// Handle tab navigation commands
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
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

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
          type: "clickVideoOption",
          option,
        });

        if (result && !result.success) {
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
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

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
          type: "clickDownload",
        });

        if (result && !result.success) {
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

  if (command !== "resubmit-last" && command !== "submit-clipboard") {
    return;
  }

  logger.log(`${command} command triggered`);

  try {
    // Get the active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

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
      modeResponse = await chrome.tabs.sendMessage(tab.id, { type: "getMode" });
    } catch (error) {
      logger.log("Content script not responding:", error);
      return;
    }

    if (!modeResponse) {
      logger.log("No response from content script");
      return;
    }

    const { mode, sourceImageId } = modeResponse;

    if (mode !== "post") {
      logger.log("Not in post mode, current mode:", mode);
      return;
    }

    if (!sourceImageId) {
      logger.log("No source image ID available");
      return;
    }

    if (command === "resubmit-last") {
      // Get the most recent history entry (keyed by source image ID)
      const entry = await getMostRecentHistoryEntry(sourceImageId);

      if (!entry) {
        logger.log("No history entries for source image:", sourceImageId);
        return;
      }

      logger.log("Re-submitting:", entry.text.substring(0, 50) + "...");

      // Update history (increments submitCount) and invalidate cache
      await cachedSaveToPostHistory(sourceImageId, entry.text);

      // Send fillAndSubmit to the content script
      try {
        const result = await chrome.tabs.sendMessage(tab.id, {
          type: "fillAndSubmit",
          text: entry.text,
        });

        if (result && !result.success) {
          logger.error("Fill and submit failed:", result.error);
        }
      } catch (error) {
        logger.error("Failed to send fillAndSubmit:", error);
      }
    } else if (command === "submit-clipboard") {
      // Send submitFromClipboard to the content script
      try {
        const result = await chrome.tabs.sendMessage(tab.id, {
          type: "submitFromClipboard",
          sourceImageId,
        });

        if (result && !result.success) {
          logger.error("Submit from clipboard failed:", result.error);
        }
      } catch (error) {
        logger.error("Failed to send submitFromClipboard:", error);
      }
    }
  } catch (error) {
    logger.error("Command handler error:", error);
  }
});

export {};
