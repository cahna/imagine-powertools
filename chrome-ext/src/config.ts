/**
 * Centralized configuration constants for the Imagine Power Tools extension.
 * All magic numbers and configurable values live here.
 */

/** Timeout durations in milliseconds. */
export const TIMEOUTS = {
  /** Debounce delay for mode change detection. */
  debounce: 100,

  /** Delay for menu animation to complete. */
  menuAnimation: 50,

  /** Maximum time to wait for menu to appear after click. */
  menuWait: 1_000,

  /** Time to wait for form expansion after focusing input. */
  formExpansion: 1000,

  /** Maximum time to wait for generation to start after submission. */
  generationStart: 10_000,

  /** Maximum time for a single generation attempt. */
  attemptTimeout: 5 * 60_000,

  /** Delay before retrying after moderation/timeout. */
  retryDelay: 1_000,

  /** Time to wait for UI to settle after extend mode recovery. */
  extendModeRecovery: 1_500,

  /** Brief delay for UI to settle after state changes. */
  uiSettle: 300,

  /** Default timeout for waitForElement. */
  waitForElement: 2_000,

  /** Delay between synthetic click and checking for navigation. */
  navigationPoll: 50,

  /** Maximum number of navigation poll attempts. */
  navigationPollAttempts: 20,

  /** Delay before clicking button after filling input (React sync). */
  inputToButtonDelay: 50,

  /** Delay for extend mode activation check. */
  extendModeActivation: 1_000,

  /** Polling interval for video load check in recovery. */
  videoLoadPoll: 500,

  /** Maximum attempts for video load polling. */
  videoLoadPollAttempts: 6,

  /** Menu animation delay for extend video. */
  extendMenuAnimation: 1_000,
} as const;

/** Autosubmit feature configuration. */
export const AUTOSUBMIT = {
  /** Default maximum retry attempts. */
  defaultMaxRetries: 10,
} as const;

/** LRU cache configuration. */
export const CACHE = {
  /** Maximum number of entries in the history cache. */
  maxSize: 100,
} as const;

/** URL patterns for extracting UUIDs. */
export const URL_PATTERNS = {
  /** UUID regex pattern. */
  uuid: /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,

  /** Post page URL pattern. */
  postPath: /^\/imagine\/post\/([^/]+)/,

  /** Source image URL patterns (ordered by preference). */
  sourceImage: [
    /imagine-public\/images\/([0-9a-f-]+)\.jpg/i,
    /generated\/([0-9a-f-]+)\/preview_image\.jpg/i,
    /share-videos\/([0-9a-f-]+)_thumbnail\.jpg/i,
  ],

  /** Video URL patterns (ordered by preference). */
  video: [
    /share-videos\/([0-9a-f-]+)\.mp4/i,
    /generated\/([0-9a-f-]+)\/generated_video\.mp4/i,
  ],
} as const;

/** Page path patterns for mode detection. */
export const PATHS = {
  favorites: ["/imagine/favorites", "/imagine/saved"],
  favoritesPrefix: "/imagine/saved/",
  post: "/imagine/post/",
  imagine: "/imagine",
} as const;
