/**
 * Workarounds module - strategies to keep autosubmit running in background tabs.
 */

// Re-export types
export type { Workaround, WorkaroundSettings } from "./types";
export { DEFAULT_WORKAROUND_SETTINGS } from "./types";

// Re-export settings helpers
export {
  getWorkaroundSettings,
  saveWorkaroundSettings,
  enableWorkaround,
  disableWorkaround,
  toggleWorkaround,
  isWorkaroundEnabled,
} from "./settings";

// Re-export registry functions
export {
  registerWorkaround,
  getAllWorkarounds,
  getWorkaround,
  getEnabledWorkarounds,
  startWorkarounds,
  stopWorkarounds,
} from "./registry";

// Import and register all workarounds
import { registerWorkaround } from "./registry";
import { audioKeepAlive } from "./audioKeepAlive";

// Auto-register all workarounds when this module is imported
registerWorkaround(audioKeepAlive);
