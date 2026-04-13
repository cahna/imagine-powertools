/**
 * Page script for fetch() interception.
 * Runs in the page's main world (not isolated content script).
 * Communicates with content script via window.postMessage.
 *
 * This script is injected via a <script> tag and must be self-contained.
 */

(function () {
  const MESSAGE_PREFIX = "IPT_INTERCEPT";
  const TARGET_URL = "https://grok.com/rest/app-chat/conversations/new";

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

  // Store pending requests waiting for modal response
  const pendingRequests = new Map<
    string,
    {
      resolve: (value: {
        action: "proceed" | "cancel";
        payload?: string;
      }) => void;
    }
  >();

  /** Generates a unique request ID. */
  function generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  // Listen for responses from content script
  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    if (!event.data?.type?.startsWith(`${MESSAGE_PREFIX}:response`)) return;

    const response = event.data as InterceptResponse;
    const pending = pendingRequests.get(response.id);
    if (pending) {
      pending.resolve({ action: response.action, payload: response.payload });
      pendingRequests.delete(response.id);
    }
  });

  // Store original fetch
  const originalFetch = window.fetch;

  // Override fetch
  window.fetch = async function (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    // Determine URL from input
    let url: string;
    if (typeof input === "string") {
      url = input;
    } else if (input instanceof URL) {
      url = input.href;
    } else if (input instanceof Request) {
      url = input.url;
    } else {
      url = String(input);
    }

    // Only intercept POST to target URL with a body
    const isTargetRequest =
      url === TARGET_URL &&
      init?.method?.toUpperCase() === "POST" &&
      init?.body;

    if (!isTargetRequest) {
      return originalFetch.call(window, input, init);
    }

    const id = generateId();

    // Get payload as string
    let payload: string;
    if (typeof init.body === "string") {
      payload = init.body;
    } else if (init.body instanceof Blob) {
      payload = await init.body.text();
    } else if (init.body instanceof ArrayBuffer) {
      payload = new TextDecoder().decode(init.body);
    } else if (init.body instanceof URLSearchParams) {
      payload = init.body.toString();
    } else if (init.body instanceof FormData) {
      // FormData can't be easily converted; skip interception
      return originalFetch.call(window, input, init);
    } else {
      payload = JSON.stringify(init.body);
    }

    // Send request to content script for modal display
    const message: InterceptRequest = {
      type: `${MESSAGE_PREFIX}:request`,
      id,
      url,
      payload,
    };

    window.postMessage(message, "*");

    // Wait for response from content script
    const response = await new Promise<{
      action: "proceed" | "cancel";
      payload?: string;
    }>((resolve) => {
      pendingRequests.set(id, { resolve });
    });

    if (response.action === "cancel") {
      // Throw an error to cancel the request
      throw new Error("[ImaginePowerTools] Request cancelled by user");
    }

    // Proceed with potentially modified payload
    const modifiedInit = { ...init };
    if (response.payload) {
      modifiedInit.body = response.payload;
    }

    return originalFetch.call(window, input, modifiedInit);
  };

  console.log("[ImaginePowerTools] Request interception active");
})();
