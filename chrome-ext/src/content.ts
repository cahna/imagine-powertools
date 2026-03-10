// Content script for ImaginePowerTools

import {
  type Mode,
  detectMode,
  fillAndSubmitVideo,
  clickVideoOption,
  waitForOutcome,
  waitForOutcomeWithContext,
  waitForElement,
  isInExtendMode,
  clickMakeVideoButton,
  clickExtendVideoFromMenu,
  navigateVideoCarousel,
  captureGenerationContext,
  getCurrentPostId,
  isSelectedCarouselItemModerated,
  isPreviewAreaModerated,
  selectFirstValidCarouselItem,
  recoverExtendModeForVideo,
} from "./content.core";
import { logger } from "./shared/logger";
import { createActor, type Actor } from "xstate";
import {
  autosubmitMachine,
  type AutosubmitEvent,
  type StopReason,
} from "./machines/autosubmit.machine";
import { TIMEOUTS } from "./config";
import {
  ContentMessageType,
  StorageMessageType,
  ExtendStorageMessageType,
  PromptMessageType,
  AutosubmitMessageType,
  JobsMessageType,
} from "./shared/messageTypes";

export type { Mode };

let currentMode: Mode = "none";

// =============================================================================
// Autosubmit Feature State (XState Machine)
// =============================================================================

/** Legacy state type for backward compatibility with popup/background communication. */
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

let autosubmitActor: Actor<typeof autosubmitMachine> | null = null;
let autosubmitAbortController: AbortController | null = null;

/** Converts XState machine state to legacy AutosubmitState for popup/background compatibility. */
function getAutosubmitState(): AutosubmitState {
  if (!autosubmitActor) {
    return { status: "idle" };
  }

  const snapshot = autosubmitActor.getSnapshot();
  const { value, context } = snapshot;

  switch (value) {
    case "idle":
      return { status: "idle" };

    case "submitting":
      return {
        status: "running",
        attempt: context.attempt,
        maxRetries: context.maxRetries,
        phase: "submitting",
      };

    case "waitingForGeneration":
      return {
        status: "running",
        attempt: context.attempt,
        maxRetries: context.maxRetries,
        phase: "generating",
      };

    case "generating":
    case "recovering":
    case "retrying":
      return {
        status: "running",
        attempt: context.attempt,
        maxRetries: context.maxRetries,
        phase: "waiting",
      };

    case "success":
      return { status: "success", attempt: context.attempt };

    case "stopped": {
      type LegacyReason = "cancelled" | "rate_limited" | "max_retries" | "timeout" | "navigated";
      const reasonMap: Record<StopReason, LegacyReason> = {
        cancelled: "cancelled",
        navigated: "navigated",
        submit_failed: "cancelled",
        rate_limited: "rate_limited",
        timeout: "timeout",
        max_retries: "max_retries",
        recovery_failed: "cancelled",
      };
      return {
        status: "stopped" as const,
        reason: context.stopReason ? reasonMap[context.stopReason] : ("cancelled" as LegacyReason),
        attempt: context.attempt,
      };
    }

    default:
      return { status: "idle" };
  }
}

/** Sends an event to the autosubmit state machine. */
function sendAutosubmitEvent(event: AutosubmitEvent): void {
  if (autosubmitActor) {
    autosubmitActor.send(event);
  }
}

/** Broadcasts current autosubmit state to popup (if open) via runtime messaging. */
function broadcastAutosubmitStatus(): void {
  chrome.runtime
    .sendMessage({
      type: AutosubmitMessageType.STATUS,
      state: getAutosubmitState(),
    })
    .catch(() => {
      // Popup may be closed, ignore errors
    });
}

/** Runs the autosubmit loop, retrying submissions until success or max retries reached. */
async function runAutosubmit(
  maxRetries: number,
  isExtend: boolean = false,
): Promise<void> {
  // Check if already running using machine state
  const currentState = getAutosubmitState();
  if (currentState.status === "running") {
    logger.log("Autosubmit already running, ignoring");
    return;
  }

  const logPrefix = isExtend ? "[extend] " : "";
  logger.log(
    `${logPrefix}Starting autosubmit with maxRetries=${maxRetries}, isExtend=${isExtend}`,
  );

  autosubmitAbortController = new AbortController();
  const signal = autosubmitAbortController.signal;

  // For extend mode, track the source video ID (the video we're extending from)
  // This is needed for recovery after moderation
  const extendSourceVideoId = isExtend ? getPostId() : null;
  if (isExtend) {
    logger.log(`${logPrefix}Extend source video ID: ${extendSourceVideoId}`);
  }

  // For image-to-video (not extend), if viewing a moderated result, navigate to first valid item
  // Check both: preview area showing moderation OR selected carousel item is moderated
  // This allows autosubmit to work even when starting from a moderated state
  if (
    !isExtend &&
    (isPreviewAreaModerated() || isSelectedCarouselItemModerated())
  ) {
    logger.log(
      "Moderated content detected, navigating to first valid carousel item",
    );
    if (!selectFirstValidCarouselItem()) {
      logger.error(`${logPrefix}No valid carousel items found`);
      // Don't start machine - just bail early
      broadcastAutosubmitStatus();
      return;
    }
    // Brief delay to let the page update after navigation
    await new Promise((resolve) => setTimeout(resolve, TIMEOUTS.uiSettle));
  }

  // Cache the source image ID at the start - this must be fetched BEFORE any moderation
  // can change the page state, and reused for all retry attempts
  const sourceImageId = getSourceImageId();
  if (!sourceImageId) {
    logger.error(
      `${logPrefix}Could not get source image ID - is a valid video selected?`,
    );
    // Don't start machine - just bail early
    broadcastAutosubmitStatus();
    return;
  }

  // Create and start the XState machine actor
  autosubmitActor = createActor(autosubmitMachine);
  autosubmitActor.subscribe((state) => {
    logger.log(`[machine] State: ${state.value}, attempt: ${state.context.attempt}`);
    broadcastAutosubmitStatus();
  });
  autosubmitActor.start();

  // Send START event to machine
  sendAutosubmitEvent({
    type: "START",
    sourceImageId,
    maxRetries,
    isExtend,
  });

  // Get prompt text for job registration
  const historyForJob = await new Promise<{
    success: boolean;
    entries?: HistoryEntry[];
  }>((resolve) => {
    if (isExtend && extendSourceVideoId) {
      chrome.runtime.sendMessage(
        {
          type: ExtendStorageMessageType.GET_EXTEND_HISTORY,
          videoId: extendSourceVideoId,
        },
        (response) => resolve(response || { success: false }),
      );
    } else {
      chrome.runtime.sendMessage(
        {
          type: StorageMessageType.GET_POST_HISTORY,
          postId: sourceImageId,
        },
        (response) => resolve(response || { success: false }),
      );
    }
  });

  const sortedForJob = historyForJob.entries?.sort(
    (a, b) => b.timestamp - a.timestamp,
  );
  const promptText = sortedForJob?.[0]?.text || "";

  // Register job with background script
  chrome.runtime
    .sendMessage({
      type: JobsMessageType.REGISTER,
      tabTitle: document.title,
      sourceImageId,
      promptText,
      maxRetries,
      jobType: isExtend ? "extend" : "video",
    })
    .catch(() => {
      // Background script may be unavailable, ignore
    });

  // The expected mode depends on whether we're in extend mode
  const expectedMode = isExtend ? "post-extend" : "post";

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    if (signal.aborted) {
      logger.log(`${logPrefix}Autosubmit aborted`);
      break;
    }

    // Check we're still in the expected mode
    const currentModeCheck = detectMode();
    if (currentModeCheck !== expectedMode) {
      logger.log(
        `${logPrefix}No longer in ${expectedMode} mode (now ${currentModeCheck}), stopping`,
      );
      sendAutosubmitEvent({ type: "NAVIGATED" });
      break;
    }

    // Capture generation context BEFORE submission for accurate outcome detection
    const context = captureGenerationContext();
    logger.log(
      `${logPrefix}Context: postId=${context.initialPostId}, carouselCount=${context.initialCarouselCount}`,
    );

    logger.log(
      `${logPrefix}Autosubmit attempt ${attempt}/${maxRetries} - submitting`,
    );

    // sourceImageId was cached at the start of autosubmit and reused here

    // Get the most recent history entry via background script (use appropriate history)
    // For extend mode, use extendSourceVideoId (the video being extended)
    // For image-to-video, use sourceImageId (the source image)
    const historyResponse = await new Promise<{
      success: boolean;
      entries?: HistoryEntry[];
    }>((resolve) => {
      if (isExtend && extendSourceVideoId) {
        chrome.runtime.sendMessage(
          {
            type: ExtendStorageMessageType.GET_EXTEND_HISTORY,
            videoId: extendSourceVideoId,
          },
          (response) => resolve(response || { success: false }),
        );
      } else {
        chrome.runtime.sendMessage(
          { type: StorageMessageType.GET_POST_HISTORY, postId: sourceImageId },
          (response) => resolve(response || { success: false }),
        );
      }
    });

    if (!historyResponse.success || !historyResponse.entries?.length) {
      logger.error(`${logPrefix}No history entries to resubmit`);
      sendAutosubmitEvent({ type: "SUBMIT_FAILED" });
      break;
    }

    // Get the most recent entry
    const sorted = [...historyResponse.entries].sort(
      (a, b) => b.timestamp - a.timestamp,
    );
    const mostRecent = sorted[0];
    logger.log(
      `${logPrefix}Resubmitting prompt: "${mostRecent.text.substring(0, 50)}..."`,
    );

    // Fill and submit
    const submitResult = fillAndSubmitVideo(mostRecent.text);
    if (!submitResult.success) {
      logger.error(`${logPrefix}Fill and submit failed:`, submitResult.error);
      sendAutosubmitEvent({ type: "SUBMIT_FAILED" });
      break;
    }

    // Submission successful, tell machine
    sendAutosubmitEvent({ type: "SUBMITTED" });

    // Increment submission counter (use appropriate history)
    if (isExtend && extendSourceVideoId) {
      await saveToExtendHistory(extendSourceVideoId, mostRecent.text);
    } else {
      await saveToPostHistory(sourceImageId, mostRecent.text);
    }

    // Wait for generation to start (look for "Generating" or rate limit)
    logger.log("Waiting for generation to start...");
    const startOutcome = await waitForOutcome(
      ["generating", "rate_limited"],
      TIMEOUTS.generationStart,
      signal,
    );

    if (signal.aborted) break;

    if (startOutcome?.type === "rate_limited") {
      logger.log("Rate limited, stopping");
      sendAutosubmitEvent({ type: "RATE_LIMITED" });
      break;
    }

    if (!startOutcome || startOutcome.type !== "generating") {
      logger.log("Generation did not start, stopping");
      sendAutosubmitEvent({ type: "TIMEOUT" });
      break;
    }

    // Generation started
    sendAutosubmitEvent({ type: "GENERATING" });

    // Capture the expected post ID now that generation has started
    // (URL changes to new UUID when generation begins)
    const newPostId = getCurrentPostId();
    if (newPostId !== context.initialPostId) {
      context.expectedPostId = newPostId;
      logger.log(`${logPrefix}Expected post ID: ${context.expectedPostId}`);
    }

    // Wait for outcome (success, moderated, or rate limited)
    // Use context-aware detection to catch moderation-by-removal scenarios
    logger.log("Waiting for generation outcome...");
    const outcome = await waitForOutcomeWithContext(
      ["success", "moderated", "rate_limited"],
      TIMEOUTS.attemptTimeout,
      signal,
      context,
    );

    if (signal.aborted) break;

    if (!outcome) {
      // Timeout - treat like moderated, retry if attempts remain
      if (attempt < maxRetries) {
        logger.log(`${logPrefix}Timeout on attempt ${attempt}, retrying...`);
        sendAutosubmitEvent({ type: "MODERATED" }); // Triggers retry logic in machine
        await new Promise((resolve) => setTimeout(resolve, TIMEOUTS.retryDelay));

        // For extend mode, recover before retrying
        if (isExtend && extendSourceVideoId) {
          logger.log(
            `${logPrefix}Recovering extend mode for video: ${extendSourceVideoId}`,
          );
          const recoveryResult =
            await recoverExtendModeForVideo(extendSourceVideoId);
          if (!recoveryResult.success) {
            logger.error(
              `${logPrefix}Failed to recover extend mode: ${recoveryResult.error}`,
            );
            sendAutosubmitEvent({ type: "RECOVERY_FAILED" });
            break;
          }
          sendAutosubmitEvent({ type: "RECOVERED" });
          await new Promise((resolve) => setTimeout(resolve, TIMEOUTS.uiSettle));
        }

        sendAutosubmitEvent({ type: "RETRY" });
        continue;
      } else {
        logger.log(`${logPrefix}Timeout, max retries reached`);
        sendAutosubmitEvent({ type: "TIMEOUT" });
        break;
      }
    }

    logger.log(`Outcome: ${outcome.type}`);

    if (outcome.type === "success") {
      logger.log("Video generated successfully!");
      sendAutosubmitEvent({ type: "SUCCESS" });
      break;
    }

    if (outcome.type === "rate_limited") {
      logger.log("Rate limited, stopping");
      sendAutosubmitEvent({ type: "RATE_LIMITED" });
      break;
    }

    if (outcome.type === "moderated") {
      // Send MODERATED event to machine - it will decide if we can retry
      sendAutosubmitEvent({ type: "MODERATED" });

      if (attempt < maxRetries) {
        logger.log(`${logPrefix}Moderated, retrying in ${TIMEOUTS.retryDelay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, TIMEOUTS.retryDelay));

        // For extend mode, we need to recover: navigate back to source video and re-enter extend mode
        if (isExtend && extendSourceVideoId) {
          logger.log(
            `${logPrefix}Recovering extend mode for video: ${extendSourceVideoId}`,
          );
          const recoveryResult =
            await recoverExtendModeForVideo(extendSourceVideoId);
          if (!recoveryResult.success) {
            logger.error(
              `${logPrefix}Failed to recover extend mode: ${recoveryResult.error}`,
            );
            sendAutosubmitEvent({ type: "RECOVERY_FAILED" });
            break;
          }
          sendAutosubmitEvent({ type: "RECOVERED" });
          // Brief delay after recovery before retrying
          await new Promise((resolve) => setTimeout(resolve, TIMEOUTS.uiSettle));
        }

        sendAutosubmitEvent({ type: "RETRY" });
        continue; // Next attempt
      } else {
        logger.log(`${logPrefix}Moderated, max retries reached`);
        // Machine already knows max_retries from the MODERATED event
        break;
      }
    }
  }

  // Clean up
  autosubmitAbortController = null;
  if (autosubmitActor) {
    autosubmitActor.stop();
    autosubmitActor = null;
  }
  logger.log("Autosubmit finished, final state:", getAutosubmitState());
}

/** Aborts the running autosubmit loop and updates state to cancelled. */
function cancelAutosubmit(): void {
  if (autosubmitAbortController) {
    logger.log("Cancelling autosubmit");
    autosubmitAbortController.abort();
    sendAutosubmitEvent({ type: "CANCEL" });
    broadcastAutosubmitStatus();
  }
}

// =============================================================================
// URL/ID Extraction
// =============================================================================

/** Extracts the post ID from the current URL path (e.g., /imagine/post/{id}). */
function getPostId(): string | null {
  const pathname = window.location.pathname;
  const match = pathname.match(/^\/imagine\/post\/([^/]+)/);
  return match ? match[1] : null;
}

/**
 * Extracts the source image/video UUID from the page.
 * Checks images first (for image-to-video posts), then falls back to video src
 * (for single-video posts without carousel).
 */
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

  // Fourth pass: extract from video src or poster (for single-video posts without carousel)
  const videos = document.querySelectorAll<HTMLVideoElement>("video");
  for (const video of videos) {
    // Check video src: share-videos/{uuid}.mp4
    const src = video.src || "";
    const shareMatch = src.match(/share-videos\/([0-9a-f-]+)\.mp4/i);
    if (shareMatch && shareMatch[1] && uuidPattern.test(shareMatch[1])) {
      return shareMatch[1];
    }
    // Check for generated video pattern
    const generatedMatch = src.match(
      /generated\/([0-9a-f-]+)\/generated_video\.mp4/i,
    );
    if (
      generatedMatch &&
      generatedMatch[1] &&
      uuidPattern.test(generatedMatch[1])
    ) {
      return generatedMatch[1];
    }
    // Check video poster: share-videos/{uuid}_thumbnail.jpg
    const poster = video.poster || "";
    const posterMatch = poster.match(/share-videos\/([0-9a-f-]+)_thumbnail/i);
    if (posterMatch && posterMatch[1] && uuidPattern.test(posterMatch[1])) {
      return posterMatch[1];
    }
  }

  return null;
}

/** Notifies background script of a mode change via runtime messaging. */
function sendModeUpdate(mode: Mode): void {
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

/** Creates a debounced version of a function that delays invocation by the specified delay. */
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

/** Sets up a MutationObserver to detect DOM changes that might indicate mode changes. */
function setupMutationObserver(): void {
  const observer = new MutationObserver(() => {
    debouncedModeCheck();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

/** Patches history.pushState/replaceState to detect SPA navigation changes. */
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

/** Saves a prompt to history via background script (content scripts can't access IndexedDB). */
async function saveToPostHistory(postId: string, text: string): Promise<void> {
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
async function saveToExtendHistory(
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

// Listen for messages from popup or background
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === ContentMessageType.GET_MODE) {
    // For both post and post-extend modes, return the source image / video ID
    const isPostMode = currentMode === "post" || currentMode === "post-extend";
    sendResponse({
      mode: currentMode,
      postId: isPostMode ? getPostId() : null,
      sourceImageId: isPostMode ? getSourceImageId() : null,
    });
    return true;
  }

  if (message.type === PromptMessageType.FILL_AND_SUBMIT) {
    const result = fillAndSubmitVideo(message.text);
    sendResponse(result);
    return true;
  }

  if (message.type === PromptMessageType.SUBMIT_FROM_CLIPBOARD) {
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

  if (message.type === PromptMessageType.CLICK_VIDEO_OPTION) {
    (async () => {
      const result = await clickVideoOption(message.option);
      sendResponse(result);
    })();
    return true; // Keep channel open for async response
  }

  if (message.type === PromptMessageType.CLICK_DOWNLOAD) {
    const result = clickDownloadButton();
    sendResponse(result);
    return true;
  }

  if (message.type === PromptMessageType.EXTEND_VIDEO) {
    (async () => {
      // If already in extend mode, just click Make video
      if (isInExtendMode()) {
        logger.log("Already in extend mode, clicking Make video");
        const result = clickMakeVideoButton();
        sendResponse(result);
        return;
      }

      // Otherwise, open menu and click Extend video
      logger.log("Opening More options menu to click Extend video");
      const menuResult = await clickExtendVideoFromMenu();
      if (!menuResult.success) {
        sendResponse(menuResult);
        return;
      }

      // Wait for form to change to extend mode
      const exitBtn = await waitForElement(
        'button[aria-label="Exit extend mode"]',
        1000,
      );
      if (!exitBtn) {
        sendResponse({ success: false, error: "Extend mode did not activate" });
        return;
      }

      // Small delay to let UI settle
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Click Make video
      const submitResult = clickMakeVideoButton();
      sendResponse(submitResult);
    })();
    return true; // Keep channel open for async response
  }

  if (message.type === PromptMessageType.CAROUSEL_PREV) {
    const result = navigateVideoCarousel("prev");
    sendResponse(result);
    return true;
  }

  if (message.type === PromptMessageType.CAROUSEL_NEXT) {
    const result = navigateVideoCarousel("next");
    sendResponse(result);
    return true;
  }

  // Extend mode handlers
  if (message.type === PromptMessageType.EXTEND_FOCUS) {
    (async () => {
      logger.log("[extend] EXTEND_FOCUS received");

      // If not in extend mode, enter it first
      if (!isInExtendMode()) {
        const result = await clickExtendVideoFromMenu();
        if (!result.success) {
          sendResponse(result);
          return;
        }
        // Wait for extend mode UI
        const exitBtn = await waitForElement(
          'button[aria-label="Exit extend mode"]',
          1000,
        );
        if (!exitBtn) {
          sendResponse({
            success: false,
            error: "Extend mode did not activate",
          });
          return;
        }
        await new Promise((r) => setTimeout(r, 100));
      }

      // Focus the prompt input
      const tiptapEditor = document.querySelector<HTMLElement>(
        'div.tiptap.ProseMirror[contenteditable="true"]',
      );
      if (tiptapEditor) {
        tiptapEditor.focus();
        logger.log("[extend] Focused prompt input");
        sendResponse({ success: true });
      } else {
        sendResponse({ success: false, error: "Could not find prompt input" });
      }
    })();
    return true;
  }

  if (message.type === PromptMessageType.FILL_AND_SUBMIT_EXTEND) {
    (async () => {
      // Use getPostId() for extend video - we want the VIDEO's UUID from the URL,
      // not the source image's UUID. This must match what autosubmit uses.
      const videoId = getPostId();
      if (!videoId) {
        sendResponse({ success: false, error: "No video ID" });
        return;
      }

      logger.log(
        "[extend] FILL_AND_SUBMIT_EXTEND:",
        message.text.substring(0, 30),
      );

      // Save to extend history
      try {
        await saveToExtendHistory(videoId, message.text);
      } catch (error) {
        logger.error("[extend] Failed to save to extend history:", error);
      }

      // Fill and submit
      const result = fillAndSubmitVideo(message.text);
      sendResponse(result);
    })();
    return true;
  }

  if (message.type === PromptMessageType.SUBMIT_FROM_CLIPBOARD_EXTEND) {
    (async () => {
      // Use getPostId() for extend video - we want the VIDEO's UUID from the URL,
      // not the source image's UUID. This must match what autosubmit uses.
      const videoId = getPostId();
      if (!videoId) {
        sendResponse({ success: false, error: "No video ID" });
        return;
      }

      try {
        const text = await navigator.clipboard.readText();
        const trimmed = text.trim();

        if (!trimmed) {
          sendResponse({ success: false, error: "Clipboard is empty" });
          return;
        }

        logger.log(
          "[extend] SUBMIT_FROM_CLIPBOARD_EXTEND:",
          trimmed.substring(0, 30),
        );

        // Save to extend history
        try {
          await saveToExtendHistory(videoId, trimmed);
        } catch (error) {
          logger.error("[extend] Failed to save to extend history:", error);
        }

        // Fill and submit
        const result = fillAndSubmitVideo(trimmed);
        sendResponse(result);
      } catch (error) {
        logger.error("[extend] Clipboard read failed:", error);
        sendResponse({ success: false, error: "Failed to read clipboard" });
      }
    })();
    return true;
  }

  // Autosubmit message handlers
  if (message.type === AutosubmitMessageType.START) {
    const { maxRetries, isExtend } = message;
    logger.log(
      `Received autosubmit:start with maxRetries=${maxRetries}, isExtend=${isExtend}`,
    );

    // Run asynchronously
    (async () => {
      await runAutosubmit(maxRetries, isExtend || false);
    })();

    sendResponse({ success: true });
    return true;
  }

  if (message.type === AutosubmitMessageType.CANCEL) {
    logger.log("Received autosubmit:cancel");
    cancelAutosubmit();
    sendResponse({ success: true, state: getAutosubmitState() });
    return true;
  }

  if (message.type === AutosubmitMessageType.GET_STATE) {
    const state = getAutosubmitState();
    logger.log("Received autosubmit:getState, state:", state);
    sendResponse({ state });
    return true;
  }

  return false;
});

/** Clicks the download button on the page to download the current video. */
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

/** Extracts the image/video UUID from a masonry card element's img/video src or alt. */
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
      logger.log("Checking img src:", img.src);
      // Pattern: imagine-public/images/{uuid}.jpg (standard images)
      const imgMatch = img.src.match(
        /imagine-public\/images\/([0-9a-f-]+)\.jpg/i,
      );
      logger.log("imgMatch result:", imgMatch);
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
      // Pattern: imagine-public.x.ai/imagine-public/share-videos/{uuid}_thumbnail.jpg
      const shareVideoThumbMatch = img.src.match(
        /share-videos\/([0-9a-f-]+)_thumbnail\.jpg/i,
      );
      if (
        shareVideoThumbMatch &&
        shareVideoThumbMatch[1] &&
        uuidPattern.test(shareVideoThumbMatch[1])
      ) {
        return shareVideoThumbMatch[1];
      }
    }

    // Fallback: check alt attribute (used on results page where src is base64)
    if (img.alt && uuidPattern.test(img.alt)) {
      return img.alt;
    }
  }

  return null;
}

/** Traverses up the DOM to find the masonry card container from a click target. */
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

/** Sets up Alt+Shift+Click handler to open images/videos in new background tabs. */
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
      logger.log("Alt+Shift+Click on:", target.tagName, target.className);
      const card = findMasonryCard(target);

      if (!card) {
        logger.log("No card found for target");
        return;
      }
      logger.log("Found card:", card.className);

      // Prevent default click behavior
      e.preventDefault();
      e.stopPropagation();

      // Try direct DOM extraction first (works for favorites and cached images)
      let imageId = getImageIdFromCard(card);
      logger.log("getImageIdFromCard result:", imageId);

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
        chrome.runtime.sendMessage({ type: ContentMessageType.OPEN_TAB, url });
      } else {
        logger.log("Could not extract image/video ID from card");
      }
    },
    true,
  ); // Use capture phase to intercept before React handlers
}

/** Initializes the content script: detects mode, sets up observers and handlers. */
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
