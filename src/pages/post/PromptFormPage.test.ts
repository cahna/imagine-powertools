import { describe, it, expect, beforeEach, vi } from "vitest";
import { PromptFormPage } from "./PromptFormPage";

describe("PromptFormPage", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  describe("isPresent()", () => {
    it("returns true when tiptap editor exists", () => {
      document.body.innerHTML = `
        <div class="tiptap ProseMirror" contenteditable="true"></div>
      `;

      const page = new PromptFormPage();
      expect(page.isPresent()).toBe(true);
    });

    it("returns true when textarea with aria-label exists", () => {
      document.body.innerHTML = `
        <textarea aria-label="Make a video"></textarea>
      `;

      const page = new PromptFormPage();
      expect(page.isPresent()).toBe(true);
    });

    it("returns true when data-testid input exists", () => {
      document.body.innerHTML = `
        <div data-testid="video-prompt-input"></div>
      `;

      const page = new PromptFormPage();
      expect(page.isPresent()).toBe(true);
    });

    it("returns false when no input exists", () => {
      document.body.innerHTML = `<div>No input</div>`;

      const page = new PromptFormPage();
      expect(page.isPresent()).toBe(false);
    });
  });

  describe("getInput()", () => {
    it("returns tiptap editor element", () => {
      document.body.innerHTML = `
        <div class="tiptap ProseMirror" contenteditable="true"></div>
      `;

      const page = new PromptFormPage();
      const input = page.getInput();

      expect(input).not.toBeNull();
      expect(input?.classList.contains("tiptap")).toBe(true);
    });

    it("returns textarea element", () => {
      document.body.innerHTML = `
        <textarea aria-label="Make a video"></textarea>
      `;

      const page = new PromptFormPage();
      const input = page.getInput();

      expect(input).not.toBeNull();
      expect(input?.tagName).toBe("TEXTAREA");
    });

    it("returns null when no input exists", () => {
      document.body.innerHTML = `<div>No input</div>`;

      const page = new PromptFormPage();
      expect(page.getInput()).toBeNull();
    });
  });

  describe("getMakeVideoButton()", () => {
    it("returns make video button with data-testid", () => {
      document.body.innerHTML = `
        <button data-testid="make-video-button">Make video</button>
      `;

      const page = new PromptFormPage();
      const button = page.getMakeVideoButton();

      expect(button).not.toBeNull();
      expect(button?.textContent).toContain("Make video");
    });

    it("returns make video button with aria-label", () => {
      document.body.innerHTML = `
        <button aria-label="Make video">Go</button>
      `;

      const page = new PromptFormPage();
      const button = page.getMakeVideoButton();

      expect(button).not.toBeNull();
    });

    it("returns null when button not found", () => {
      document.body.innerHTML = `<div>No button</div>`;

      const page = new PromptFormPage();
      expect(page.getMakeVideoButton()).toBeNull();
    });
  });

  describe("fillPrompt()", () => {
    it("fills tiptap editor with text", () => {
      document.body.innerHTML = `
        <div class="tiptap ProseMirror" contenteditable="true">Old text</div>
      `;

      // Mock execCommand for tiptap
      const originalExecCommand = document.execCommand;
      document.execCommand = vi.fn().mockReturnValue(true);

      const page = new PromptFormPage();
      const result = page.fillPrompt("New prompt text");

      expect(result.isOk()).toBe(true);
      expect(document.execCommand).toHaveBeenCalledWith(
        "insertText",
        false,
        "New prompt text",
      );

      document.execCommand = originalExecCommand;
    });

    it("fills textarea with text", () => {
      document.body.innerHTML = `
        <textarea aria-label="Make a video">Old text</textarea>
      `;

      const page = new PromptFormPage();
      const result = page.fillPrompt("New prompt text");

      expect(result.isOk()).toBe(true);

      const textarea = document.querySelector("textarea")!;
      expect(textarea.value).toBe("New prompt text");
    });

    it("returns error when no input exists", () => {
      document.body.innerHTML = `<div>No input</div>`;

      const page = new PromptFormPage();
      const result = page.fillPrompt("Some text");

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("element_not_found");
      }
    });
  });

  describe("submit()", () => {
    it("clicks make video button", () => {
      document.body.innerHTML = `
        <button aria-label="Make video">Make video</button>
      `;

      const button = document.querySelector("button")!;
      const clickSpy = vi.fn();
      button.addEventListener("click", clickSpy);

      const page = new PromptFormPage();
      const result = page.submit();

      expect(result.isOk()).toBe(true);
      expect(clickSpy).toHaveBeenCalled();
    });

    it("returns error when button not found", () => {
      document.body.innerHTML = `<div>No button</div>`;

      const page = new PromptFormPage();
      const result = page.submit();

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("element_not_found");
      }
    });
  });

  describe("fillAndSubmit()", () => {
    it("fills prompt and schedules button click", () => {
      vi.useFakeTimers();

      document.body.innerHTML = `
        <textarea aria-label="Make a video"></textarea>
        <button aria-label="Make video">Make video</button>
      `;

      const button = document.querySelector("button")!;
      const clickSpy = vi.fn();
      button.addEventListener("click", clickSpy);

      const page = new PromptFormPage();
      const result = page.fillAndSubmit("Test prompt");

      expect(result.isOk()).toBe(true);

      // Button click is scheduled with setTimeout
      expect(clickSpy).not.toHaveBeenCalled();
      vi.advanceTimersByTime(100);
      expect(clickSpy).toHaveBeenCalled();

      vi.useRealTimers();
    });

    it("returns error when input not found", () => {
      document.body.innerHTML = `
        <button aria-label="Make video">Make video</button>
      `;

      const page = new PromptFormPage();
      const result = page.fillAndSubmit("Test prompt");

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("element_not_found");
      }
    });

    it("returns error when button not found", () => {
      document.body.innerHTML = `
        <textarea aria-label="Make a video"></textarea>
      `;

      const page = new PromptFormPage();
      const result = page.fillAndSubmit("Test prompt");

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("element_not_found");
      }
    });
  });

  describe("isInExtendMode()", () => {
    it("returns true when extend placeholder exists", () => {
      document.body.innerHTML = `
        <div data-placeholder="Extend video"></div>
      `;

      const page = new PromptFormPage();
      expect(page.isInExtendMode()).toBe(true);
    });

    it("returns false when extend placeholder not found", () => {
      document.body.innerHTML = `
        <div data-placeholder="Make a video"></div>
      `;

      const page = new PromptFormPage();
      expect(page.isInExtendMode()).toBe(false);
    });
  });

  describe("focus()", () => {
    it("focuses the input element", () => {
      document.body.innerHTML = `
        <div class="tiptap ProseMirror" contenteditable="true" tabindex="0"></div>
      `;

      const input = document.querySelector(".tiptap")! as HTMLElement;
      const focusSpy = vi.fn();
      input.addEventListener("focus", focusSpy);

      const page = new PromptFormPage();
      const result = page.focus();

      expect(result.isOk()).toBe(true);
      expect(document.activeElement).toBe(input);
    });

    it("returns error when input not found", () => {
      document.body.innerHTML = `<div>No input</div>`;

      const page = new PromptFormPage();
      const result = page.focus();

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("element_not_found");
      }
    });
  });

  describe("settingsMenu", () => {
    it("has settingsMenu property that is a PromptSettingsMenu instance", () => {
      const page = new PromptFormPage();
      expect(page.settingsMenu).toBeDefined();
      expect(page.settingsMenu.isPresent).toBeDefined();
      expect(page.settingsMenu.open).toBeDefined();
    });

    it("settingsMenu shares same document scope", () => {
      const customDoc = document.implementation.createHTMLDocument("Custom");
      customDoc.body.innerHTML = `
        <button aria-label="Settings">...</button>
      `;

      const page = new PromptFormPage(customDoc);

      expect(page.settingsMenu.isPresent()).toBe(true);
    });
  });

  describe("document injection", () => {
    it("scopes queries to injected document", () => {
      document.body.innerHTML = `<div>No form in global doc</div>`;

      const customDoc = document.implementation.createHTMLDocument("Custom");
      customDoc.body.innerHTML = `
        <div class="tiptap ProseMirror" contenteditable="true"></div>
        <button aria-label="Make video">Make video</button>
      `;

      const page = new PromptFormPage(customDoc);

      expect(page.isPresent()).toBe(true);
      expect(page.getMakeVideoButton()).not.toBeNull();
    });
  });
});
