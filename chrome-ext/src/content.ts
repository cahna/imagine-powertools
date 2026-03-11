/**
 * Content script entry point for ImaginePowerTools.
 * Handles initialization and message routing.
 */

import {
  type Mode,
  detectMode,
  fillAndSubmitVideo,
  clickVideoOption,
  waitForElement,
  isInExtendMode,
  clickMakeVideoButton,
  clickExtendVideoFromMenu,
  navigateVideoCarousel,
} from "./content.core";
import { logger } from "./shared/logger";
import { SELECTORS } from "./selectors";
import {
  ContentMessageType,
  PromptMessageType,
  AutosubmitMessageType,
} from "./shared/messageTypes";
import { serialize, ok, err } from "./shared/result";
import type { DomError } from "./shared/errors";

// Import handlers
import {
  runAutosubmit,
  cancelAutosubmit,
  getAutosubmitState,
  saveToPostHistory,
  saveToExtendHistory,
  getCurrentMode,
  setCurrentMode,
  sendModeUpdate,
  setupMutationObserver,
  setupHistoryInterception,
  getPostId,
  getSourceImageId,
  setupFavoritesClickHandler,
} from "./handlers";

export type { Mode };

// =============================================================================
// Message Handlers
// =============================================================================

/** Clicks the download button on the page. */
function clickDownloadButton(): import("./shared/result").Result<
  void,
  DomError
> {
  const downloadBtn = document.querySelector<HTMLButtonElement>(
    SELECTORS.downloadButton[0],
  );

  if (!downloadBtn) {
    return err({ type: "element_not_found", element: "Download button" });
  }

  downloadBtn.click();
  return ok(undefined);
}

// Listen for messages from popup or background
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const currentMode = getCurrentMode();

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
    sendResponse(serialize(result));
    return true;
  }

  if (message.type === PromptMessageType.SUBMIT_FROM_CLIPBOARD) {
    (async () => {
      try {
        const text = await navigator.clipboard.readText();
        const trimmed = text.trim();

        if (!trimmed) {
          sendResponse(
            serialize(
              err({
                type: "invalid_state",
                expected: "non-empty clipboard",
                actual: "empty",
              } as DomError),
            ),
          );
          return;
        }

        const sourceImageId = message.sourceImageId;

        // Save to history (handles duplicates by incrementing submitCount)
        await saveToPostHistory(sourceImageId, trimmed);

        // Fill and submit
        const result = fillAndSubmitVideo(trimmed);
        sendResponse(serialize(result));
      } catch (error) {
        logger.error("Clipboard read failed:", error);
        sendResponse(
          serialize(
            err({
              type: "invalid_state",
              expected: "clipboard access",
              actual: "read failed",
            } as DomError),
          ),
        );
      }
    })();
    return true;
  }

  if (message.type === PromptMessageType.CLICK_VIDEO_OPTION) {
    (async () => {
      const result = await clickVideoOption(message.option);
      sendResponse(serialize(result));
    })();
    return true;
  }

  if (message.type === PromptMessageType.CLICK_DOWNLOAD) {
    const result = clickDownloadButton();
    sendResponse(serialize(result));
    return true;
  }

  if (message.type === PromptMessageType.EXTEND_VIDEO) {
    (async () => {
      // If already in extend mode, just click Make video
      if (isInExtendMode()) {
        logger.log("Already in extend mode, clicking Make video");
        const result = clickMakeVideoButton();
        sendResponse(serialize(result));
        return;
      }

      // Otherwise, open menu and click Extend video
      logger.log("Opening More options menu to click Extend video");
      const menuResult = await clickExtendVideoFromMenu();
      if (menuResult.isErr()) {
        sendResponse(serialize(menuResult));
        return;
      }

      // Wait for form to change to extend mode
      const exitBtn = await waitForElement(
        'button[aria-label="Exit extend mode"]',
        1000,
      );
      if (!exitBtn) {
        sendResponse(
          serialize(
            err({
              type: "timeout",
              operation: "extend mode activation",
              ms: 1000,
            } as DomError),
          ),
        );
        return;
      }

      // Small delay to let UI settle
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Click Make video
      const submitResult = clickMakeVideoButton();
      sendResponse(serialize(submitResult));
    })();
    return true;
  }

  if (message.type === PromptMessageType.CAROUSEL_PREV) {
    const result = navigateVideoCarousel("prev");
    sendResponse(serialize(result));
    return true;
  }

  if (message.type === PromptMessageType.CAROUSEL_NEXT) {
    const result = navigateVideoCarousel("next");
    sendResponse(serialize(result));
    return true;
  }

  // Extend mode handlers
  if (message.type === PromptMessageType.EXTEND_FOCUS) {
    (async () => {
      logger.log("[extend] EXTEND_FOCUS received");

      // If not in extend mode, enter it first
      if (!isInExtendMode()) {
        const result = await clickExtendVideoFromMenu();
        if (result.isErr()) {
          sendResponse(serialize(result));
          return;
        }
        // Wait for extend mode UI
        const exitBtn = await waitForElement(
          'button[aria-label="Exit extend mode"]',
          1000,
        );
        if (!exitBtn) {
          sendResponse(
            serialize(
              err({
                type: "timeout",
                operation: "extend mode activation",
                ms: 1000,
              } as DomError),
            ),
          );
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
        sendResponse(serialize(ok(undefined)));
      } else {
        sendResponse(
          serialize(
            err({
              type: "element_not_found",
              element: "prompt input",
            } as DomError),
          ),
        );
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
        sendResponse(
          serialize(
            err({
              type: "element_not_found",
              element: "video ID in URL",
            } as DomError),
          ),
        );
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
      sendResponse(serialize(result));
    })();
    return true;
  }

  if (message.type === PromptMessageType.SUBMIT_FROM_CLIPBOARD_EXTEND) {
    (async () => {
      // Use getPostId() for extend video - we want the VIDEO's UUID from the URL,
      // not the source image's UUID. This must match what autosubmit uses.
      const videoId = getPostId();
      if (!videoId) {
        sendResponse(
          serialize(
            err({
              type: "element_not_found",
              element: "video ID in URL",
            } as DomError),
          ),
        );
        return;
      }

      try {
        const text = await navigator.clipboard.readText();
        const trimmed = text.trim();

        if (!trimmed) {
          sendResponse(
            serialize(
              err({
                type: "invalid_state",
                expected: "non-empty clipboard",
                actual: "empty",
              } as DomError),
            ),
          );
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
        sendResponse(serialize(result));
      } catch (error) {
        logger.error("[extend] Clipboard read failed:", error);
        sendResponse(
          serialize(
            err({
              type: "invalid_state",
              expected: "clipboard access",
              actual: "read failed",
            } as DomError),
          ),
        );
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

// =============================================================================
// Initialization
// =============================================================================

/** Initializes the content script: detects mode, sets up observers and handlers. */
function init(): void {
  logger.log("Content script loaded");

  // Initial mode detection
  const initialMode = detectMode();
  setCurrentMode(initialMode);
  logger.log(`Initial mode: ${initialMode}`);
  sendModeUpdate(initialMode);

  // Set up observers
  setupMutationObserver();
  setupHistoryInterception();

  // Set up favorites click handler
  setupFavoritesClickHandler();
}

init();
