/**
 * Workaround interface for background tab handling.
 * Workarounds are strategies to keep autosubmit running when tabs are not focused.
 */
export interface Workaround {
  /** Unique identifier for this workaround (e.g., 'audio-keepalive') */
  id: string;

  /** Display name shown in Settings UI */
  name: string;

  /** Description explaining what this workaround does */
  description: string;

  /** Called when autosubmit starts - activate the workaround */
  start: () => Promise<void>;

  /** Called when autosubmit ends - deactivate the workaround */
  stop: () => Promise<void>;

  /** Check if the workaround is currently active */
  isActive: () => boolean;
}

/** Settings for workaround configuration stored in chrome.storage */
export interface WorkaroundSettings {
  /** List of enabled workaround IDs */
  enabledWorkarounds: string[];
}

/** Default settings - audio keep-alive enabled by default */
export const DEFAULT_WORKAROUND_SETTINGS: WorkaroundSettings = {
  enabledWorkarounds: ["audio-keepalive"],
};
