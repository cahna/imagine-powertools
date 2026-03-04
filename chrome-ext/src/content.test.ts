import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  detectMode,
  clickVideoOption,
  fillAndSubmitVideo,
  findMenuItemByText,
} from "./content.core";

describe("detectMode", () => {
  beforeEach(() => {
    // Reset location for each test
    Object.defineProperty(window, "location", {
      value: { pathname: "/" },
      writable: true,
    });
  });

  it('returns "favorites" for /imagine/favorites path', () => {
    Object.defineProperty(window, "location", {
      value: { pathname: "/imagine/favorites" },
      writable: true,
    });

    expect(detectMode()).toBe("favorites");
  });

  it('returns "post" for /imagine/post/:id paths', () => {
    Object.defineProperty(window, "location", {
      value: { pathname: "/imagine/post/abc-123-def" },
      writable: true,
    });

    expect(detectMode()).toBe("post");
  });

  it('returns "results" when on /imagine with Back button present', () => {
    Object.defineProperty(window, "location", {
      value: { pathname: "/imagine" },
      writable: true,
    });

    document.body.innerHTML = '<button aria-label="Back">Back</button>';

    expect(detectMode()).toBe("results");
  });

  it('returns "none" when on /imagine without Back button', () => {
    Object.defineProperty(window, "location", {
      value: { pathname: "/imagine" },
      writable: true,
    });

    expect(detectMode()).toBe("none");
  });

  it('returns "none" for unrecognized paths', () => {
    Object.defineProperty(window, "location", {
      value: { pathname: "/some/other/path" },
      writable: true,
    });

    expect(detectMode()).toBe("none");
  });
});

describe("clickVideoOption", () => {
  describe("duration options (radiogroup)", () => {
    it("clicks 6s option when radiogroup is visible", async () => {
      const clickHandler = vi.fn();
      document.body.innerHTML = `
        <div role="radiogroup" aria-label="Video duration">
          <button role="radio"><span>6s</span></button>
          <button role="radio"><span>10s</span></button>
        </div>
      `;

      const btn6s = document.querySelector(
        'button[role="radio"]'
      ) as HTMLButtonElement;
      btn6s.addEventListener("click", clickHandler);

      const result = await clickVideoOption("6s");

      expect(result.success).toBe(true);
      expect(clickHandler).toHaveBeenCalled();
    });

    it("clicks 10s option when radiogroup is visible", async () => {
      const clickHandler = vi.fn();
      document.body.innerHTML = `
        <div role="radiogroup" aria-label="Video duration">
          <button role="radio"><span>6s</span></button>
          <button role="radio"><span>10s</span></button>
        </div>
      `;

      const btn10s = document.querySelectorAll(
        'button[role="radio"]'
      )[1] as HTMLButtonElement;
      btn10s.addEventListener("click", clickHandler);

      const result = await clickVideoOption("10s");

      expect(result.success).toBe(true);
      expect(clickHandler).toHaveBeenCalled();
    });
  });

  describe("resolution options (radiogroup)", () => {
    it("clicks 480p option when radiogroup is visible", async () => {
      const clickHandler = vi.fn();
      document.body.innerHTML = `
        <div role="radiogroup" aria-label="Video resolution">
          <button role="radio"><span>480p</span></button>
          <button role="radio"><span>720p</span></button>
        </div>
      `;

      const btn480p = document.querySelector(
        'button[role="radio"]'
      ) as HTMLButtonElement;
      btn480p.addEventListener("click", clickHandler);

      const result = await clickVideoOption("480p");

      expect(result.success).toBe(true);
      expect(clickHandler).toHaveBeenCalled();
    });

    it("clicks 720p option when radiogroup is visible", async () => {
      const clickHandler = vi.fn();
      document.body.innerHTML = `
        <div role="radiogroup" aria-label="Video resolution">
          <button role="radio"><span>480p</span></button>
          <button role="radio"><span>720p</span></button>
        </div>
      `;

      const btn720p = document.querySelectorAll(
        'button[role="radio"]'
      )[1] as HTMLButtonElement;
      btn720p.addEventListener("click", clickHandler);

      const result = await clickVideoOption("720p");

      expect(result.success).toBe(true);
      expect(clickHandler).toHaveBeenCalled();
    });
  });

  describe("form expansion", () => {
    it("expands form by focusing tiptap editor when radiogroup not visible", async () => {
      const focusHandler = vi.fn();
      document.body.innerHTML = `
        <div class="tiptap ProseMirror" contenteditable="true"></div>
      `;

      const editor = document.querySelector(".tiptap") as HTMLElement;
      editor.addEventListener("focus", () => {
        focusHandler();
        // Simulate form expansion by adding radiogroup after focus
        document.body.innerHTML += `
          <div role="radiogroup" aria-label="Video duration">
            <button role="radio"><span>6s</span></button>
          </div>
        `;
      });

      const result = await clickVideoOption("6s");

      expect(focusHandler).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it("returns error when no editor and no radiogroup found", async () => {
      document.body.innerHTML = "";

      const result = await clickVideoOption("6s");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Could not find text input");
    });
  });

  describe("mood options (Settings menu)", () => {
    // This test catches the "removed clickMoodOptionFromMenu" bug
    it("clicks spicy option via Settings menu", async () => {
      const menuItemClicked = vi.fn();
      document.body.innerHTML = `
        <button aria-label="Settings" aria-expanded="true">Settings</button>
        <div data-radix-menu-content>
          <div role="menuitem" data-radix-collection-item>Spicy</div>
          <div role="menuitem" data-radix-collection-item>Fun</div>
          <div role="menuitem" data-radix-collection-item>Normal</div>
        </div>
      `;

      document.querySelectorAll('[role="menuitem"]').forEach((item) => {
        item.addEventListener("click", menuItemClicked);
      });

      const result = await clickVideoOption("spicy");

      expect(result.success).toBe(true);
      expect(menuItemClicked).toHaveBeenCalled();
    });

    it("clicks fun option via Settings menu", async () => {
      document.body.innerHTML = `
        <button aria-label="Settings" aria-expanded="true">Settings</button>
        <div data-radix-menu-content>
          <div role="menuitem" data-radix-collection-item>Spicy</div>
          <div role="menuitem" data-radix-collection-item>Fun</div>
          <div role="menuitem" data-radix-collection-item>Normal</div>
        </div>
      `;

      const result = await clickVideoOption("fun");
      expect(result.success).toBe(true);
    });

    it("clicks normal option via Settings menu", async () => {
      document.body.innerHTML = `
        <button aria-label="Settings" aria-expanded="true">Settings</button>
        <div data-radix-menu-content>
          <div role="menuitem" data-radix-collection-item>Spicy</div>
          <div role="menuitem" data-radix-collection-item>Fun</div>
          <div role="menuitem" data-radix-collection-item>Normal</div>
        </div>
      `;

      const result = await clickVideoOption("normal");
      expect(result.success).toBe(true);
    });

    it("returns error when Settings button not found for mood option", async () => {
      document.body.innerHTML = "";

      const result = await clickVideoOption("spicy");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Settings button not found");
    });
  });

  it("returns error for unknown options", async () => {
    const result = await clickVideoOption("unknown");

    expect(result.success).toBe(false);
    expect(result.error).toBe("Unknown option: unknown");
  });
});

describe("fillAndSubmitVideo", () => {
  beforeEach(() => {
    // Mock document.execCommand for tiptap
    document.execCommand = vi.fn();
  });

  it("fills tiptap editor and clicks Make video button", () => {
    const clickHandler = vi.fn();
    document.body.innerHTML = `
      <div class="tiptap ProseMirror" contenteditable="true"></div>
      <button aria-label="Make video">Make video</button>
    `;

    const btn = document.querySelector(
      'button[aria-label="Make video"]'
    ) as HTMLButtonElement;
    btn.addEventListener("click", clickHandler);

    const result = fillAndSubmitVideo("test prompt");

    expect(result.success).toBe(true);
    expect(document.execCommand).toHaveBeenCalledWith(
      "insertText",
      false,
      "test prompt"
    );
  });

  it("returns error when no input found", () => {
    document.body.innerHTML = `
      <button aria-label="Make video">Make video</button>
    `;

    const result = fillAndSubmitVideo("test prompt");

    expect(result.success).toBe(false);
    expect(result.error).toBe("Could not find video prompt input");
  });

  it("returns error when Make video button not found", () => {
    document.body.innerHTML = `
      <div class="tiptap ProseMirror" contenteditable="true"></div>
    `;

    const result = fillAndSubmitVideo("test prompt");

    expect(result.success).toBe(false);
    expect(result.error).toBe("Could not find Make video button");
  });
});

describe("findMenuItemByText", () => {
  it("finds menu item by text content", () => {
    document.body.innerHTML = `
      <div role="menuitem" data-radix-collection-item>Spicy</div>
      <div role="menuitem" data-radix-collection-item>Fun</div>
    `;

    const item = findMenuItemByText("Spicy");

    expect(item).not.toBeNull();
    expect(item?.textContent).toBe("Spicy");
  });

  it("returns null when menu item not found", () => {
    document.body.innerHTML = `
      <div role="menuitem" data-radix-collection-item>Fun</div>
    `;

    const item = findMenuItemByText("NotFound");

    expect(item).toBeNull();
  });
});
