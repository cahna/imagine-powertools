/**
 * Content script handler for request interception.
 * Bridges page script messages to modal UI.
 */

import { showInterceptModal } from "./modal";
import { getInterceptEnabled } from "../shared/interceptSettings";

const MESSAGE_PREFIX = "IPT_INTERCEPT";

interface InterceptRequest {
  type: `${typeof MESSAGE_PREFIX}:request`;
  id: string;
  url: string;
  payload: string;
}

interface InterceptResponse {
  type: `${typeof MESSAGE_PREFIX}:response`;
  id: string;
  action: "proceed" | "cancel";
  payload?: string;
}

/** Sets up the message handler for intercept requests from page script. */
export function setupInterceptHandler(): void {
  window.addEventListener("message", async (event) => {
    // Only accept messages from the same window (page script)
    if (event.source !== window) return;
    if (event.data?.type !== `${MESSAGE_PREFIX}:request`) return;

    const request = event.data as InterceptRequest;

    // Check if intercept modal is enabled
    const interceptEnabled = await getInterceptEnabled();

    let result: { action: "proceed" | "cancel"; payload?: string };

    if (interceptEnabled) {
      // Show modal and wait for user action
      result = await showInterceptModal(
        request.id,
        request.url,
        request.payload,
      );
    } else {
      // Auto-proceed without modal (prompt injection still happened in page script)
      result = { action: "proceed", payload: request.payload };
    }

    // Send response back to page script
    const response: InterceptResponse = {
      type: `${MESSAGE_PREFIX}:response`,
      id: request.id,
      action: result.action,
      payload: result.payload,
    };

    window.postMessage(response, "*");
  });
}
