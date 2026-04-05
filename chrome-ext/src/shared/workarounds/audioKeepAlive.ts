/**
 * Silent Audio Keep-Alive workaround.
 * Plays near-silent audio to prevent browser from throttling the tab.
 * Browsers give full CPU/rendering priority to tabs with active audio playback.
 */

import type { Workaround } from "./types";
import { logger } from "../logger";

let audioElement: HTMLAudioElement | null = null;

/**
 * Base64 encoded 1-second silent WAV file.
 * Format: PCM 8-bit, 8000Hz, mono
 * This is the smallest loopable audio that browsers recognize as "active audio".
 */
const SILENT_AUDIO_DATA =
  "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";

export const audioKeepAlive: Workaround = {
  id: "audio-keepalive",
  name: "Silent Audio Keep-Alive",
  description:
    "Plays inaudible audio to prevent browser from throttling the tab. Shows speaker icon in tab.",

  async start(): Promise<void> {
    if (audioElement) {
      logger.log("[keepalive] Audio keep-alive already running");
      return;
    }

    audioElement = new Audio(SILENT_AUDIO_DATA);
    audioElement.loop = true;
    // Near-silent but not muted (muted doesn't count as active audio)
    audioElement.volume = 0.001;

    try {
      await audioElement.play();
      logger.log("[keepalive] Audio keep-alive started");
    } catch (error) {
      logger.error("[keepalive] Failed to start audio:", error);
      audioElement = null;
      throw error;
    }
  },

  async stop(): Promise<void> {
    if (!audioElement) {
      return;
    }

    audioElement.pause();
    audioElement.src = "";
    audioElement = null;
    logger.log("[keepalive] Audio keep-alive stopped");
  },

  isActive(): boolean {
    return audioElement !== null && !audioElement.paused;
  },
};
