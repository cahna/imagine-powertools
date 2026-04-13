/**
 * Content script handler for request interception.
 * Bridges page script messages to modal UI.
 */

import { showInterceptModal } from "./modal";

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

    // Show modal and wait for user action
    const result = await showInterceptModal(
      request.id,
      request.url,
      request.payload,
    );

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
