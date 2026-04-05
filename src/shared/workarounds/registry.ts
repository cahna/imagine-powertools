/**
 * Workaround registry - manages workaround instances and lifecycle.
 */

import type { Workaround } from "./types";
import { getWorkaroundSettings } from "./settings";
import { logger } from "../logger";

/** Registry of all available workarounds. */
const workaroundRegistry: Map<string, Workaround> = new Map();

/** Registers a workaround in the registry. */
export function registerWorkaround(workaround: Workaround): void {
  workaroundRegistry.set(workaround.id, workaround);
  logger.log(`[workarounds] Registered workaround: ${workaround.id}`);
}

/** Returns all registered workarounds. */
export function getAllWorkarounds(): Workaround[] {
  return Array.from(workaroundRegistry.values());
}

/** Returns a workaround by ID, or undefined if not found. */
export function getWorkaround(id: string): Workaround | undefined {
  return workaroundRegistry.get(id);
}

/** Returns all enabled workarounds based on current settings. */
export async function getEnabledWorkarounds(): Promise<Workaround[]> {
  const settings = await getWorkaroundSettings();
  const enabled: Workaround[] = [];

  for (const id of settings.enabledWorkarounds) {
    const workaround = workaroundRegistry.get(id);
    if (workaround) {
      enabled.push(workaround);
    }
  }

  return enabled;
}

/** Starts all enabled workarounds. */
export async function startWorkarounds(): Promise<void> {
  const enabled = await getEnabledWorkarounds();

  for (const workaround of enabled) {
    if (!workaround.isActive()) {
      try {
        await workaround.start();
        logger.log(`[workarounds] Started: ${workaround.id}`);
      } catch (error) {
        logger.error(`[workarounds] Failed to start ${workaround.id}:`, error);
      }
    }
  }
}

/** Stops all active workarounds. */
export async function stopWorkarounds(): Promise<void> {
  for (const workaround of workaroundRegistry.values()) {
    if (workaround.isActive()) {
      try {
        await workaround.stop();
        logger.log(`[workarounds] Stopped: ${workaround.id}`);
      } catch (error) {
        logger.error(`[workarounds] Failed to stop ${workaround.id}:`, error);
      }
    }
  }
}
