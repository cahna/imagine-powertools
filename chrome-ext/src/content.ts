// Content script for ImaginePowerTools

import {
  type Mode,
  type GenerationOutcome,
  detectMode,
  fillAndSubmitVideo,
  clickVideoOption,
  setReactInputValue,
  detectGenerationOutcome,
  waitForOutcome,
} from "./content.core";
import { logger } from "./shared/logger";

export type { Mode };

let currentMode: Mode = "none";

// =============================================================================
// Autosubmit Feature State
// =============================================================================

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

let autosubmitState: AutosubmitState = { status: "idle" };
let autosubmitAbortController: AbortController | null = null;

const ATTEMPT_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes per attempt
const RETRY_DELAY_MS = 1000; // 1 second delay before retry
const GENERATION_START_TIMEOUT_MS = 10000; // 10 seconds to wait for generation to start

// Broadcast autosubmit status to popup (if open)
function broadcastAutosubmitStatus(): void {
  chrome.runtime
    .sendMessage({
      type: "autosubmit:status",
      state: autosubmitState,
    })
    .catch(() => {
      // Popup may be closed, ignore errors
    });
}

// Main autosubmit loop
async function runAutosubmit(maxRetries: number): Promise<void> {
  if (autosubmitState.status === "running") {
    logger.log("Autosubmit already running, ignoring");
    return;
  }

  logger.log(`Starting autosubmit with maxRetries=${maxRetries}`);

  autosubmitAbortController = new AbortController();
  const signal = autosubmitAbortController.signal;

  // Get prompt text for job registration
  const sourceImageIdForJob = getSourceImageId();
  if (sourceImageIdForJob) {
    // Get most recent prompt text
    const historyForJob = await new Promise<{
      success: boolean;
      entries?: HistoryEntry[];
    }>((resolve) => {
      chrome.runtime.sendMessage(
        { type: "storage:getPostHistory", postId: sourceImageIdForJob },
        (response) => resolve(response || { success: false }),
      );
    });

    const sortedForJob = historyForJob.entries?.sort(
      (a, b) => b.timestamp - a.timestamp,
    );
    const promptText = sortedForJob?.[0]?.text || "";

    // Register job with background script
    chrome.runtime
      .sendMessage({
        type: "jobs:register",
        tabTitle: document.title,
        sourceImageId: sourceImageIdForJob,
        promptText,
        maxRetries,
      })
      .catch(() => {
        // Background script may be unavailable, ignore
      });
  }

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    if (signal.aborted) {
      logger.log("Autosubmit aborted");
      break;
    }

    // Check we're still in post mode
    if (detectMode() !== "post") {
      logger.log("No longer in post mode, stopping");
      autosubmitState = { status: "stopped", reason: "navigated", attempt };
      broadcastAutosubmitStatus();
      break;
    }

    // Update state: submitting
    autosubmitState = {
      status: "running",
      attempt,
      maxRetries,
      phase: "submitting",
    };
    broadcastAutosubmitStatus();
    logger.log(`Autosubmit attempt ${attempt}/${maxRetries} - submitting`);

    // Get the source image ID
    const sourceImageId = getSourceImageId();
    if (!sourceImageId) {
      logger.error("Could not get source image ID");
      autosubmitState = { status: "stopped", reason: "navigated", attempt };
      broadcastAutosubmitStatus();
      break;
    }

    // Get the most recent history entry via background script
    const historyResponse = await new Promise<{
      success: boolean;
      entries?: HistoryEntry[];
    }>((resolve) => {
      chrome.runtime.sendMessage(
        { type: "storage:getPostHistory", postId: sourceImageId },
        (response) => resolve(response || { success: false }),
      );
    });

    if (!historyResponse.success || !historyResponse.entries?.length) {
      logger.error("No history entries to resubmit");
      autosubmitState = { status: "stopped", reason: "cancelled", attempt };
      broadcastAutosubmitStatus();
      break;
    }

    // Get the most recent entry
    const sorted = [...historyResponse.entries].sort(
      (a, b) => b.timestamp - a.timestamp,
    );
    const mostRecent = sorted[0];
    logger.log(`Resubmitting prompt: "${mostRecent.text.substring(0, 50)}..."`);

    // Fill and submit
    const submitResult = fillAndSubmitVideo(mostRecent.text);
    if (!submitResult.success) {
      logger.error("Fill and submit failed:", submitResult.error);
      autosubmitState = { status: "stopped", reason: "cancelled", attempt };
      broadcastAutosubmitStatus();
      break;
    }

    // Increment submission counter
    await saveToPostHistory(sourceImageId, mostRecent.text);

    // Update state: generating
    autosubmitState = {
      status: "running",
      attempt,
      maxRetries,
      phase: "generating",
    };
    broadcastAutosubmitStatus();

    // Wait for generation to start (look for "Generating" or rate limit)
    logger.log("Waiting for generation to start...");
    const startOutcome = await waitForOutcome(
      ["generating", "rate_limited"],
      GENERATION_START_TIMEOUT_MS,
      signal,
    );

    if (signal.aborted) break;

    if (startOutcome?.type === "rate_limited") {
      logger.log("Rate limited, stopping");
      autosubmitState = { status: "stopped", reason: "rate_limited", attempt };
      broadcastAutosubmitStatus();
      break;
    }

    if (!startOutcome || startOutcome.type !== "generating") {
      logger.log("Generation did not start, stopping");
      autosubmitState = { status: "stopped", reason: "timeout", attempt };
      broadcastAutosubmitStatus();
      break;
    }

    // Update state: waiting for result
    autosubmitState = {
      status: "running",
      attempt,
      maxRetries,
      phase: "waiting",
    };
    broadcastAutosubmitStatus();

    // Wait for outcome (success, moderated, or rate limited)
    logger.log("Waiting for generation outcome...");
    const outcome = await waitForOutcome(
      ["success", "moderated", "rate_limited"],
      ATTEMPT_TIMEOUT_MS,
      signal,
    );

    if (signal.aborted) break;

    if (!outcome) {
      // Timeout - treat like moderated, retry if attempts remain
      if (attempt < maxRetries) {
        logger.log(`Timeout on attempt ${attempt}, retrying...`);
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
        continue;
      } else {
        logger.log("Timeout, max retries reached");
        autosubmitState = { status: "stopped", reason: "timeout", attempt };
        broadcastAutosubmitStatus();
        break;
      }
    }

    logger.log(`Outcome: ${outcome.type}`);

    if (outcome.type === "success") {
      logger.log("Video generated successfully!");
      autosubmitState = { status: "success", attempt };
      broadcastAutosubmitStatus();
      break;
    }

    if (outcome.type === "rate_limited") {
      logger.log("Rate limited, stopping");
      autosubmitState = { status: "stopped", reason: "rate_limited", attempt };
      broadcastAutosubmitStatus();
      break;
    }

    if (outcome.type === "moderated") {
      if (attempt < maxRetries) {
        logger.log(`Moderated, retrying in ${RETRY_DELAY_MS}ms...`);
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
        continue; // Next attempt
      } else {
        logger.log("Moderated, max retries reached");
        autosubmitState = {
          status: "stopped",
          reason: "max_retries",
          attempt,
        };
        broadcastAutosubmitStatus();
        break;
      }
    }
  }

  autosubmitAbortController = null;
  logger.log("Autosubmit finished, final state:", autosubmitState);
}

// Cancel the autosubmit loop
function cancelAutosubmit(): void {
  if (autosubmitAbortController) {
    logger.log("Cancelling autosubmit");
    autosubmitAbortController.abort();
    autosubmitState = {
      status: "stopped",
      reason: "cancelled",
      attempt:
        autosubmitState.status === "running" ? autosubmitState.attempt : 0,
    };
    broadcastAutosubmitStatus();
  }
}

// =============================================================================
// URL/ID Extraction
// =============================================================================

// Extract post ID from URL if on a post page
function getPostId(): string | null {
  const pathname = window.location.pathname;
  const match = pathname.match(/^\/imagine\/post\/([^/]+)/);
  return match ? match[1] : null;
}

// Extract source image ID from the page
// The source image has a DIRECT URL: imagine-public.x.ai/imagine-public/images/{uuid}.jpg
// Related images use CDN: imagine-public.x.ai/cdn-cgi/image/.../imagine-public/images/{uuid}.jpg
// We prioritize the direct URL (non-CDN) as that's the source image
function getSourceImageId(): string | null {
  // UUID pattern
  const uuidPattern =
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

  const images = document.querySelectorAll<HTMLImageElement>("img");

  // First pass: look for direct source image URL (non-CDN)
  for (const img of images) {
    const src = img.src || "";

    // Direct source image URL pattern (no cdn-cgi in path)
    if (
      src.includes("imagine-public.x.ai/imagine-public/images/") &&
      !src.includes("cdn-cgi")
    ) {
      const match = src.match(/imagine-public\/images\/([0-9a-f-]+)\.jpg/i);
      if (match && match[1] && uuidPattern.test(match[1])) {
        return match[1];
      }
    }
  }

  // Second pass: fallback to CDN images if no direct URL found
  for (const img of images) {
    const src = img.src || "";

    if (src.includes("imagine-public/images/")) {
      const match = src.match(/imagine-public\/images\/([0-9a-f-]+)\.jpg/i);
      if (match && match[1] && uuidPattern.test(match[1])) {
        return match[1];
      }
    }
  }

  // Third pass: check alt attributes as last resort
  for (const img of images) {
    const src = img.src || "";
    const alt = img.alt || "";

    if (uuidPattern.test(alt) && src.includes("imagine-public")) {
      return alt;
    }
  }

  return null;
}

// Send mode update to background script
function sendModeUpdate(mode: Mode): void {
  chrome.runtime.sendMessage({ type: "modeChange", mode });
}

// Check for mode changes and log/notify
function checkModeChange(): void {
  const newMode = detectMode();

  if (newMode !== currentMode) {
    const previousMode = currentMode;
    currentMode = newMode;

    logger.log(`Mode changed: ${previousMode} -> ${newMode}`);

    sendModeUpdate(newMode);
  }
}

// Debounce function to avoid excessive checks
function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  delay: number,
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = null;
    }, delay);
  };
}

// Debounced mode check
const debouncedModeCheck = debounce(checkModeChange, 100);

// State for navigation interception (used to capture UUIDs from fresh result images)
let navigationInterceptor: {
  enabled: boolean;
  capturedUrl: string | null;
  scrollY: number;
} | null = null;

// Set up MutationObserver to watch for DOM changes
function setupMutationObserver(): void {
  const observer = new MutationObserver(() => {
    debouncedModeCheck();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

// Intercept history API for SPA navigation
function setupHistoryInterception(): void {
  // Listen for popstate (back/forward navigation)
  window.addEventListener("popstate", () => {
    debouncedModeCheck();
  });

  // Intercept pushState
  const originalPushState = history.pushState.bind(history);
  history.pushState = function (...args) {
    const url = args[2] as string | undefined;
    logger.log("pushState called:", {
      url,
      interceptorEnabled: navigationInterceptor?.enabled,
    });

    // Check if we're intercepting navigation to capture UUID
    if (navigationInterceptor?.enabled) {
      if (url?.includes("/imagine/post/")) {
        // Capture the URL
        navigationInterceptor.capturedUrl = url;
        logger.log("Captured navigation URL:", url);

        // Still call pushState so browser history is updated
        originalPushState(...args);

        // Immediately go back before React renders the new page
        history.back();
        return;
      }
    }

    originalPushState(...args);
    debouncedModeCheck();
  };

  // Intercept replaceState
  const originalReplaceState = history.replaceState.bind(history);
  history.replaceState = function (...args) {
    originalReplaceState(...args);
    debouncedModeCheck();
  };
}

// =============================================================================
// Storage operations via message passing to background script
// (IndexedDB is not accessible from content scripts)
// =============================================================================

interface HistoryEntry {
  text: string;
  timestamp: number;
  submitCount?: number;
}

// Save to post history via background script
async function saveToPostHistory(postId: string, text: string): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { type: "storage:saveToPostHistory", postId, text },
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

// Listen for messages from popup or background
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "getMode") {
    sendResponse({
      mode: currentMode,
      postId: currentMode === "post" ? getPostId() : null,
      sourceImageId: currentMode === "post" ? getSourceImageId() : null,
    });
    return true;
  }

  if (message.type === "fillAndSubmit") {
    const result = fillAndSubmitVideo(message.text);
    sendResponse(result);
    return true;
  }

  if (message.type === "submitFromClipboard") {
    // Handle async clipboard read
    (async () => {
      try {
        const text = await navigator.clipboard.readText();
        const trimmed = text.trim();

        if (!trimmed) {
          sendResponse({ success: false, error: "Clipboard is empty" });
          return;
        }

        const sourceImageId = message.sourceImageId;

        // Save to history (handles duplicates by incrementing submitCount)
        await saveToPostHistory(sourceImageId, trimmed);

        // Fill and submit
        const result = fillAndSubmitVideo(trimmed);
        sendResponse(result);
      } catch (error) {
        logger.error("Clipboard read failed:", error);
        sendResponse({ success: false, error: "Failed to read clipboard" });
      }
    })();
    return true; // Keep channel open for async response
  }

  if (message.type === "clickVideoOption") {
    (async () => {
      const result = await clickVideoOption(message.option);
      sendResponse(result);
    })();
    return true; // Keep channel open for async response
  }

  if (message.type === "clickDownload") {
    const result = clickDownloadButton();
    sendResponse(result);
    return true;
  }

  // Autosubmit message handlers
  if (message.type === "autosubmit:start") {
    const { maxRetries } = message;
    logger.log(`Received autosubmit:start with maxRetries=${maxRetries}`);

    // Run asynchronously
    (async () => {
      await runAutosubmit(maxRetries);
    })();

    sendResponse({ success: true });
    return true;
  }

  if (message.type === "autosubmit:cancel") {
    logger.log("Received autosubmit:cancel");
    cancelAutosubmit();
    sendResponse({ success: true, state: autosubmitState });
    return true;
  }

  if (message.type === "autosubmit:getState") {
    logger.log("Received autosubmit:getState, state:", autosubmitState);
    sendResponse({ state: autosubmitState });
    return true;
  }

  return false;
});

// Click the download button
function clickDownloadButton(): { success: boolean; error?: string } {
  const downloadBtn = document.querySelector<HTMLButtonElement>(
    'button[aria-label="Download"]',
  );

  if (!downloadBtn) {
    return { success: false, error: "Download button not found" };
  }

  downloadBtn.click();
  return { success: true };
}

// Extract image/video UUID from a masonry card element
function getImageIdFromCard(card: Element): string | null {
  const uuidPattern =
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

  // First, check for video element (videos have UUID in different URL pattern)
  const video = card.querySelector<HTMLVideoElement>("video");
  if (video?.src) {
    // Pattern: assets.grok.com/users/.../generated/{uuid}/generated_video.mp4
    const videoMatch = video.src.match(
      /generated\/([0-9a-f-]+)\/generated_video\.mp4/i,
    );
    if (videoMatch && videoMatch[1] && uuidPattern.test(videoMatch[1])) {
      return videoMatch[1];
    }
    // Pattern: imagine-public.x.ai/imagine-public/share-videos/{uuid}.mp4
    const shareMatch = video.src.match(/share-videos\/([0-9a-f-]+)\.mp4/i);
    if (shareMatch && shareMatch[1] && uuidPattern.test(shareMatch[1])) {
      return shareMatch[1];
    }
  }

  // Look for an image within the card
  const img = card.querySelector<HTMLImageElement>("img");
  if (img) {
    // Check src first for URL-based patterns
    if (img.src) {
      // Pattern: imagine-public/images/{uuid}.jpg (standard images)
      const imgMatch = img.src.match(
        /imagine-public\/images\/([0-9a-f-]+)\.jpg/i,
      );
      if (imgMatch && imgMatch[1] && uuidPattern.test(imgMatch[1])) {
        return imgMatch[1];
      }
      // Pattern: assets.grok.com/users/.../generated/{uuid}/preview_image.jpg (video thumbnails)
      const previewMatch = img.src.match(
        /generated\/([0-9a-f-]+)\/preview_image\.jpg/i,
      );
      if (
        previewMatch &&
        previewMatch[1] &&
        uuidPattern.test(previewMatch[1])
      ) {
        return previewMatch[1];
      }
    }

    // Fallback: check alt attribute (used on results page where src is base64)
    if (img.alt && uuidPattern.test(img.alt)) {
      return img.alt;
    }
  }

  return null;
}

// Find the masonry card element from a click target
function findMasonryCard(target: Element): Element | null {
  // Look for the card container - it has the class containing "media-post-masonry-card"
  let current: Element | null = target;
  while (current) {
    if (current.classList?.toString().includes("media-post-masonry-card")) {
      return current;
    }
    // Also check for role="listitem" which is the outer container
    if (current.getAttribute?.("role") === "listitem") {
      const card = current.querySelector('[class*="media-post-masonry-card"]');
      if (card) return card;
    }
    current = current.parentElement;
  }
  return null;
}

// Handle Alt+Shift+Click to open favorites in new tab
function setupFavoritesClickHandler(): void {
  document.addEventListener(
    "click",
    async (e) => {
      // Skip synthetic clicks we dispatch for navigation interception
      if (
        (e as MouseEvent & { _syntheticForInterception?: boolean })
          ._syntheticForInterception
      ) {
        return;
      }

      // Only handle Alt+Shift+Click
      if (!e.altKey || !e.shiftKey) {
        return;
      }

      // Only in favorites or results mode (both show image/video grids)
      if (currentMode !== "favorites" && currentMode !== "results") {
        return;
      }

      const target = e.target as Element;
      const card = findMasonryCard(target);

      if (!card) {
        return;
      }

      // Prevent default click behavior
      e.preventDefault();
      e.stopPropagation();

      // Try direct DOM extraction first (works for favorites and cached images)
      let imageId = getImageIdFromCard(card);

      // Fallback: simulate click and capture navigation URL (for fresh result images)
      if (!imageId) {
        logger.log("Attempting navigation capture fallback");
        const scrollY = window.scrollY;
        const originalUrl = window.location.href;

        // Create synthetic click without modifiers
        const syntheticClick = new MouseEvent("click", {
          bubbles: true,
          cancelable: true,
          view: window,
        }) as MouseEvent & { _syntheticForInterception?: boolean };
        syntheticClick._syntheticForInterception = true;

        // Dispatch on the image or card
        const clickTarget = card.querySelector("img") || card;
        logger.log("Dispatching synthetic click on:", clickTarget.tagName);
        clickTarget.dispatchEvent(syntheticClick);

        // Poll for URL change (React navigation is async)
        for (let i = 0; i < 20; i++) {
          await new Promise((resolve) => setTimeout(resolve, 50));

          if (window.location.href !== originalUrl) {
            logger.log("URL changed to:", window.location.href);
            const match = window.location.pathname.match(
              /\/imagine\/post\/([^/?]+)/,
            );
            if (match) {
              imageId = match[1];
              // Go back to results page
              history.back();
              // Restore scroll position after navigation
              await new Promise((resolve) => setTimeout(resolve, 50));
              window.scrollTo(0, scrollY);
            }
            break;
          }
        }

        if (!imageId) {
          logger.log("URL did not change after synthetic click");
        }
      }

      if (imageId) {
        const url = `https://grok.com/imagine/post/${imageId}`;
        chrome.runtime.sendMessage({ type: "openTab", url });
      } else {
        logger.log("Could not extract image/video ID from card");
      }
    },
    true,
  ); // Use capture phase to intercept before React handlers
}

// Initialize
function init(): void {
  logger.log("Content script loaded");

  // Initial mode detection
  currentMode = detectMode();
  logger.log(`Initial mode: ${currentMode}`);
  sendModeUpdate(currentMode);

  // Set up observers
  setupMutationObserver();
  setupHistoryInterception();

  // Set up favorites click handler
  setupFavoritesClickHandler();
}

init();
