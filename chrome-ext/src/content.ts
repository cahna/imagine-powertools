// Content script for Grok Imagine Power Tools

import {
  type Mode,
  detectMode,
  fillAndSubmitVideo,
  clickVideoOption,
  setReactInputValue,
} from "./content.core";

export type { Mode };

let currentMode: Mode = "none";

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
  const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

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

    console.log(
      `[Grok Imagine Power Tools] Mode changed: ${previousMode} -> ${newMode}`
    );

    sendModeUpdate(newMode);
  }
}

// Debounce function to avoid excessive checks
function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  delay: number
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
    console.log("[Grok Imagine Power Tools] pushState called:", {
      url,
      interceptorEnabled: navigationInterceptor?.enabled,
    });

    // Check if we're intercepting navigation to capture UUID
    if (navigationInterceptor?.enabled) {
      if (url?.includes("/imagine/post/")) {
        // Capture the URL
        navigationInterceptor.capturedUrl = url;
        console.log("[Grok Imagine Power Tools] Captured navigation URL:", url);

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
      }
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
        console.error("[Grok Imagine Power Tools] Clipboard read failed:", error);
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

  return false;
});

// Click the download button
function clickDownloadButton(): { success: boolean; error?: string } {
  const downloadBtn = document.querySelector<HTMLButtonElement>('button[aria-label="Download"]');

  if (!downloadBtn) {
    return { success: false, error: "Download button not found" };
  }

  downloadBtn.click();
  return { success: true };
}

// Extract image/video UUID from a masonry card element
function getImageIdFromCard(card: Element): string | null {
  const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

  // First, check for video element (videos have UUID in different URL pattern)
  const video = card.querySelector<HTMLVideoElement>("video");
  if (video?.src) {
    // Pattern: assets.grok.com/users/.../generated/{uuid}/generated_video.mp4
    const videoMatch = video.src.match(/generated\/([0-9a-f-]+)\/generated_video\.mp4/i);
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
      const imgMatch = img.src.match(/imagine-public\/images\/([0-9a-f-]+)\.jpg/i);
      if (imgMatch && imgMatch[1] && uuidPattern.test(imgMatch[1])) {
        return imgMatch[1];
      }
      // Pattern: assets.grok.com/users/.../generated/{uuid}/preview_image.jpg (video thumbnails)
      const previewMatch = img.src.match(/generated\/([0-9a-f-]+)\/preview_image\.jpg/i);
      if (previewMatch && previewMatch[1] && uuidPattern.test(previewMatch[1])) {
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
  document.addEventListener("click", async (e) => {
    // Skip synthetic clicks we dispatch for navigation interception
    if ((e as MouseEvent & { _syntheticForInterception?: boolean })._syntheticForInterception) {
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
      console.log("[Grok Imagine Power Tools] Attempting navigation capture fallback");
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
      console.log("[Grok Imagine Power Tools] Dispatching synthetic click on:", clickTarget.tagName);
      clickTarget.dispatchEvent(syntheticClick);

      // Poll for URL change (React navigation is async)
      for (let i = 0; i < 20; i++) {
        await new Promise((resolve) => setTimeout(resolve, 50));

        if (window.location.href !== originalUrl) {
          console.log("[Grok Imagine Power Tools] URL changed to:", window.location.href);
          const match = window.location.pathname.match(/\/imagine\/post\/([^/?]+)/);
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
        console.log("[Grok Imagine Power Tools] URL did not change after synthetic click");
      }
    }

    if (imageId) {
      const url = `https://grok.com/imagine/post/${imageId}`;
      chrome.runtime.sendMessage({ type: "openTab", url });
    } else {
      console.log("[Grok Imagine Power Tools] Could not extract image/video ID from card");
    }
  }, true); // Use capture phase to intercept before React handlers
}

// Initialize
function init(): void {
  console.log("[Grok Imagine Power Tools] Content script loaded");

  // Initial mode detection
  currentMode = detectMode();
  console.log(`[Grok Imagine Power Tools] Initial mode: ${currentMode}`);
  sendModeUpdate(currentMode);

  // Set up observers
  setupMutationObserver();
  setupHistoryInterception();

  // Set up favorites click handler
  setupFavoritesClickHandler();
}

init();
