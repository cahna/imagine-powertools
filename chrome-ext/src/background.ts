// Background service worker for Grok Imagine Power Tools

type Mode = "favorites" | "results" | "post" | "none";

interface HistoryEntry {
  text: string;
  timestamp: number;
}

interface PostHistory {
  [postId: string]: HistoryEntry[];
}

// Storage key for post history (must match popup)
const STORAGE_KEY = "postHistory";

// Store mode per tab
const tabModes = new Map<number, Mode>();

// Get the most recent history entry for a post
async function getMostRecentHistoryEntry(postId: string): Promise<HistoryEntry | null> {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    const history: PostHistory = result[STORAGE_KEY] || {};
    const entries = history[postId];

    if (!entries || entries.length === 0) {
      return null;
    }

    // Sort by timestamp descending and return the most recent
    const sorted = [...entries].sort((a, b) => b.timestamp - a.timestamp);
    return sorted[0];
  } catch (error) {
    console.error("[Grok Imagine Power Tools] Failed to get history:", error);
    return null;
  }
}

// Listen for extension installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    console.log("[Grok Imagine Power Tools] Extension installed");
  } else if (details.reason === "update") {
    console.log("[Grok Imagine Power Tools] Extension updated");
  }
});

// Listen for messages from content scripts or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case "modeChange": {
      const tabId = sender.tab?.id;
      if (tabId !== undefined) {
        const previousMode = tabModes.get(tabId);
        tabModes.set(tabId, message.mode);
        console.log(
          `[Grok Imagine Power Tools] Tab ${tabId} mode: ${previousMode ?? "unknown"} -> ${message.mode}`
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

    default:
      sendResponse({ status: "unknown message type" });
  }

  return true;
});

// Clean up when tabs are closed
chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabModes.has(tabId)) {
    tabModes.delete(tabId);
    console.log(`[Grok Imagine Power Tools] Cleaned up mode for tab ${tabId}`);
  }
});

// Handle keyboard commands
chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "resubmit-last") {
    return;
  }

  console.log("[Grok Imagine Power Tools] Resubmit-last command triggered");

  try {
    // Get the active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab?.id) {
      console.log("[Grok Imagine Power Tools] No active tab found");
      return;
    }

    // Check if we're on a grok.com/imagine page
    const url = tab.url || "";
    if (!url.startsWith("https://grok.com/imagine")) {
      console.log("[Grok Imagine Power Tools] Not on grok.com/imagine page");
      return;
    }

    // Query the content script for mode and post ID
    let modeResponse;
    try {
      modeResponse = await chrome.tabs.sendMessage(tab.id, { type: "getMode" });
    } catch (error) {
      console.log("[Grok Imagine Power Tools] Content script not responding:", error);
      return;
    }

    if (!modeResponse) {
      console.log("[Grok Imagine Power Tools] No response from content script");
      return;
    }

    const { mode, sourceImageId } = modeResponse;

    if (mode !== "post") {
      console.log("[Grok Imagine Power Tools] Not in post mode, current mode:", mode);
      return;
    }

    if (!sourceImageId) {
      console.log("[Grok Imagine Power Tools] No source image ID available");
      return;
    }

    // Get the most recent history entry (keyed by source image ID)
    const entry = await getMostRecentHistoryEntry(sourceImageId);

    if (!entry) {
      console.log("[Grok Imagine Power Tools] No history entries for source image:", sourceImageId);
      return;
    }

    console.log("[Grok Imagine Power Tools] Re-submitting:", entry.text.substring(0, 50) + "...");

    // Send fillAndSubmit to the content script
    try {
      const result = await chrome.tabs.sendMessage(tab.id, {
        type: "fillAndSubmit",
        text: entry.text,
      });

      if (result && !result.success) {
        console.error("[Grok Imagine Power Tools] Fill and submit failed:", result.error);
      }
    } catch (error) {
      console.error("[Grok Imagine Power Tools] Failed to send fillAndSubmit:", error);
    }
  } catch (error) {
    console.error("[Grok Imagine Power Tools] Command handler error:", error);
  }
});

export {};
