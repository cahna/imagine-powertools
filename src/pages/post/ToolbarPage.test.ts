import { describe, it, expect, beforeEach, vi } from "vitest";
import { ToolbarPage } from "./ToolbarPage";

describe("ToolbarPage", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  describe("isPresent()", () => {
    it("returns true when download button exists", () => {
      document.body.innerHTML = `
        <button aria-label="Download">Download</button>
      `;

      const toolbar = new ToolbarPage();
      expect(toolbar.isPresent()).toBe(true);
    });

    it("returns false when download button does not exist", () => {
      document.body.innerHTML = `<div>No toolbar</div>`;

      const toolbar = new ToolbarPage();
      expect(toolbar.isPresent()).toBe(false);
    });
  });

  describe("isVideoModeSelected()", () => {
    it("returns true when video button is selected", () => {
      document.body.innerHTML = `
        <div aria-label="Media type selection">
          <button class="bg-button-filled">Video</button>
          <button>Image</button>
        </div>
      `;

      const toolbar = new ToolbarPage();
      expect(toolbar.isVideoModeSelected()).toBe(true);
    });

    it("returns false when image button is selected", () => {
      document.body.innerHTML = `
        <div aria-label="Media type selection">
          <button>Video</button>
          <button class="bg-button-filled">Image</button>
        </div>
      `;

      const toolbar = new ToolbarPage();
      expect(toolbar.isVideoModeSelected()).toBe(false);
    });

    it("returns false when media type switcher not found", () => {
      document.body.innerHTML = `<div>No switcher</div>`;

      const toolbar = new ToolbarPage();
      expect(toolbar.isVideoModeSelected()).toBe(false);
    });
  });

  describe("isImageModeSelected()", () => {
    it("returns true when image button is selected", () => {
      document.body.innerHTML = `
        <div aria-label="Media type selection">
          <button>Video</button>
          <button class="bg-button-filled">Image</button>
        </div>
      `;

      const toolbar = new ToolbarPage();
      expect(toolbar.isImageModeSelected()).toBe(true);
    });

    it("returns false when video button is selected", () => {
      document.body.innerHTML = `
        <div aria-label="Media type selection">
          <button class="bg-button-filled">Video</button>
          <button>Image</button>
        </div>
      `;

      const toolbar = new ToolbarPage();
      expect(toolbar.isImageModeSelected()).toBe(false);
    });

    it("returns false when media type switcher not found", () => {
      document.body.innerHTML = `<div>No switcher</div>`;

      const toolbar = new ToolbarPage();
      expect(toolbar.isImageModeSelected()).toBe(false);
    });
  });

  describe("clickDownload()", () => {
    it("clicks download button when present", () => {
      document.body.innerHTML = `
        <button aria-label="Download">Download</button>
      `;

      const button = document.querySelector("button")!;
      const clickSpy = vi.fn();
      button.addEventListener("click", clickSpy);

      const toolbar = new ToolbarPage();
      const result = toolbar.clickDownload();

      expect(result.isOk()).toBe(true);
      expect(clickSpy).toHaveBeenCalled();
    });

    it("returns error when download button not found", () => {
      document.body.innerHTML = `<div>No button</div>`;

      const toolbar = new ToolbarPage();
      const result = toolbar.clickDownload();

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("element_not_found");
      }
    });
  });

  describe("clickSave()", () => {
    it("clicks save button when present", () => {
      document.body.innerHTML = `
        <button aria-label="Save">Save</button>
      `;

      const button = document.querySelector("button")!;
      const clickSpy = vi.fn();
      button.addEventListener("click", clickSpy);

      const toolbar = new ToolbarPage();
      const result = toolbar.clickSave();

      expect(result.isOk()).toBe(true);
      expect(clickSpy).toHaveBeenCalled();
    });

    it("clicks unsave button when save not present", () => {
      document.body.innerHTML = `
        <button aria-label="Unsave">Unsave</button>
      `;

      const button = document.querySelector("button")!;
      const clickSpy = vi.fn();
      button.addEventListener("click", clickSpy);

      const toolbar = new ToolbarPage();
      const result = toolbar.clickSave();

      expect(result.isOk()).toBe(true);
      expect(clickSpy).toHaveBeenCalled();
    });

    it("returns error when neither save nor unsave button found", () => {
      document.body.innerHTML = `<div>No button</div>`;

      const toolbar = new ToolbarPage();
      const result = toolbar.clickSave();

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("element_not_found");
      }
    });
  });

  describe("clickShare()", () => {
    it("clicks share button when present", () => {
      document.body.innerHTML = `
        <button aria-label="Share">Share</button>
      `;

      const button = document.querySelector("button")!;
      const clickSpy = vi.fn();
      button.addEventListener("click", clickSpy);

      const toolbar = new ToolbarPage();
      const result = toolbar.clickShare();

      expect(result.isOk()).toBe(true);
      expect(clickSpy).toHaveBeenCalled();
    });

    it("returns error when share button not found", () => {
      document.body.innerHTML = `<div>No button</div>`;

      const toolbar = new ToolbarPage();
      const result = toolbar.clickShare();

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("element_not_found");
      }
    });
  });

  describe("clickRedo()", () => {
    it("clicks redo button when present", () => {
      document.body.innerHTML = `
        <button aria-label="Redo">Redo</button>
      `;

      const button = document.querySelector("button")!;
      const clickSpy = vi.fn();
      button.addEventListener("click", clickSpy);

      const toolbar = new ToolbarPage();
      const result = toolbar.clickRedo();

      expect(result.isOk()).toBe(true);
      expect(clickSpy).toHaveBeenCalled();
    });

    it("returns error when redo button not found", () => {
      document.body.innerHTML = `<div>No button</div>`;

      const toolbar = new ToolbarPage();
      const result = toolbar.clickRedo();

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("element_not_found");
      }
    });
  });

  describe("moreOptionsMenu", () => {
    it("has moreOptionsMenu property that is a MoreOptionsMenu instance", () => {
      const toolbar = new ToolbarPage();
      expect(toolbar.moreOptionsMenu).toBeDefined();
      expect(toolbar.moreOptionsMenu.isPresent).toBeDefined();
      expect(toolbar.moreOptionsMenu.open).toBeDefined();
    });

    it("moreOptionsMenu shares same document scope", () => {
      const customDoc = document.implementation.createHTMLDocument("Custom");
      customDoc.body.innerHTML = `
        <button aria-label="More options">...</button>
      `;

      const toolbar = new ToolbarPage(customDoc);

      expect(toolbar.moreOptionsMenu.isPresent()).toBe(true);
    });
  });

  describe("document injection", () => {
    it("scopes queries to injected document", () => {
      document.body.innerHTML = `<div>No toolbar in global doc</div>`;

      const customDoc = document.implementation.createHTMLDocument("Custom");
      customDoc.body.innerHTML = `
        <button aria-label="Download">Download</button>
        <button aria-label="Save">Save</button>
        <div aria-label="Media type selection">
          <button class="bg-button-filled">Video</button>
          <button>Image</button>
        </div>
      `;

      const toolbar = new ToolbarPage(customDoc);

      expect(toolbar.isPresent()).toBe(true);
      expect(toolbar.isVideoModeSelected()).toBe(true);
    });
  });
});
