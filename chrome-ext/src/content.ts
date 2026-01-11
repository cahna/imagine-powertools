// Content script for Grok Imagine Power Tools

export type Mode = "favorites" | "results" | "post" | "none";

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

// Detect the current mode based on URL and page content
function detectMode(): Mode {
  const pathname = window.location.pathname;

  if (pathname === "/imagine/favorites") {
    return "favorites";
  }

  if (pathname.startsWith("/imagine/post/")) {
    return "post";
  }

  if (pathname === "/imagine") {
    // Check for back button (indicates we're viewing results)
    const backBtn = document.querySelector('button[aria-label="Back"]');
    if (backBtn) {
      return "results";
    }
  }

  return "none";
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

// Set value on a React-controlled input/textarea
function setReactInputValue(element: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  // Get the native setter from the prototype
  const prototype = element instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype
    : HTMLInputElement.prototype;

  const nativeSetter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;

  if (nativeSetter) {
    nativeSetter.call(element, value);
  } else {
    // Fallback
    element.value = value;
  }

  // Dispatch input event so React picks up the change
  element.dispatchEvent(new Event("input", { bubbles: true }));
}

// Fill the video prompt textarea and click the Make video button
function fillAndSubmitVideo(text: string): { success: boolean; error?: string } {
  // Find the textarea
  const textarea = document.querySelector<HTMLTextAreaElement>(
    'textarea[aria-label="Make a video"]'
  );

  if (!textarea) {
    return { success: false, error: "Could not find video prompt textarea" };
  }

  // Set the value using React-compatible method
  setReactInputValue(textarea, text);

  // Find and click the Make video button
  const makeVideoBtn = document.querySelector<HTMLButtonElement>(
    'button[aria-label="Make video"]'
  );

  if (!makeVideoBtn) {
    return { success: false, error: "Could not find Make video button" };
  }

  // Small delay to ensure React has processed the input
  setTimeout(() => {
    makeVideoBtn.click();
  }, 50);

  return { success: true };
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

  return false;
});

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
  if (img?.src) {
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
  document.addEventListener("click", (e) => {
    // Only handle Alt+Shift+Click
    if (!e.altKey || !e.shiftKey) {
      return;
    }

    // Only in favorites mode
    if (currentMode !== "favorites") {
      return;
    }

    const target = e.target as Element;
    const card = findMasonryCard(target);

    if (!card) {
      return;
    }

    const imageId = getImageIdFromCard(card);
    if (!imageId) {
      console.log("[Grok Imagine Power Tools] Could not extract image/video ID from card");
      return;
    }

    // Prevent default click behavior
    e.preventDefault();
    e.stopPropagation();

    // Open post in new tab via background script
    const url = `https://grok.com/imagine/post/${imageId}`;
    chrome.runtime.sendMessage({ type: "openTab", url });
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
