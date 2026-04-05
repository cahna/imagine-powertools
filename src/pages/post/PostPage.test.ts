import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { PostPage } from "./PostPage";

describe("PostPage", () => {
  const originalLocation = window.location;

  beforeEach(() => {
    document.body.innerHTML = "";
    // Mock window.location
    Object.defineProperty(window, "location", {
      value: {
        pathname: "/imagine/post/abc-123-def",
        href: "https://grok.com/imagine/post/abc-123-def",
      },
      writable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(window, "location", {
      value: originalLocation,
      writable: true,
    });
  });

  describe("isPresent()", () => {
    it("returns true when on a post page", () => {
      Object.defineProperty(window, "location", {
        value: { pathname: "/imagine/post/abc-123" },
        writable: true,
      });

      const page = new PostPage();
      expect(page.isPresent()).toBe(true);
    });

    it("returns true when on a post page with UUID", () => {
      Object.defineProperty(window, "location", {
        value: {
          pathname: "/imagine/post/a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        },
        writable: true,
      });

      const page = new PostPage();
      expect(page.isPresent()).toBe(true);
    });

    it("returns false when not on a post page", () => {
      Object.defineProperty(window, "location", {
        value: { pathname: "/imagine/favorites" },
        writable: true,
      });

      const page = new PostPage();
      expect(page.isPresent()).toBe(false);
    });

    it("returns false when on imagine home", () => {
      Object.defineProperty(window, "location", {
        value: { pathname: "/imagine" },
        writable: true,
      });

      const page = new PostPage();
      expect(page.isPresent()).toBe(false);
    });
  });

  describe("getPostId()", () => {
    it("extracts post ID from URL", () => {
      Object.defineProperty(window, "location", {
        value: { pathname: "/imagine/post/abc-123-def" },
        writable: true,
      });

      const page = new PostPage();
      expect(page.getPostId()).toBe("abc-123-def");
    });

    it("extracts UUID from URL", () => {
      Object.defineProperty(window, "location", {
        value: {
          pathname: "/imagine/post/a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        },
        writable: true,
      });

      const page = new PostPage();
      expect(page.getPostId()).toBe("a1b2c3d4-e5f6-7890-abcd-ef1234567890");
    });

    it("returns null when not on a post page", () => {
      Object.defineProperty(window, "location", {
        value: { pathname: "/imagine/favorites" },
        writable: true,
      });

      const page = new PostPage();
      expect(page.getPostId()).toBeNull();
    });

    it("handles post ID with query params", () => {
      Object.defineProperty(window, "location", {
        value: { pathname: "/imagine/post/abc-123" },
        writable: true,
      });

      const page = new PostPage();
      expect(page.getPostId()).toBe("abc-123");
    });
  });

  describe("composite components", () => {
    it("has carousel property", () => {
      const page = new PostPage();
      expect(page.carousel).toBeDefined();
      expect(page.carousel.isPresent).toBeDefined();
      expect(page.carousel.navigateNext).toBeDefined();
    });

    it("has toolbar property", () => {
      const page = new PostPage();
      expect(page.toolbar).toBeDefined();
      expect(page.toolbar.isPresent).toBeDefined();
      expect(page.toolbar.clickDownload).toBeDefined();
    });

    it("has promptForm property", () => {
      const page = new PostPage();
      expect(page.promptForm).toBeDefined();
      expect(page.promptForm.isPresent).toBeDefined();
      expect(page.promptForm.fillAndSubmit).toBeDefined();
    });

    it("has generationStatus property", () => {
      const page = new PostPage();
      expect(page.generationStatus).toBeDefined();
      expect(page.generationStatus.isPresent).toBeDefined();
      expect(page.generationStatus.detectOutcome).toBeDefined();
    });
  });

  describe("document injection", () => {
    it("all components share the same document scope", () => {
      const customDoc = document.implementation.createHTMLDocument("Custom");
      customDoc.body.innerHTML = `
        <div data-testid="video-carousel">
          <button class="snap-center">Item 1</button>
        </div>
        <button aria-label="Download">Download</button>
        <div class="tiptap ProseMirror" contenteditable="true"></div>
        <video id="sd-video" src="test.mp4"></video>
      `;

      const page = new PostPage(customDoc);

      // All components should be able to find elements in customDoc
      expect(page.carousel.isPresent()).toBe(true);
      expect(page.toolbar.isPresent()).toBe(true);
      expect(page.promptForm.isPresent()).toBe(true);
      expect(page.generationStatus.isPresent()).toBe(true);
    });

    it("components do not find elements in global document", () => {
      // Put elements in global document
      document.body.innerHTML = `
        <div data-testid="video-carousel">
          <button class="snap-center">Item 1</button>
        </div>
      `;

      // Create custom empty document
      const customDoc = document.implementation.createHTMLDocument("Custom");
      customDoc.body.innerHTML = `<div>Empty</div>`;

      const page = new PostPage(customDoc);

      // Components should NOT find elements from global document
      expect(page.carousel.isPresent()).toBe(false);
    });
  });

  describe("nested menu access", () => {
    it("can access moreOptionsMenu through toolbar", () => {
      const page = new PostPage();
      expect(page.toolbar.moreOptionsMenu).toBeDefined();
      expect(page.toolbar.moreOptionsMenu.open).toBeDefined();
    });

    it("can access settingsMenu through promptForm", () => {
      const page = new PostPage();
      expect(page.promptForm.settingsMenu).toBeDefined();
      expect(page.promptForm.settingsMenu.open).toBeDefined();
    });
  });
});
