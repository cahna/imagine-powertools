// Centralized message type constants for chrome.runtime messaging
// Using const objects instead of enums for better tree-shaking and runtime behavior

/**
 * Message types sent between content script and background script
 */
export const ContentMessageType = {
  /** Content script notifies background of page mode changes */
  MODE_CHANGE: "modeChange",
  /** Request current mode from content script */
  GET_MODE: "getMode",
  /** Open a URL in a new background tab */
  OPEN_TAB: "openTab",
} as const;

export type ContentMessageType =
  (typeof ContentMessageType)[keyof typeof ContentMessageType];

/**
 * Message types for storage operations (content script -> background)
 */
export const StorageMessageType = {
  /** Get prompt history for a specific post ID */
  GET_POST_HISTORY: "storage:getPostHistory",
  /** Save a prompt to history for a specific post ID */
  SAVE_TO_POST_HISTORY: "storage:saveToPostHistory",
} as const;

export type StorageMessageType =
  (typeof StorageMessageType)[keyof typeof StorageMessageType];

/**
 * Message types for prompt filling and submission
 */
export const PromptMessageType = {
  /** Fill the prompt input and submit the form */
  FILL_AND_SUBMIT: "fillAndSubmit",
  /** Read from clipboard and submit */
  SUBMIT_FROM_CLIPBOARD: "submitFromClipboard",
  /** Click a video option (duration, resolution, mood) */
  CLICK_VIDEO_OPTION: "clickVideoOption",
  /** Click the download button */
  CLICK_DOWNLOAD: "clickDownload",
} as const;

export type PromptMessageType =
  (typeof PromptMessageType)[keyof typeof PromptMessageType];

/**
 * Message types for autosubmit feature
 */
export const AutosubmitMessageType = {
  /** Start the autosubmit loop */
  START: "autosubmit:start",
  /** Cancel the running autosubmit loop */
  CANCEL: "autosubmit:cancel",
  /** Get current autosubmit state */
  GET_STATE: "autosubmit:getState",
  /** Broadcast autosubmit status updates */
  STATUS: "autosubmit:status",
} as const;

export type AutosubmitMessageType =
  (typeof AutosubmitMessageType)[keyof typeof AutosubmitMessageType];

/**
 * Message types for job registry (tracking autosubmit jobs across tabs)
 */
export const JobsMessageType = {
  /** Register a new autosubmit job */
  REGISTER: "jobs:register",
  /** Get all active jobs */
  GET_ALL: "jobs:getAll",
  /** Remove a job from the registry */
  REMOVE: "jobs:remove",
} as const;

export type JobsMessageType =
  (typeof JobsMessageType)[keyof typeof JobsMessageType];
