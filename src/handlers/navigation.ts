/**
 * Navigation and mode detection handlers.
 * Handles SPA navigation interception, mode change detection, and mutation observation.
 */

import { type Mode, detectMode } from "../content.core";
import { logger } from "../shared/logger";
import { ContentMessageType } from "../shared/messageTypes";
import { TIMEOUTS } from "../config";

let currentMode: Mode = "none";

/** Returns the current detected mode. */
export function getCurrentMode(): Mode {
  return currentMode;
}

/** Sets the current mode (for initialization). */
export function setCurrentMode(mode: Mode): void {
  currentMode = mode;
}

/** Notifies background script of a mode change via runtime messaging. */
export function sendModeUpdate(mode: Mode): void {
  chrome.runtime.sendMessage({ type: ContentMessageType.MODE_CHANGE, mode });
}

/** Detects mode changes and notifies the background script when mode changes. */
function checkModeChange(): void {
  const newMode = detectMode();

  if (newMode !== currentMode) {
    const previousMode = currentMode;
    currentMode = newMode;

    logger.log(`Mode changed: ${previousMode} -> ${newMode}`);

    sendModeUpdate(newMode);
  }
}

/** Creates a debounced version of a function. */
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
const debouncedModeCheck = debounce(checkModeChange, TIMEOUTS.debounce);

// State for navigation interception (used to capture UUIDs from fresh result images)
let navigationInterceptor: {
  enabled: boolean;
  capturedUrl: string | null;
  scrollY: number;
} | null = null;

/** Sets up a MutationObserver to detect DOM changes that might indicate mode changes. */
export function setupMutationObserver(): void {
  const observer = new MutationObserver(() => {
    debouncedModeCheck();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

/** Patches history.pushState/replaceState to detect SPA navigation changes. */
export function setupHistoryInterception(): void {
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

/** Enables navigation interception for UUID capture. */
export function enableNavigationInterceptor(scrollY: number): void {
  navigationInterceptor = {
    enabled: true,
    capturedUrl: null,
    scrollY,
  };
}

/** Disables navigation interception and returns any captured URL. */
export function disableNavigationInterceptor(): string | null {
  const capturedUrl = navigationInterceptor?.capturedUrl ?? null;
  navigationInterceptor = null;
  return capturedUrl;
}
