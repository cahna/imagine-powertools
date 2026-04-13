/**
 * Modal component for editing intercepted request payload.
 * Injects into the page DOM with isolated styling.
 */

export interface ModalResult {
  action: "proceed" | "cancel";
  payload?: string;
}

/** Escapes HTML special characters to prevent XSS. */
function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

/** Shows the intercept modal and waits for user action. */
export function showInterceptModal(
  requestId: string,
  url: string,
  payload: string,
): Promise<ModalResult> {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "ipt-modal-overlay";
    overlay.id = `ipt-modal-${requestId}`;

    // Format JSON for display
    let formattedPayload: string;
    try {
      formattedPayload = JSON.stringify(JSON.parse(payload), null, 2);
    } catch {
      formattedPayload = payload;
    }

    overlay.innerHTML = `
      <div class="ipt-modal-container">
        <div class="ipt-modal-header">
          <h2 class="ipt-modal-title">Edit Request Payload</h2>
          <span class="ipt-modal-url">${escapeHtml(url)}</span>
        </div>
        <div class="ipt-modal-body">
          <textarea class="ipt-modal-textarea" spellcheck="false">${escapeHtml(formattedPayload)}</textarea>
          <div class="ipt-modal-error ipt-hidden"></div>
        </div>
        <div class="ipt-modal-footer">
          <button class="ipt-modal-btn ipt-modal-btn-cancel">Cancel Request</button>
          <button class="ipt-modal-btn ipt-modal-btn-send">Send Modified</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const textarea = overlay.querySelector<HTMLTextAreaElement>(
      ".ipt-modal-textarea",
    )!;
    const errorDiv = overlay.querySelector<HTMLDivElement>(".ipt-modal-error")!;
    const cancelBtn = overlay.querySelector<HTMLButtonElement>(
      ".ipt-modal-btn-cancel",
    )!;
    const sendBtn = overlay.querySelector<HTMLButtonElement>(
      ".ipt-modal-btn-send",
    )!;

    // Focus textarea and set cursor to start
    textarea.focus();
    textarea.setSelectionRange(0, 0);

    /** Validates JSON and updates error display. */
    function validateJson(): boolean {
      try {
        JSON.parse(textarea.value);
        errorDiv.classList.add("ipt-hidden");
        sendBtn.disabled = false;
        return true;
      } catch (e) {
        errorDiv.textContent = `Invalid JSON: ${(e as Error).message}`;
        errorDiv.classList.remove("ipt-hidden");
        sendBtn.disabled = true;
        return false;
      }
    }

    /** Cleans up the modal and resolves the promise. */
    function cleanup(result: ModalResult): void {
      overlay.remove();
      resolve(result);
    }

    // Validate JSON on input
    textarea.addEventListener("input", validateJson);

    // Handle cancel
    cancelBtn.addEventListener("click", () => {
      cleanup({ action: "cancel" });
    });

    // Handle send
    sendBtn.addEventListener("click", () => {
      if (!validateJson()) return;

      try {
        const parsed = JSON.parse(textarea.value);
        const minified = JSON.stringify(parsed);
        cleanup({ action: "proceed", payload: minified });
      } catch {
        errorDiv.textContent = "Invalid JSON";
        errorDiv.classList.remove("ipt-hidden");
      }
    });

    // Handle Escape key
    const handleKeydown = (e: KeyboardEvent): void => {
      if (e.key === "Escape") {
        cleanup({ action: "cancel" });
      }
    };
    overlay.addEventListener("keydown", handleKeydown);

    // Handle click outside modal container
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        cleanup({ action: "cancel" });
      }
    });
  });
}
