import { describe, it, expect, beforeEach, vi } from "vitest";
import { showInterceptModal } from "./modal";

describe("showInterceptModal", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("renders modal overlay with correct structure", () => {
    showInterceptModal("test-id", "https://test.com/api", '{"foo":"bar"}');

    const overlay = document.querySelector(".ipt-modal-overlay");
    expect(overlay).not.toBeNull();
    expect(overlay?.id).toBe("ipt-modal-test-id");

    const container = overlay?.querySelector(".ipt-modal-container");
    expect(container).not.toBeNull();

    const header = container?.querySelector(".ipt-modal-header");
    expect(header).not.toBeNull();

    const title = header?.querySelector(".ipt-modal-title");
    expect(title?.textContent).toBe("Edit Request Payload");

    const url = header?.querySelector(".ipt-modal-url");
    expect(url?.textContent).toBe("https://test.com/api");
  });

  it("formats JSON payload with indentation", () => {
    showInterceptModal("test-id", "https://test.com", '{"foo":"bar","baz":123}');

    const textarea = document.querySelector<HTMLTextAreaElement>(
      ".ipt-modal-textarea",
    );
    expect(textarea?.value).toContain('"foo": "bar"');
    expect(textarea?.value).toContain('"baz": 123');
  });

  it("handles invalid JSON payload gracefully", () => {
    showInterceptModal("test-id", "https://test.com", "not valid json");

    const textarea = document.querySelector<HTMLTextAreaElement>(
      ".ipt-modal-textarea",
    );
    expect(textarea?.value).toBe("not valid json");
  });

  it("escapes HTML in URL to prevent XSS", () => {
    showInterceptModal(
      "test-id",
      'https://test.com/<script>alert("xss")</script>',
      "{}",
    );

    const url = document.querySelector(".ipt-modal-url");
    expect(url?.innerHTML).not.toContain("<script>");
    expect(url?.textContent).toContain("<script>");
  });

  it("escapes HTML in payload to prevent XSS", () => {
    showInterceptModal(
      "test-id",
      "https://test.com",
      '{"html":"<script>alert(1)</script>"}',
    );

    const textarea = document.querySelector<HTMLTextAreaElement>(
      ".ipt-modal-textarea",
    );
    expect(textarea?.value).toContain("<script>");
  });

  it("resolves with cancel action when cancel button clicked", async () => {
    const promise = showInterceptModal("test-id", "https://test.com", "{}");

    const cancelBtn = document.querySelector<HTMLButtonElement>(
      ".ipt-modal-btn-cancel",
    );
    cancelBtn?.click();

    const result = await promise;
    expect(result.action).toBe("cancel");
    expect(result.payload).toBeUndefined();
  });

  it("removes modal from DOM when cancel clicked", async () => {
    const promise = showInterceptModal("test-id", "https://test.com", "{}");

    const cancelBtn = document.querySelector<HTMLButtonElement>(
      ".ipt-modal-btn-cancel",
    );
    cancelBtn?.click();

    await promise;
    expect(document.querySelector(".ipt-modal-overlay")).toBeNull();
  });

  it("resolves with proceed action and payload when send clicked", async () => {
    const promise = showInterceptModal(
      "test-id",
      "https://test.com",
      '{"original":"value"}',
    );

    const textarea = document.querySelector<HTMLTextAreaElement>(
      ".ipt-modal-textarea",
    );
    textarea!.value = '{"modified": "data"}';
    textarea?.dispatchEvent(new Event("input"));

    const sendBtn = document.querySelector<HTMLButtonElement>(
      ".ipt-modal-btn-send",
    );
    sendBtn?.click();

    const result = await promise;
    expect(result.action).toBe("proceed");
    expect(result.payload).toBe('{"modified":"data"}');
  });

  it("minifies JSON payload when sending", async () => {
    const promise = showInterceptModal("test-id", "https://test.com", "{}");

    const textarea = document.querySelector<HTMLTextAreaElement>(
      ".ipt-modal-textarea",
    );
    textarea!.value = `{
      "key": "value",
      "number": 42
    }`;
    textarea?.dispatchEvent(new Event("input"));

    const sendBtn = document.querySelector<HTMLButtonElement>(
      ".ipt-modal-btn-send",
    );
    sendBtn?.click();

    const result = await promise;
    expect(result.payload).toBe('{"key":"value","number":42}');
  });

  it("disables send button when JSON is invalid", () => {
    showInterceptModal("test-id", "https://test.com", "{}");

    const textarea = document.querySelector<HTMLTextAreaElement>(
      ".ipt-modal-textarea",
    );
    const sendBtn = document.querySelector<HTMLButtonElement>(
      ".ipt-modal-btn-send",
    );

    // Initially valid
    expect(sendBtn?.disabled).toBe(false);

    // Make invalid
    textarea!.value = "not valid json";
    textarea?.dispatchEvent(new Event("input"));

    expect(sendBtn?.disabled).toBe(true);
  });

  it("shows error message when JSON is invalid", () => {
    showInterceptModal("test-id", "https://test.com", "{}");

    const textarea = document.querySelector<HTMLTextAreaElement>(
      ".ipt-modal-textarea",
    );
    const errorDiv = document.querySelector(".ipt-modal-error");

    // Initially hidden
    expect(errorDiv?.classList.contains("ipt-hidden")).toBe(true);

    // Make invalid
    textarea!.value = "not valid json";
    textarea?.dispatchEvent(new Event("input"));

    expect(errorDiv?.classList.contains("ipt-hidden")).toBe(false);
    expect(errorDiv?.textContent).toContain("Invalid JSON");
  });

  it("re-enables send button when JSON becomes valid again", () => {
    showInterceptModal("test-id", "https://test.com", "{}");

    const textarea = document.querySelector<HTMLTextAreaElement>(
      ".ipt-modal-textarea",
    );
    const sendBtn = document.querySelector<HTMLButtonElement>(
      ".ipt-modal-btn-send",
    );

    // Make invalid
    textarea!.value = "invalid";
    textarea?.dispatchEvent(new Event("input"));
    expect(sendBtn?.disabled).toBe(true);

    // Make valid again
    textarea!.value = '{"valid": true}';
    textarea?.dispatchEvent(new Event("input"));
    expect(sendBtn?.disabled).toBe(false);
  });

  it("resolves with cancel when Escape key pressed", async () => {
    const promise = showInterceptModal("test-id", "https://test.com", "{}");

    const overlay = document.querySelector(".ipt-modal-overlay");
    overlay?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));

    const result = await promise;
    expect(result.action).toBe("cancel");
  });

  it("resolves with cancel when clicking outside modal container", async () => {
    const promise = showInterceptModal("test-id", "https://test.com", "{}");

    const overlay = document.querySelector(".ipt-modal-overlay");
    // Click directly on overlay (not on container)
    overlay?.dispatchEvent(
      new MouseEvent("click", { bubbles: true, target: overlay } as MouseEventInit),
    );

    const result = await promise;
    expect(result.action).toBe("cancel");
  });

  it("does not cancel when clicking inside modal container", () => {
    showInterceptModal("test-id", "https://test.com", "{}");

    const container = document.querySelector(".ipt-modal-container");
    container?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    // Modal should still be present
    expect(document.querySelector(".ipt-modal-overlay")).not.toBeNull();
  });
});
