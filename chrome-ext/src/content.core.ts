// Core functions extracted for testability
// These are imported by both content.ts and tests

import { logger } from "./shared/logger";

export type Mode = "favorites" | "results" | "post" | "post-extend" | "none";

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

// Find a menu item by its text content
export function findMenuItemByText(text: string): Element | null {
  const menuItems = document.querySelectorAll(
    'div[role="menuitem"][data-radix-collection-item]',
  );
  for (const item of menuItems) {
    if (item.textContent?.includes(text)) {
      return item;
    }
  }
  return null;
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

// Fill the video prompt and click the Make video button
// Supports both old UI (textarea) and new UI (tiptap contenteditable)
export function fillAndSubmitVideo(text: string): {
  success: boolean;
  error?: string;
} {
  // Try new UI first: contenteditable div with tiptap ProseMirror
  const contentEditable = document.querySelector<HTMLDivElement>(
    'div.tiptap.ProseMirror[contenteditable="true"]',
  );

  if (contentEditable) {
    setTiptapContent(contentEditable, text);
  } else {
    // Fallback to old UI: textarea
    const textarea = document.querySelector<HTMLTextAreaElement>(
      'textarea[aria-label="Make a video"]',
    );

    if (!textarea) {
      return { success: false, error: "Could not find video prompt input" };
    }

    setReactInputValue(textarea, text);
  }

  // Find and click the Make video button (same aria-label in both UIs)
  const makeVideoBtn = document.querySelector<HTMLButtonElement>(
    'button[aria-label="Make video"]',
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

// Click a mood option from the Settings dropdown menu
export async function clickMoodOptionFromMenu(
  option: string,
): Promise<{ success: boolean; error?: string }> {
  const settingsBtn = document.querySelector<HTMLButtonElement>(
    'button[aria-label="Settings"]',
  );

  if (!settingsBtn) {
    return { success: false, error: "Settings button not found" };
  }

  // Check if menu is already open
  const isOpen = settingsBtn.getAttribute("aria-expanded") === "true";

  if (!isOpen) {
    settingsBtn.focus();

    // Dispatch pointer events (Radix UI uses these)
    settingsBtn.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        cancelable: true,
        pointerType: "mouse",
      }),
    );
    settingsBtn.dispatchEvent(
      new PointerEvent("pointerup", {
        bubbles: true,
        cancelable: true,
        pointerType: "mouse",
      }),
    );
    settingsBtn.dispatchEvent(
      new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
      }),
    );

    // Wait for menu to appear
    const menuContent = await waitForElement("[data-radix-menu-content]", 1000);
    if (!menuContent) {
      return { success: false, error: "Settings menu did not open" };
    }

    // Small delay for menu animation
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  // Capitalize first letter for matching (e.g., "spicy" -> "Spicy")
  const moodText = option.charAt(0).toUpperCase() + option.slice(1);
  const targetElement = findMenuItemByText(moodText);

  if (!targetElement) {
    return {
      success: false,
      error: `Mood option "${option}" not found in menu`,
    };
  }

  (targetElement as HTMLElement).click();
  return { success: true };
}

// Click a video option (duration, resolution, or mood)
// Handles collapsed form state by expanding it first for duration/resolution
// In extend mode, duration options are "+6s" and "+10s" instead of "6s" and "10s"
export async function clickVideoOption(
  option: string,
): Promise<{ success: boolean; error?: string }> {
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
        return {
          success: false,
          error: "Could not find text input to expand form",
        };
      }

      // Focus the editor to trigger form expansion
      tiptapEditor.focus();

      // Wait for radiogroup to appear (form expansion animation)
      const appeared = await waitForElement(
        `[role="radiogroup"][aria-label="${radioGroupLabel}"]`,
        1000,
      );
      if (!appeared) {
        return {
          success: false,
          error: "Form did not expand - radiogroup not found",
        };
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
          return { success: true };
        }
      }
    }

    return {
      success: false,
      error: `Option "${displayOption}" not found in radiogroup`,
    };
  }

  // Mood options require opening the Settings menu
  if (["spicy", "fun", "normal"].includes(option)) {
    return await clickMoodOptionFromMenu(option);
  }

  return { success: false, error: `Unknown option: ${option}` };
}

// =============================================================================
// Extend Video Helpers
// =============================================================================

/**
 * Check if the UI is currently in "extend video" mode.
 * Detects the "Extend video" placeholder text in the tiptap editor,
 * which is always present in extend mode regardless of focus state.
 */
export function isInExtendMode(): boolean {
  // Check for the "Extend video" placeholder in the editor
  // This is a <p> element inside the tiptap editor with data-placeholder="Extend video"
  const extendPlaceholder = document.querySelector(
    '[data-placeholder="Extend video"]',
  );
  return extendPlaceholder !== null;
}

// Click the Make video button
export function clickMakeVideoButton(): { success: boolean; error?: string } {
  const makeBtn = document.querySelector<HTMLButtonElement>(
    'button[aria-label="Make video"]',
  );
  if (!makeBtn) {
    return { success: false, error: "Make video button not found" };
  }
  makeBtn.click();
  return { success: true };
}

/**
 * Recovers extend mode for a specific video after moderation.
 * 1. Navigates to the video in the carousel
 * 2. Waits for the video to load
 * 3. Enters extend mode
 */
export async function recoverExtendModeForVideo(
  videoId: string,
): Promise<{ success: boolean; error?: string }> {
  // Step 1: Navigate to the source video in the carousel
  if (!selectCarouselItemByVideoId(videoId)) {
    return {
      success: false,
      error: `Could not find video ${videoId} in carousel`,
    };
  }

  // Step 2: Wait for the video to load (poll for up to 3 seconds)
  let outcome: GenerationOutcome = { type: "unknown" };
  for (let i = 0; i < 6; i++) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    outcome = detectGenerationOutcome();
    logger.log(
      `recoverExtendModeForVideo: attempt ${i + 1}, state=${outcome.type}`,
    );
    if (outcome.type === "success") {
      break;
    }
  }

  // Verify we're now showing a valid video (not moderated)
  if (outcome.type !== "success") {
    return {
      success: false,
      error: `Video ${videoId} is not valid (state: ${outcome.type})`,
    };
  }

  // Extra delay for UI to fully settle after carousel selection
  logger.log("recoverExtendModeForVideo: waiting for UI to settle");
  await new Promise((resolve) => setTimeout(resolve, 1500));

  // Step 3: Enter extend mode
  const extendResult = await clickExtendVideoFromMenu();
  if (!extendResult.success) {
    return extendResult;
  }

  // Wait for extend mode to activate (check for "Extend video" placeholder)
  const extendPlaceholder = await waitForElement(
    '[data-placeholder="Extend video"]',
    5000,
  );
  if (!extendPlaceholder) {
    return { success: false, error: "Extend mode did not activate" };
  }

  logger.log(`Recovered extend mode for video: ${videoId}`);
  return { success: true };
}

// Open the "More options" menu and click "Extend video"
export async function clickExtendVideoFromMenu(): Promise<{
  success: boolean;
  error?: string;
}> {
  logger.log("clickExtendVideoFromMenu: starting");

  // 1. Check for successful video first
  const outcome = detectGenerationOutcome();
  if (outcome.type !== "success") {
    return {
      success: false,
      error: `No successful video (current: ${outcome.type})`,
    };
  }

  // 2. Find and click "More options" button
  const moreOptionsBtn = document.querySelector<HTMLButtonElement>(
    'button[aria-label="More options"]',
  );
  if (!moreOptionsBtn) {
    return { success: false, error: "More options button not found" };
  }

  // 3. Check if menu is already open
  const isOpen = moreOptionsBtn.getAttribute("aria-expanded") === "true";
  logger.log(`clickExtendVideoFromMenu: menu isOpen=${isOpen}`);

  if (!isOpen) {
    // Open menu with pointer events (like clickMoodOptionFromMenu)
    moreOptionsBtn.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        cancelable: true,
        pointerType: "mouse",
      }),
    );
    moreOptionsBtn.dispatchEvent(
      new PointerEvent("pointerup", {
        bubbles: true,
        cancelable: true,
        pointerType: "mouse",
      }),
    );
    moreOptionsBtn.dispatchEvent(
      new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
      }),
    );

    // 4. Wait for menu to appear
    const menuContent = await waitForElement("[data-radix-menu-content]", 1000);
    if (!menuContent) {
      return { success: false, error: "More options menu did not open" };
    }

    // Small delay for menu animation
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  // 5. Find and click "Extend video" menuitem
  const menuItem = findMenuItemByText("Extend video");
  if (!menuItem) {
    // Log available menu items for debugging
    const allItems = document.querySelectorAll(
      "[data-radix-menu-content] [role='menuitem']",
    );
    const itemTexts = Array.from(allItems)
      .map((el) => el.textContent?.trim())
      .filter(Boolean);
    logger.log(`Available menu items: ${JSON.stringify(itemTexts)}`);
    return { success: false, error: "Extend video menu item not found" };
  }

  logger.log(
    `Clicking Extend video menu item: "${(menuItem as HTMLElement).textContent?.trim()}"`,
  );
  // Use pointer events for more realistic click (like menu open)
  const menuItemEl = menuItem as HTMLElement;
  menuItemEl.dispatchEvent(
    new PointerEvent("pointerdown", {
      bubbles: true,
      cancelable: true,
      pointerType: "mouse",
    }),
  );
  menuItemEl.dispatchEvent(
    new PointerEvent("pointerup", {
      bubbles: true,
      cancelable: true,
      pointerType: "mouse",
    }),
  );
  menuItemEl.dispatchEvent(
    new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
    }),
  );

  // 6. Wait for UI animation to complete
  await new Promise((resolve) => setTimeout(resolve, 1000));

  logger.log("clickExtendVideoFromMenu completed");
  return { success: true };
}

// =============================================================================
// Autosubmit Detection Helpers
// =============================================================================

export type GenerationOutcome =
  | { type: "generating"; progress?: string }
  | { type: "success" }
  | { type: "moderated" }
  | { type: "rate_limited" }
  | { type: "unknown" };

// Detect current generation state from DOM
export function detectGenerationOutcome(): GenerationOutcome {
  // Check for rate limit toast first (highest priority - stop immediately)
  // Note: aria-label may include keyboard shortcut hint (e.g., "Notifications alt+T")
  const notifications = document.querySelector(
    'section[aria-label^="Notifications"]',
  );
  if (notifications?.textContent?.includes("Rate limit reached")) {
    logger.log("Detected: rate_limited");
    return { type: "rate_limited" };
  }

  // Check for generation in progress BEFORE checking for video
  // (page may have existing video from previous generation)
  const pulsingElement = document.querySelector(".animate-pulse");
  if (pulsingElement?.textContent?.includes("Generating")) {
    const match = pulsingElement.textContent.match(/Generating\s*(\d+%)?/);
    const progress = match?.[1];
    return { type: "generating", progress };
  }

  // Alternative: Cancel Video button indicates generation in progress
  const cancelBtn = Array.from(document.querySelectorAll("button")).find(
    (btn) => btn.textContent?.includes("Cancel Video"),
  );
  if (cancelBtn) {
    return { type: "generating" };
  }

  // Check for moderated result - multiple patterns
  // Pattern 1: Original img[alt="Moderated"]
  const moderatedImg = document.querySelector<HTMLImageElement>(
    'img[alt="Moderated"]',
  );
  if (moderatedImg) {
    logger.log("Detected: moderated (img alt)");
    return { type: "moderated" };
  }

  // Pattern 2: Large eye-off icon in preview area (moderated carousel item selected)
  if (isPreviewAreaModerated()) {
    logger.log("Detected: moderated (preview eye-off)");
    return { type: "moderated" };
  }

  // Pattern 3: Selected carousel item has eye-off icon
  if (isSelectedCarouselItemModerated()) {
    logger.log("Detected: moderated (carousel eye-off)");
    return { type: "moderated" };
  }

  // Check for successful video (video element with .mp4 src)
  // Only reaches here if no active generation is in progress
  const sdVideo = document.querySelector<HTMLVideoElement>("video#sd-video");
  const hdVideo = document.querySelector<HTMLVideoElement>("video#hd-video");
  if (sdVideo?.src?.includes(".mp4") || hdVideo?.src?.includes(".mp4")) {
    logger.log("Detected: success (video found)");
    return { type: "success" };
  }

  return { type: "unknown" };
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

/** Count carousel items in the video carousel. */
export function getCarouselItemCount(): number {
  const container = document.querySelector("div.snap-y.snap-mandatory");
  if (!container) return 0;
  return container.querySelectorAll("button.snap-center").length;
}

/** Check if the currently selected carousel item has the moderated (eye-off) icon. */
export function isSelectedCarouselItemModerated(): boolean {
  const container = document.querySelector("div.snap-y.snap-mandatory");
  if (!container) return false;

  const buttons = container.querySelectorAll("button.snap-center");
  for (const btn of buttons) {
    if (btn.classList.contains("ring-fg-primary")) {
      // Check for eye-off icon (lucide-eye-off class)
      return btn.querySelector(".lucide-eye-off") !== null;
    }
  }
  return false;
}

/** Check if the main preview area shows a moderated state (large eye-off icon). */
export function isPreviewAreaModerated(): boolean {
  // Check for the large eye-off icon in the preview area
  const eyeOffIcon = document.querySelector(".lucide-eye-off.size-24");
  return eyeOffIcon !== null;
}

/**
 * Finds and clicks a carousel item by matching video ID in its thumbnail URL.
 * Video IDs appear in patterns like:
 * - .../generated/{uuid}/preview_image.jpg
 * - .../share-videos/{uuid}_thumbnail.jpg
 */
export function selectCarouselItemByVideoId(videoId: string): boolean {
  const container = document.querySelector("div.snap-y.snap-mandatory");
  if (!container) return false;

  const buttons = Array.from(
    container.querySelectorAll("button.snap-center"),
  ) as HTMLButtonElement[];

  for (const btn of buttons) {
    const img = btn.querySelector("img");
    if (!img?.src) continue;

    // Check if this thumbnail's URL contains the video ID
    if (img.src.includes(videoId)) {
      btn.click();
      logger.log(`Selected carousel item for video: ${videoId}`);
      return true;
    }
  }

  logger.log(`Could not find carousel item for video: ${videoId}`);
  return false;
}

/** Selects the first non-moderated carousel item. Returns true if successful. */
export function selectFirstValidCarouselItem(): boolean {
  const container = document.querySelector("div.snap-y.snap-mandatory");
  if (!container) return false;

  const buttons = Array.from(
    container.querySelectorAll("button.snap-center"),
  ) as HTMLButtonElement[];

  for (const btn of buttons) {
    // Skip moderated items (have eye-off icon)
    if (btn.querySelector(".lucide-eye-off")) {
      continue;
    }
    // Found a valid item, click it
    btn.click();
    logger.log("Selected first valid carousel item");
    return true;
  }

  return false;
}

/** Navigates up/down through the video carousel on post pages. */
export function navigateVideoCarousel(direction: "prev" | "next"): {
  success: boolean;
  error?: string;
} {
  // Find the scrollable carousel container
  const container = document.querySelector("div.snap-y.snap-mandatory");
  if (!container) {
    return { success: false, error: "Carousel not found" };
  }

  // Find all thumbnail buttons
  const buttons = Array.from(
    container.querySelectorAll("button.snap-center"),
  ) as HTMLButtonElement[];
  if (buttons.length === 0) {
    return { success: false, error: "No thumbnails found" };
  }

  // Find currently selected button (has ring-fg-primary class)
  const currentIndex = buttons.findIndex((btn) =>
    btn.classList.contains("ring-fg-primary"),
  );

  // Calculate target index (no wrapping - stop at boundaries)
  let targetIndex: number;
  if (currentIndex === -1) {
    targetIndex = 0; // Default to first if none selected
  } else if (direction === "next") {
    if (currentIndex >= buttons.length - 1) {
      return { success: true }; // Already at last, do nothing
    }
    targetIndex = currentIndex + 1;
  } else {
    if (currentIndex <= 0) {
      return { success: true }; // Already at first, do nothing
    }
    targetIndex = currentIndex - 1;
  }

  // Click the target button
  buttons[targetIndex].click();
  return { success: true };
}
