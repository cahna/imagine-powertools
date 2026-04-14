/**
 * Page script for fetch() interception.
 * Runs in the page's main world (not isolated content script).
 * Communicates with content script via window.postMessage.
 *
 * This script is injected via a <script> tag and must be self-contained.
 * NOTE: This is only injected when intercept feature is enabled.
 * Tiptap content handling is in a separate always-injected script.
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

  /** Gets the current prompt text from tiptap editor. */
  function getEditorPrompt(): string | null {
    const el = document.querySelector(
      'div.tiptap.ProseMirror[contenteditable="true"]',
    ) as HTMLElement & {
      editor?: { getText(): string };
    };

    if (!el) return null;

    // Try editor API first, fall back to textContent
    const text = el.editor?.getText?.() || el.textContent || "";
    return text.trim() || null;
  }

  /** Checks if the UI is in extend video mode. */
  function isInExtendMode(): boolean {
    // Check for extend mode indicators in the DOM
    const exitButton = document.querySelector(
      'button[aria-label="Exit extend mode"]',
    );
    const extendPlaceholder = document.querySelector(
      '[data-placeholder="Extend video"]',
    );
    return !!(exitButton || extendPlaceholder);
  }

  /** Gets the current video ID from URL. */
  function getVideoIdFromUrl(): string | null {
    const match = window.location.pathname.match(/^\/imagine\/post\/([^/]+)/);
    return match ? match[1] : null;
  }

  /** Gets the current video duration from the video element. */
  function getVideoDuration(): number | null {
    const video = document.querySelector<HTMLVideoElement>(
      "video#sd-video, video#hd-video",
    );
    if (video && video.duration && isFinite(video.duration)) {
      return video.duration;
    }
    return null;
  }

  /** Transforms a generate-video payload to extend-video payload if needed. */
  function transformToExtendPayload(
    data: Record<string, unknown>,
    prompt: string,
  ): boolean {
    const videoConfig = (
      data.responseMetadata as Record<string, unknown> | undefined
    )?.modelConfigOverride as Record<string, unknown> | undefined;
    const modelMap = videoConfig?.modelMap as
      | Record<string, unknown>
      | undefined;
    const videoGenConfig = modelMap?.videoGenModelConfig as
      | Record<string, unknown>
      | undefined;

    if (!videoGenConfig) return false;

    // Check if already an extend payload
    if (videoGenConfig.isVideoExtension === true) {
      console.log("[ImaginePowerTools] Payload already in extend mode");
      return false;
    }

    // Get required info
    const videoId = getVideoIdFromUrl();
    const videoDuration = getVideoDuration();

    if (!videoId) {
      console.warn("[ImaginePowerTools] Cannot transform: no video ID");
      return false;
    }

    if (!videoDuration) {
      console.warn("[ImaginePowerTools] Cannot transform: no video duration");
      return false;
    }

    // Extract mode from message (e.g., "--mode=custom" -> "custom")
    const modeMatch = (data.message as string)?.match(/--mode=(\w+)/);
    const mode = modeMatch ? modeMatch[1] : "normal";

    // Preserve existing config values
    const aspectRatio = videoGenConfig.aspectRatio || "2:3";
    const videoLength = videoGenConfig.videoLength || 6;
    const resolutionName = videoGenConfig.resolutionName || "720p";

    // Transform to extend payload
    videoGenConfig.isVideoExtension = true;
    videoGenConfig.videoExtensionStartTime = videoDuration;
    videoGenConfig.extendPostId = videoId;
    videoGenConfig.stitchWithExtendPostId = true;
    videoGenConfig.originalPrompt = prompt;
    videoGenConfig.originalPostId = videoId;
    videoGenConfig.originalRefType = "ORIGINAL_REF_TYPE_VIDEO_EXTENSION";
    videoGenConfig.mode = mode;
    videoGenConfig.parentPostId = videoId;
    videoGenConfig.isVideoEdit = false;
    videoGenConfig.aspectRatio = aspectRatio;
    videoGenConfig.videoLength = videoLength;
    videoGenConfig.resolutionName = resolutionName;

    console.log("[ImaginePowerTools] Transformed to extend payload:", {
      videoId,
      videoDuration,
      mode,
    });

    return true;
  }

  /** Injects the prompt and fixes payload structure if needed. */
  function fixPayloadIfNeeded(payload: string): string {
    try {
      const data = JSON.parse(payload);
      let modified = false;

      // Get prompt from editor
      const prompt = getEditorPrompt();

      // Check if message field needs prompt injection
      const message = data.message || "";
      const hasOnlyFlags = /^(\s*--\w+=\w+\s*)*$/.test(message);
      const isEmpty = message.trim() === "";

      if ((isEmpty || hasOnlyFlags) && prompt) {
        // Preserve any existing flags
        const flags = message.trim();
        data.message = flags ? `${prompt} ${flags}` : prompt;
        modified = true;

        console.log("[ImaginePowerTools] Injected prompt into request:", {
          original: message.substring(0, 50),
          injected: data.message.substring(0, 50) + "...",
        });
      }

      // Check if we're in extend mode but payload is for generate
      const inExtendMode = isInExtendMode();
      if (inExtendMode) {
        const promptForExtend =
          prompt || data.message?.replace(/\s*--mode=\w+/, "").trim();
        if (
          promptForExtend &&
          transformToExtendPayload(data, promptForExtend)
        ) {
          modified = true;
        }
      }

      if (modified) {
        return JSON.stringify(data);
      }
    } catch (e) {
      console.warn("[ImaginePowerTools] Failed to fix payload:", e);
    }

    return payload;
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

    // Fix payload: inject prompt and transform to extend mode if needed
    payload = fixPayloadIfNeeded(payload);

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
