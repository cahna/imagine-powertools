/**
 * Autosubmit feature handler.
 * Manages the XState machine for automatic video generation retries.
 */

import { createActor, type Actor } from "xstate";
import {
  autosubmitMachine,
  type AutosubmitEvent,
  type StopReason,
} from "../machines/autosubmit.machine";
import { logger } from "../shared/logger";
import {
  AutosubmitMessageType,
  StorageMessageType,
  ExtendStorageMessageType,
  JobsMessageType,
} from "../shared/messageTypes";
import { TIMEOUTS } from "../config";
import {
  detectMode,
  fillAndSubmitVideo,
  waitForOutcome,
  waitForOutcomeWithContext,
  isPreviewAreaModerated,
  isSelectedCarouselItemModerated,
  selectFirstValidCarouselItem,
  captureGenerationContext,
  getCurrentPostId,
  recoverExtendModeForVideo,
} from "../content.core";
import {
  saveToPostHistory,
  saveToExtendHistory,
  type HistoryEntry,
} from "./storage";
import { getPostId, getSourceImageId } from "./urlExtraction";

/** Legacy state type for backward compatibility with popup/background communication. */
export type AutosubmitState =
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
export function getAutosubmitState(): AutosubmitState {
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
      type LegacyReason =
        | "cancelled"
        | "rate_limited"
        | "max_retries"
        | "timeout"
        | "navigated";
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
        reason: context.stopReason
          ? reasonMap[context.stopReason]
          : ("cancelled" as LegacyReason),
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
export async function runAutosubmit(
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
    const selectResult = selectFirstValidCarouselItem();
    if (selectResult.isErr()) {
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
    logger.log(
      `[machine] State: ${state.value}, attempt: ${state.context.attempt}`,
    );
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
    if (submitResult.isErr()) {
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
        await new Promise((resolve) =>
          setTimeout(resolve, TIMEOUTS.retryDelay),
        );

        // For extend mode, recover before retrying
        if (isExtend && extendSourceVideoId) {
          logger.log(
            `${logPrefix}Recovering extend mode for video: ${extendSourceVideoId}`,
          );
          const recoveryResult =
            await recoverExtendModeForVideo(extendSourceVideoId);
          if (recoveryResult.isErr()) {
            logger.error(
              `${logPrefix}Failed to recover extend mode:`,
              recoveryResult.error,
            );
            sendAutosubmitEvent({ type: "RECOVERY_FAILED" });
            break;
          }
          sendAutosubmitEvent({ type: "RECOVERED" });
          await new Promise((resolve) =>
            setTimeout(resolve, TIMEOUTS.uiSettle),
          );
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
        logger.log(
          `${logPrefix}Moderated, retrying in ${TIMEOUTS.retryDelay}ms...`,
        );
        await new Promise((resolve) =>
          setTimeout(resolve, TIMEOUTS.retryDelay),
        );

        // For extend mode, we need to recover: navigate back to source video and re-enter extend mode
        if (isExtend && extendSourceVideoId) {
          logger.log(
            `${logPrefix}Recovering extend mode for video: ${extendSourceVideoId}`,
          );
          const recoveryResult =
            await recoverExtendModeForVideo(extendSourceVideoId);
          if (recoveryResult.isErr()) {
            logger.error(
              `${logPrefix}Failed to recover extend mode:`,
              recoveryResult.error,
            );
            sendAutosubmitEvent({ type: "RECOVERY_FAILED" });
            break;
          }
          sendAutosubmitEvent({ type: "RECOVERED" });
          // Brief delay after recovery before retrying
          await new Promise((resolve) =>
            setTimeout(resolve, TIMEOUTS.uiSettle),
          );
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
export function cancelAutosubmit(): void {
  if (autosubmitAbortController) {
    logger.log("Cancelling autosubmit");
    autosubmitAbortController.abort();
    sendAutosubmitEvent({ type: "CANCEL" });
    broadcastAutosubmitStatus();
  }
}
