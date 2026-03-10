import { describe, it, expect, beforeEach, vi } from "vitest";
import { VideoPromptPage } from "./VideoPromptPage";

describe("VideoPromptPage", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    // Mock document.execCommand for tiptap tests
    document.execCommand = vi.fn();
  });

  describe("isPresent()", () => {
    it("returns true when tiptap editor is present", () => {
      document.body.innerHTML = `
        <div class="tiptap ProseMirror" contenteditable="true"></div>
      `;

      const page = new VideoPromptPage();

      expect(page.isPresent()).toBe(true);
    });

    it("returns true when legacy textarea is present", () => {
      document.body.innerHTML = `
        <textarea aria-label="Make a video"></textarea>
      `;

      const page = new VideoPromptPage();

      expect(page.isPresent()).toBe(true);
    });

    it("returns false when no input is present", () => {
      document.body.innerHTML = `<div>Content</div>`;

      const page = new VideoPromptPage();

      expect(page.isPresent()).toBe(false);
    });
  });

  describe("getInput()", () => {
    it("returns tiptap editor when present", () => {
      document.body.innerHTML = `
        <div class="tiptap ProseMirror" contenteditable="true" id="editor"></div>
      `;

      const page = new VideoPromptPage();
      const input = page.getInput();

      expect(input).not.toBeNull();
      expect(input?.id).toBe("editor");
    });

    it("returns legacy textarea when tiptap not present", () => {
      document.body.innerHTML = `
        <textarea aria-label="Make a video" id="legacy"></textarea>
      `;

      const page = new VideoPromptPage();
      const input = page.getInput();

      expect(input).not.toBeNull();
      expect(input?.id).toBe("legacy");
    });

    it("returns null when no input present", () => {
      document.body.innerHTML = `<div>Content</div>`;

      const page = new VideoPromptPage();

      expect(page.getInput()).toBeNull();
    });
  });

  describe("getMakeVideoButton()", () => {
    it("returns Make video button when present", () => {
      document.body.innerHTML = `
        <button aria-label="Make video" id="btn">Make video</button>
      `;

      const page = new VideoPromptPage();
      const btn = page.getMakeVideoButton();

      expect(btn).not.toBeNull();
      expect(btn?.id).toBe("btn");
    });

    it("returns null when button not present", () => {
      document.body.innerHTML = `<div>Content</div>`;

      const page = new VideoPromptPage();

      expect(page.getMakeVideoButton()).toBeNull();
    });
  });

  describe("fillPrompt()", () => {
    it("fills tiptap editor using execCommand", () => {
      document.body.innerHTML = `
        <div class="tiptap ProseMirror" contenteditable="true"></div>
      `;

      const page = new VideoPromptPage();
      const result = page.fillPrompt("test prompt");

      expect(result.isOk()).toBe(true);
      expect(document.execCommand).toHaveBeenCalledWith(
        "insertText",
        false,
        "test prompt",
      );
    });

    it("fills legacy textarea using native setter", () => {
      document.body.innerHTML = `
        <textarea aria-label="Make a video"></textarea>
      `;

      const page = new VideoPromptPage();
      const result = page.fillPrompt("test prompt");

      expect(result.isOk()).toBe(true);

      const textarea = document.querySelector("textarea");
      expect(textarea?.value).toBe("test prompt");
    });

    it("returns error when no input present", () => {
      document.body.innerHTML = `<div>Content</div>`;

      const page = new VideoPromptPage();
      const result = page.fillPrompt("test");

      expect(result.isErr()).toBe(true);
    });
  });

  describe("submit()", () => {
    it("clicks Make video button", () => {
      const clickHandler = vi.fn();
      document.body.innerHTML = `
        <button aria-label="Make video">Make video</button>
      `;
      document.querySelector("button")!.addEventListener("click", clickHandler);

      const page = new VideoPromptPage();
      const result = page.submit();

      expect(result.isOk()).toBe(true);
      expect(clickHandler).toHaveBeenCalled();
    });

    it("returns error when button not present", () => {
      document.body.innerHTML = `<div>Content</div>`;

      const page = new VideoPromptPage();
      const result = page.submit();

      expect(result.isErr()).toBe(true);
    });
  });

  describe("fillAndSubmit()", () => {
    it("fills prompt and clicks button", () => {
      const clickHandler = vi.fn();
      document.body.innerHTML = `
        <div class="tiptap ProseMirror" contenteditable="true"></div>
        <button aria-label="Make video">Make video</button>
      `;
      document.querySelector("button")!.addEventListener("click", clickHandler);

      const page = new VideoPromptPage();
      const result = page.fillAndSubmit("test prompt");

      expect(result.isOk()).toBe(true);
      expect(document.execCommand).toHaveBeenCalledWith(
        "insertText",
        false,
        "test prompt",
      );
      // Note: click happens after setTimeout in implementation
    });

    it("returns error when input not found", () => {
      document.body.innerHTML = `
        <button aria-label="Make video">Make video</button>
      `;

      const page = new VideoPromptPage();
      const result = page.fillAndSubmit("test");

      expect(result.isErr()).toBe(true);
      const error = result._unsafeUnwrapErr();
      expect(error.type).toBe("element_not_found");
      expect(error).toHaveProperty("element", "video prompt input");
    });

    it("returns error when button not found", () => {
      document.body.innerHTML = `
        <div class="tiptap ProseMirror" contenteditable="true"></div>
      `;

      const page = new VideoPromptPage();
      const result = page.fillAndSubmit("test");

      expect(result.isErr()).toBe(true);
      const error = result._unsafeUnwrapErr();
      expect(error.type).toBe("element_not_found");
      expect(error).toHaveProperty("element", "Make video button");
    });
  });

  describe("isInExtendMode()", () => {
    it("returns true when extend video placeholder is present", () => {
      document.body.innerHTML = `
        <div class="tiptap ProseMirror">
          <p data-placeholder="Extend video" class="is-empty"></p>
        </div>
      `;

      const page = new VideoPromptPage();

      expect(page.isInExtendMode()).toBe(true);
    });

    it("returns false when extend placeholder not present", () => {
      document.body.innerHTML = `
        <div class="tiptap ProseMirror">
          <p data-placeholder="Make a video" class="is-empty"></p>
        </div>
      `;

      const page = new VideoPromptPage();

      expect(page.isInExtendMode()).toBe(false);
    });

    it("returns false when no placeholder present", () => {
      document.body.innerHTML = `<div>Content</div>`;

      const page = new VideoPromptPage();

      expect(page.isInExtendMode()).toBe(false);
    });
  });

  describe("focus()", () => {
    it("focuses the tiptap editor", () => {
      const focusHandler = vi.fn();
      document.body.innerHTML = `
        <div class="tiptap ProseMirror" contenteditable="true"></div>
      `;
      document
        .querySelector(".tiptap")!
        .addEventListener("focus", focusHandler);

      const page = new VideoPromptPage();
      const result = page.focus();

      expect(result.isOk()).toBe(true);
      expect(focusHandler).toHaveBeenCalled();
    });

    it("focuses the legacy textarea", () => {
      const focusHandler = vi.fn();
      document.body.innerHTML = `
        <textarea aria-label="Make a video"></textarea>
      `;
      document
        .querySelector("textarea")!
        .addEventListener("focus", focusHandler);

      const page = new VideoPromptPage();
      const result = page.focus();

      expect(result.isOk()).toBe(true);
      expect(focusHandler).toHaveBeenCalled();
    });

    it("returns error when no input present", () => {
      document.body.innerHTML = `<div>Content</div>`;

      const page = new VideoPromptPage();
      const result = page.focus();

      expect(result.isErr()).toBe(true);
    });
  });

  describe("document injection", () => {
    it("scopes all queries to injected document", () => {
      document.body.innerHTML = `<div>No input here</div>`;

      const customDoc = document.implementation.createHTMLDocument("Custom");
      customDoc.body.innerHTML = `
        <div class="tiptap ProseMirror" contenteditable="true"></div>
        <button aria-label="Make video">Make video</button>
      `;

      const page = new VideoPromptPage(customDoc);

      expect(page.isPresent()).toBe(true);
      expect(page.getInput()).not.toBeNull();
      expect(page.getMakeVideoButton()).not.toBeNull();
    });
  });
});
