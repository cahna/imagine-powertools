/**
 * Centralized DOM selectors for the Imagine Power Tools extension.
 * All selectors are ordered arrays - first match wins.
 */

/** Attempts each selector in order and returns the first matching element. */
export function selectFirst<T extends Element = Element>(
  root: Document | Element,
  selectors: readonly string[],
): T | null {
  for (const selector of selectors) {
    const el = root.querySelector<T>(selector);
    if (el) return el;
  }
  return null;
}

/** Attempts each selector in order and returns the first non-empty NodeList. */
export function selectAllFirst<T extends Element = Element>(
  root: Document | Element,
  selectors: readonly string[],
): NodeListOf<T> | null {
  for (const selector of selectors) {
    const els = root.querySelectorAll<T>(selector);
    if (els.length > 0) return els;
  }
  return null;
}

/** Attempts each selector in order and returns the element along with match metadata. */
export function selectFirstWithMatch<T extends Element = Element>(
  root: Document | Element,
  selectors: readonly string[],
): { element: T; matchedSelector: string; index: number } | null {
  for (let i = 0; i < selectors.length; i++) {
    const el = root.querySelector<T>(selectors[i]);
    if (el) {
      return {
        element: el,
        matchedSelector: selectors[i],
        index: i,
      };
    }
  }
  return null;
}

/**
 * All DOM selectors used by the extension.
 * Each property is an ordered array of selectors - first match wins.
 * Prefer data-testid when available, fall back to aria-labels, then CSS classes.
 */
export const SELECTORS = {
  /** Video prompt input field (tiptap editor or legacy textarea). */
  videoInput: [
    '[data-testid="video-prompt-input"]',
    'div.tiptap.ProseMirror[contenteditable="true"]',
    'textarea[aria-label="Make a video"]',
  ],

  /** Make video / submit button. */
  makeVideoButton: [
    '[data-testid="make-video-button"]',
    'button[aria-label="Make video"]',
  ],

  /** Video carousel (thumbnail strip). */
  carousel: {
    container: [
      '[data-testid="video-carousel"]',
      "div.snap-y.snap-mandatory",
    ],
    item: ["button.snap-center"],
    selectedClass: "ring-fg-primary",
  },

  /** Moderation indicators. */
  moderation: {
    icon: [".lucide-eye-off"],
    largeIcon: [".lucide-eye-off.size-24"],
    altImage: ['img[alt="Moderated"]'],
  },

  /** Notification toasts. */
  notifications: {
    container: ['section[aria-label^="Notifications"]'],
    rateLimitText: "Rate limit reached",
  },

  /** Settings menu button. */
  settingsButton: [
    '[data-testid="settings-button"]',
    'button[aria-label="Settings"]',
  ],

  /** More options menu button. */
  moreOptionsButton: [
    '[data-testid="more-options-button"]',
    'button[aria-label="More options"]',
  ],

  /** Menu content (Radix UI). */
  menu: {
    content: ["[data-radix-menu-content]"],
    item: ['div[role="menuitem"][data-radix-collection-item]'],
  },

  /** Generation status indicators. */
  generation: {
    progressPulse: [".animate-pulse"],
    cancelButton: ['button:has-text("Cancel Video")'],
    sdVideo: ["video#sd-video"],
    hdVideo: ["video#hd-video"],
  },

  /** Extend video mode indicators. */
  extend: {
    placeholder: ['[data-placeholder="Extend video"]'],
    exitButton: ['button[aria-label="Exit extend mode"]'],
  },

  /** Duration radiogroup. */
  duration: {
    radiogroup: ['[role="radiogroup"][aria-label="Video duration"]'],
  },

  /** Resolution radiogroup. */
  resolution: {
    radiogroup: ['[role="radiogroup"][aria-label="Video resolution"]'],
  },

  /** Navigation. */
  navigation: {
    backButton: ['button[aria-label="Back"]'],
  },

  /** Download button. */
  downloadButton: ['button[aria-label="Download"]'],
} as const;
