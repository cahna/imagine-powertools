// Core functions extracted for testability
// These are imported by both content.ts and tests

import { logger } from "./shared/logger";
import { TIMEOUTS } from "./config";
import {
  NotificationsPage,
  GenerationStatusPage,
  VideoCarouselPage,
  VideoPromptPage,
  SettingsMenuPage,
  type GenerationOutcome,
} from "./pages";
import { Result, ok, err } from "./shared/result";
import type { DomError } from "./shared/errors";

// Re-export GenerationOutcome type from PageObjects
export type { GenerationOutcome };

export type Mode = "favorites" | "results" | "post" | "post-extend" | "none";

// Module-level PageObject instances (use global document by default)
const notificationsPage = new NotificationsPage();
const generationStatusPage = new GenerationStatusPage();
const videoCarouselPage = new VideoCarouselPage();
const videoPromptPage = new VideoPromptPage();
const settingsMenuPage = new SettingsMenuPage();

// Detect the current mode based on URL and page content
export function detectMode(): Mode {
  const pathname = window.location.pathname;

  if (
    pathname === "/imagine/favorites" ||
    pathname === "/imagine/saved" ||
    pathname.startsWith("/imagine/saved/")
  ) {
    return "favorites";
  }

  if (pathname.startsWith("/imagine/post/")) {
    // Check for extend mode first (Exit extend mode button present)
    if (isInExtendMode()) {
      logger.log("[extend] detectMode() -> post-extend");
      return "post-extend";
    }
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

// Wait for an element to appear in the DOM
export function waitForElement(
  selector: string,
  timeout = 2000,
): Promise<Element | null> {
  return new Promise((resolve) => {
    // Check if element already exists
    const existing = document.querySelector(selector);
    if (existing) {
      resolve(existing);
      return;
    }

    const timeoutId = setTimeout(() => {
      observer.disconnect();
      resolve(null);
    }, timeout);

    const observer = new MutationObserver(() => {
      const element = document.querySelector(selector);
      if (element) {
        clearTimeout(timeoutId);
        observer.disconnect();
        resolve(element);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  });
}

/** Finds a menu item by its text content. */
export function findMenuItemByText(text: string): Element | null {
  return settingsMenuPage.findMenuItem(text);
}

// Set value on a React-controlled input/textarea
export function setReactInputValue(
  element: HTMLInputElement | HTMLTextAreaElement,
  value: string,
): void {
  // Get the native setter from the prototype
  const prototype =
    element instanceof HTMLTextAreaElement
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

// Set content in a tiptap/ProseMirror contenteditable element
export function setTiptapContent(element: HTMLElement, text: string): void {
  // Focus the element
  element.focus();

  // Select all existing content
  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(element);
  selection?.removeAllRanges();
  selection?.addRange(range);

  // Insert new text (this replaces the selection and triggers tiptap's internal events)
  document.execCommand("insertText", false, text);
}

/** Fills the video prompt and clicks the Make video button. */
export function fillAndSubmitVideo(text: string): Result<void, DomError> {
  return videoPromptPage.fillAndSubmit(text);
}

/** Clicks a mood option from the Settings dropdown menu. */
export async function clickMoodOptionFromMenu(
  option: string,
): Promise<Result<void, DomError>> {
  // Open menu if needed
  const openResult = settingsMenuPage.openSettingsMenu();
  if (openResult.isErr()) {
    return openResult;
  }

  // Wait for menu to appear if it wasn't already open
  if (!settingsMenuPage.isSettingsMenuOpen()) {
    const menuContent = await waitForElement(
      "[data-radix-menu-content]",
      TIMEOUTS.menuWait,
    );
    if (!menuContent) {
      return err({ type: "menu_not_open", menu: "settings" });
    }
    // Small delay for menu animation
    await new Promise((resolve) => setTimeout(resolve, TIMEOUTS.menuAnimation));
  }

  // Click the mood option
  return settingsMenuPage.clickMoodOption(option);
}

// Click a video option (duration, resolution, or mood)
// Handles collapsed form state by expanding it first for duration/resolution
// In extend mode, duration options are "+6s" and "+10s" instead of "6s" and "10s"
export async function clickVideoOption(
  option: string,
): Promise<Result<void, DomError>> {
  // Check if we're in extend mode for duration option transformation
  const inExtendMode = isInExtendMode();

  // Duration and resolution options use radiogroups
  if (["6s", "10s", "480p", "720p"].includes(option)) {
    const isResolution = ["480p", "720p"].includes(option);
    const radioGroupLabel = isResolution
      ? "Video resolution"
      : "Video duration";

    // In extend mode, duration options are "+6s" and "+10s"
    let displayOption = option;
    if (inExtendMode && (option === "6s" || option === "10s")) {
      displayOption = "+" + option;
      logger.log(
        `[extend] Transformed duration option: ${option} -> ${displayOption}`,
      );
    }

    // Check if radiogroup is already visible
    let radioGroup = document.querySelector(
      `[role="radiogroup"][aria-label="${radioGroupLabel}"]`,
    );

    // If not visible, form is collapsed - click the text input to expand it
    if (!radioGroup) {
      const tiptapEditor = document.querySelector<HTMLElement>(
        'div.tiptap.ProseMirror[contenteditable="true"]',
      );

      if (!tiptapEditor) {
        return err({
          type: "element_not_found",
          element: "tiptap editor (form collapsed)",
        });
      }

      // Focus the editor to trigger form expansion
      tiptapEditor.focus();

      // Wait for radiogroup to appear (form expansion animation)
      const appeared = await waitForElement(
        `[role="radiogroup"][aria-label="${radioGroupLabel}"]`,
        1000,
      );
      if (!appeared) {
        return err({
          type: "element_not_found",
          element: `radiogroup "${radioGroupLabel}"`,
        });
      }

      radioGroup = appeared;
    }

    // Find the radio button by checking for the option text in nested spans
    const buttons = radioGroup.querySelectorAll<HTMLButtonElement>(
      'button[role="radio"]',
    );
    for (const btn of buttons) {
      const spans = btn.querySelectorAll("span");
      for (const span of spans) {
        if (span.textContent?.trim() === displayOption) {
          btn.click();
          return ok(undefined);
        }
      }
    }

    return err({
      type: "element_not_found",
      element: `radio option "${displayOption}"`,
    });
  }

  // Mood options require opening the Settings menu
  if (["spicy", "fun", "normal"].includes(option)) {
    return await clickMoodOptionFromMenu(option);
  }

  return err({
    type: "invalid_state",
    expected: "6s|10s|480p|720p|spicy|fun|normal",
    actual: option,
  });
}

// =============================================================================
// Extend Video Helpers
// =============================================================================

/** Checks if the UI is currently in "extend video" mode. */
export function isInExtendMode(): boolean {
  return videoPromptPage.isInExtendMode();
}

/** Clicks the Make video button. */
export function clickMakeVideoButton(): Result<void, DomError> {
  return videoPromptPage.submit();
}

/**
 * Recovers extend mode for a specific video after moderation.
 * 1. Navigates to the video in the carousel
 * 2. Waits for the video to load
 * 3. Enters extend mode
 */
export async function recoverExtendModeForVideo(
  videoId: string,
): Promise<Result<void, DomError>> {
  // Step 1: Navigate to the source video in the carousel
  const selectResult = videoCarouselPage.selectByVideoId(videoId);
  if (selectResult.isErr()) {
    return selectResult;
  }

  // Step 2: Wait for the video to load (poll for up to 3 seconds)
  let outcome: GenerationOutcome = { type: "unknown" };
  for (let i = 0; i < 6; i++) {
    await new Promise((resolve) => setTimeout(resolve, TIMEOUTS.videoLoadPoll));
    outcome = generationStatusPage.detectOutcome();
    logger.log(
      `recoverExtendModeForVideo: attempt ${i + 1}, state=${outcome.type}`,
    );
    if (outcome.type === "success") {
      break;
    }
  }

  // Verify we're now showing a valid video (not moderated)
  if (outcome.type !== "success") {
    return err({
      type: "invalid_state",
      expected: "success",
      actual: outcome.type,
    });
  }

  // Extra delay for UI to fully settle after carousel selection
  logger.log("recoverExtendModeForVideo: waiting for UI to settle");
  await new Promise((resolve) =>
    setTimeout(resolve, TIMEOUTS.extendModeRecovery),
  );

  // Step 3: Enter extend mode
  const extendResult = await clickExtendVideoFromMenu();
  if (extendResult.isErr()) {
    return extendResult;
  }

  // Wait for extend mode to activate (check for "Extend video" placeholder)
  const extendPlaceholder = await waitForElement(
    '[data-placeholder="Extend video"]',
    TIMEOUTS.extendModeActivation,
  );
  if (!extendPlaceholder) {
    return err({
      type: "timeout",
      operation: "extend mode activation",
      ms: TIMEOUTS.extendModeActivation,
    });
  }

  logger.log(`Recovered extend mode for video: ${videoId}`);
  return ok(undefined);
}

/** Opens the "More options" menu and clicks "Extend video". */
export async function clickExtendVideoFromMenu(): Promise<
  Result<void, DomError>
> {
  logger.log("clickExtendVideoFromMenu: starting");

  // 1. Check for successful video first
  const outcome = generationStatusPage.detectOutcome();
  if (outcome.type !== "success") {
    return err({
      type: "invalid_state",
      expected: "success",
      actual: outcome.type,
    });
  }

  // 2. Open more options menu
  const openResult = settingsMenuPage.openMoreOptionsMenu();
  if (openResult.isErr()) {
    return openResult;
  }

  // 3. Wait for menu to appear if it wasn't already open
  if (!settingsMenuPage.isMoreOptionsMenuOpen()) {
    const menuContent = await waitForElement(
      "[data-radix-menu-content]",
      TIMEOUTS.menuWait,
    );
    if (!menuContent) {
      return err({ type: "menu_not_open", menu: "more options" });
    }
    // Small delay for menu animation
    await new Promise((resolve) => setTimeout(resolve, TIMEOUTS.menuAnimation));
  }

  // 4. Click "Extend video" menuitem
  const clickResult = settingsMenuPage.clickExtendVideo();
  if (clickResult.isErr()) {
    // Log available menu items for debugging
    const allItems = document.querySelectorAll(
      "[data-radix-menu-content] [role='menuitem']",
    );
    const itemTexts = Array.from(allItems)
      .map((el) => el.textContent?.trim())
      .filter(Boolean);
    logger.log(`Available menu items: ${JSON.stringify(itemTexts)}`);
    return clickResult;
  }

  // 5. Wait for UI animation to complete
  await new Promise((resolve) =>
    setTimeout(resolve, TIMEOUTS.extendMenuAnimation),
  );

  logger.log("clickExtendVideoFromMenu completed");
  return ok(undefined);
}

// =============================================================================
// Autosubmit Detection Helpers
// =============================================================================

/** Detects current generation state from DOM. */
export function detectGenerationOutcome(): GenerationOutcome {
  return generationStatusPage.detectOutcome();
}

// =============================================================================
// Context-Aware Generation Detection
// =============================================================================

export interface GenerationContext {
  initialPostId: string | null;
  initialCarouselCount: number;
  expectedPostId: string | null; // Set when generation starts and URL changes
}

/** Create initial context before starting a generation attempt. */
export function captureGenerationContext(): GenerationContext {
  return {
    initialPostId: getCurrentPostId(),
    initialCarouselCount: getCarouselItemCount(),
    expectedPostId: null,
  };
}

/**
 * Detect generation outcome with context validation.
 * Returns 'moderated' if the URL reverted or carousel item was removed.
 */
export function detectGenerationOutcomeWithContext(
  context: GenerationContext,
): GenerationOutcome {
  // First, run standard detection
  const outcome = detectGenerationOutcome();

  // If we detected generating, rate_limited, or moderated - trust it
  if (outcome.type !== "success" && outcome.type !== "unknown") {
    return outcome;
  }

  // For "success" - validate against context
  if (outcome.type === "success" && context.expectedPostId) {
    const currentPostId = getCurrentPostId();

    // If URL reverted to a different post, this is NOT our success
    if (currentPostId !== context.expectedPostId) {
      logger.log(
        `Detected: moderated (URL reverted from ${context.expectedPostId} to ${currentPostId})`,
      );
      return { type: "moderated" };
    }
  }

  // For "unknown" with context - check if carousel item was removed
  if (outcome.type === "unknown" && context.expectedPostId) {
    const currentPostId = getCurrentPostId();
    if (currentPostId !== context.expectedPostId) {
      // URL changed away from our generation - likely moderated and removed
      logger.log("Detected: moderated (unexpected URL change)");
      return { type: "moderated" };
    }
  }

  return outcome;
}

// Wait for a specific outcome with timeout and abort signal support
export function waitForOutcome(
  targetTypes: GenerationOutcome["type"][],
  timeout: number,
  signal?: AbortSignal,
): Promise<GenerationOutcome | null> {
  return new Promise((resolve) => {
    // Check if already aborted
    if (signal?.aborted) {
      logger.log("waitForOutcome: already aborted");
      resolve(null);
      return;
    }

    // Check immediately first
    const immediate = detectGenerationOutcome();
    if (targetTypes.includes(immediate.type)) {
      logger.log(`waitForOutcome: immediate match (${immediate.type})`);
      resolve(immediate);
      return;
    }

    const timeoutId = setTimeout(() => {
      logger.log("waitForOutcome: timeout");
      observer.disconnect();
      signal?.removeEventListener("abort", abortHandler);
      resolve(null);
    }, timeout);

    const abortHandler = () => {
      logger.log("waitForOutcome: aborted");
      clearTimeout(timeoutId);
      observer.disconnect();
      resolve(null);
    };

    signal?.addEventListener("abort", abortHandler);

    const observer = new MutationObserver(() => {
      const outcome = detectGenerationOutcome();
      if (targetTypes.includes(outcome.type)) {
        logger.log(`waitForOutcome: match found (${outcome.type})`);
        clearTimeout(timeoutId);
        signal?.removeEventListener("abort", abortHandler);
        observer.disconnect();
        resolve(outcome);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  });
}

/** Wait for a specific outcome with context validation for more accurate detection. */
export function waitForOutcomeWithContext(
  targetTypes: GenerationOutcome["type"][],
  timeout: number,
  signal: AbortSignal | undefined,
  context: GenerationContext,
): Promise<GenerationOutcome | null> {
  return new Promise((resolve) => {
    // Check if already aborted
    if (signal?.aborted) {
      logger.log("waitForOutcomeWithContext: already aborted");
      resolve(null);
      return;
    }

    // Check immediately first
    const immediate = detectGenerationOutcomeWithContext(context);
    if (targetTypes.includes(immediate.type)) {
      logger.log(
        `waitForOutcomeWithContext: immediate match (${immediate.type})`,
      );
      resolve(immediate);
      return;
    }

    const timeoutId = setTimeout(() => {
      logger.log("waitForOutcomeWithContext: timeout");
      observer.disconnect();
      signal?.removeEventListener("abort", abortHandler);
      resolve(null);
    }, timeout);

    const abortHandler = () => {
      logger.log("waitForOutcomeWithContext: aborted");
      clearTimeout(timeoutId);
      observer.disconnect();
      resolve(null);
    };

    signal?.addEventListener("abort", abortHandler);

    const observer = new MutationObserver(() => {
      const outcome = detectGenerationOutcomeWithContext(context);
      if (targetTypes.includes(outcome.type)) {
        logger.log(`waitForOutcomeWithContext: match found (${outcome.type})`);
        clearTimeout(timeoutId);
        signal?.removeEventListener("abort", abortHandler);
        observer.disconnect();
        resolve(outcome);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  });
}

// =============================================================================
// Video Carousel Navigation
// =============================================================================

/** Get post ID from current URL pathname. */
export function getCurrentPostId(): string | null {
  const match = window.location.pathname.match(/^\/imagine\/post\/([^/]+)/);
  return match ? match[1] : null;
}

/** Counts carousel items in the video carousel. */
export function getCarouselItemCount(): number {
  return videoCarouselPage.getItems().length;
}

/** Checks if the currently selected carousel item has the moderated (eye-off) icon. */
export function isSelectedCarouselItemModerated(): boolean {
  const index = videoCarouselPage.getSelectedIndex();
  if (index === -1) return false;
  const items = videoCarouselPage.getItems();
  return videoCarouselPage.isItemModerated(items[index]);
}

/** Checks if the main preview area shows a moderated state (large eye-off icon). */
export function isPreviewAreaModerated(): boolean {
  return generationStatusPage.isModerated();
}

/** Finds and clicks a carousel item by matching video ID in its thumbnail URL. */
export function selectCarouselItemByVideoId(
  videoId: string,
): Result<void, DomError> {
  const result = videoCarouselPage.selectByVideoId(videoId);
  if (result.isOk()) {
    logger.log(`Selected carousel item for video: ${videoId}`);
  } else {
    logger.log(`Could not find carousel item for video: ${videoId}`);
  }
  return result;
}

/** Selects the first non-moderated carousel item. */
export function selectFirstValidCarouselItem(): Result<void, DomError> {
  const result = videoCarouselPage.selectFirstValid();
  if (result.isOk()) {
    logger.log("Selected first valid carousel item");
  }
  return result;
}

/** Navigates up/down through the video carousel on post pages. */
export function navigateVideoCarousel(
  direction: "prev" | "next",
): Result<void, DomError> {
  if (!videoCarouselPage.isPresent()) {
    return err({ type: "element_not_found", element: "video carousel" });
  }

  if (direction === "next") {
    return videoCarouselPage.navigateNext();
  } else {
    return videoCarouselPage.navigatePrev();
  }
}
