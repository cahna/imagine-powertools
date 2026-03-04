// Background service worker for Grok Imagine Power Tools

import { HistoryEntry, PostHistory, STORAGE_KEY, saveToPostHistory } from "./shared/storage";

type Mode = "favorites" | "results" | "post" | "none";

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
    console.log(`[Grok Imagine Power Tools] Video option command: ${option}`);

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab?.id) {
        console.log("[Grok Imagine Power Tools] No active tab found");
        return;
      }

      const url = tab.url || "";
      if (!url.startsWith("https://grok.com/imagine")) {
        console.log("[Grok Imagine Power Tools] Not on grok.com/imagine page");
        return;
      }

      // Send message to content script to click video option
      try {
        const result = await chrome.tabs.sendMessage(tab.id, {
          type: "clickVideoOption",
          option,
        });

        if (result && !result.success) {
          console.error("[Grok Imagine Power Tools] Click video option failed:", result.error);
        }
      } catch (error) {
        console.error("[Grok Imagine Power Tools] Failed to send clickVideoOption:", error);
      }
    } catch (error) {
      console.error("[Grok Imagine Power Tools] Video option command error:", error);
    }
    return;
  }

  // Download video command
  if (command === "download-video") {
    console.log("[Grok Imagine Power Tools] Download video command triggered");

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab?.id) {
        console.log("[Grok Imagine Power Tools] No active tab found");
        return;
      }

      const url = tab.url || "";
      if (!url.startsWith("https://grok.com/imagine")) {
        console.log("[Grok Imagine Power Tools] Not on grok.com/imagine page");
        return;
      }

      // Send message to content script to click download button
      try {
        const result = await chrome.tabs.sendMessage(tab.id, {
          type: "clickDownload",
        });

        if (result && !result.success) {
          console.error("[Grok Imagine Power Tools] Click download failed:", result.error);
        }
      } catch (error) {
        console.error("[Grok Imagine Power Tools] Failed to send clickDownload:", error);
      }
    } catch (error) {
      console.error("[Grok Imagine Power Tools] Download command error:", error);
    }
    return;
  }

  if (command !== "resubmit-last" && command !== "submit-clipboard") {
    return;
  }

  console.log(`[Grok Imagine Power Tools] ${command} command triggered`);

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

    if (command === "resubmit-last") {
      // Get the most recent history entry (keyed by source image ID)
      const entry = await getMostRecentHistoryEntry(sourceImageId);

      if (!entry) {
        console.log("[Grok Imagine Power Tools] No history entries for source image:", sourceImageId);
        return;
      }

      console.log("[Grok Imagine Power Tools] Re-submitting:", entry.text.substring(0, 50) + "...");

      // Update history (increments submitCount)
      await saveToPostHistory(sourceImageId, entry.text);

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
    } else if (command === "submit-clipboard") {
      // Send submitFromClipboard to the content script
      try {
        const result = await chrome.tabs.sendMessage(tab.id, {
          type: "submitFromClipboard",
          sourceImageId,
        });

        if (result && !result.success) {
          console.error("[Grok Imagine Power Tools] Submit from clipboard failed:", result.error);
        }
      } catch (error) {
        console.error("[Grok Imagine Power Tools] Failed to send submitFromClipboard:", error);
      }
    }
  } catch (error) {
    console.error("[Grok Imagine Power Tools] Command handler error:", error);
  }
});

export {};
