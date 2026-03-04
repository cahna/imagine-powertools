import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  detectMode,
  clickVideoOption,
  fillAndSubmitVideo,
  findMenuItemByText,
  detectGenerationOutcome,
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

describe("detectGenerationOutcome", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  describe("rate limit detection", () => {
    it("detects rate limit from notifications section", () => {
      document.body.innerHTML = `
        <section aria-label="Notifications alt+T">
          <span>Rate limit reached</span>
        </section>
      `;

      const result = detectGenerationOutcome();

      expect(result.type).toBe("rate_limited");
    });

    it("detects rate limit with exact aria-label match", () => {
      document.body.innerHTML = `
        <section aria-label="Notifications">
          <span>Rate limit reached</span>
        </section>
      `;

      const result = detectGenerationOutcome();

      expect(result.type).toBe("rate_limited");
    });

    it("rate limit takes priority over existing video", () => {
      document.body.innerHTML = `
        <section aria-label="Notifications alt+T">
          <span>Rate limit reached</span>
        </section>
        <video id="sd-video" src="https://example.com/video.mp4"></video>
      `;

      const result = detectGenerationOutcome();

      expect(result.type).toBe("rate_limited");
    });
  });

  describe("generating detection", () => {
    it("detects generating state from animate-pulse element", () => {
      document.body.innerHTML = `
        <div class="animate-pulse">Generating</div>
      `;

      const result = detectGenerationOutcome();

      expect(result.type).toBe("generating");
    });

    it("extracts progress percentage when present", () => {
      document.body.innerHTML = `
        <div class="animate-pulse">Generating 45%</div>
      `;

      const result = detectGenerationOutcome();

      expect(result.type).toBe("generating");
      expect(result).toHaveProperty("progress", "45%");
    });

    it("detects generating from Cancel Video button", () => {
      document.body.innerHTML = `
        <button>Cancel Video</button>
      `;

      const result = detectGenerationOutcome();

      expect(result.type).toBe("generating");
    });

    it("generating takes priority over existing video", () => {
      // This is the key test for the fix - when there's an existing video
      // AND a generating indicator, we should detect "generating"
      document.body.innerHTML = `
        <div class="animate-pulse">Generating 10%</div>
        <video id="sd-video" src="https://example.com/existing-video.mp4"></video>
      `;

      const result = detectGenerationOutcome();

      expect(result.type).toBe("generating");
      expect(result).toHaveProperty("progress", "10%");
    });

    it("Cancel Video button takes priority over existing video", () => {
      document.body.innerHTML = `
        <button>Cancel Video</button>
        <video id="hd-video" src="https://example.com/existing-video.mp4"></video>
      `;

      const result = detectGenerationOutcome();

      expect(result.type).toBe("generating");
    });
  });

  describe("moderated detection", () => {
    it("detects moderated result from image alt", () => {
      document.body.innerHTML = `
        <img alt="Moderated" src="moderated.jpg" />
      `;

      const result = detectGenerationOutcome();

      expect(result.type).toBe("moderated");
    });

    it("moderated takes priority over existing video", () => {
      document.body.innerHTML = `
        <img alt="Moderated" src="moderated.jpg" />
        <video id="sd-video" src="https://example.com/video.mp4"></video>
      `;

      const result = detectGenerationOutcome();

      expect(result.type).toBe("moderated");
    });
  });

  describe("success detection", () => {
    it("detects success from sd-video with mp4 src", () => {
      document.body.innerHTML = `
        <video id="sd-video" src="https://example.com/video.mp4"></video>
      `;

      const result = detectGenerationOutcome();

      expect(result.type).toBe("success");
    });

    it("detects success from hd-video with mp4 src", () => {
      document.body.innerHTML = `
        <video id="hd-video" src="https://example.com/video.mp4"></video>
      `;

      const result = detectGenerationOutcome();

      expect(result.type).toBe("success");
    });

    it("does not detect success from video without mp4 src", () => {
      document.body.innerHTML = `
        <video id="sd-video" src=""></video>
      `;

      const result = detectGenerationOutcome();

      expect(result.type).toBe("unknown");
    });
  });

  describe("unknown state", () => {
    it("returns unknown when no indicators present", () => {
      document.body.innerHTML = `
        <div>Some other content</div>
      `;

      const result = detectGenerationOutcome();

      expect(result.type).toBe("unknown");
    });

    it("returns unknown for empty body", () => {
      document.body.innerHTML = "";

      const result = detectGenerationOutcome();

      expect(result.type).toBe("unknown");
    });
  });

  describe("priority order", () => {
    it("rate_limited > generating > moderated > success", () => {
      // All indicators present - rate_limited should win
      document.body.innerHTML = `
        <section aria-label="Notifications">Rate limit reached</section>
        <div class="animate-pulse">Generating 50%</div>
        <img alt="Moderated" />
        <video id="sd-video" src="video.mp4"></video>
      `;

      expect(detectGenerationOutcome().type).toBe("rate_limited");

      // Remove rate limit - generating should win
      document.body.innerHTML = `
        <div class="animate-pulse">Generating 50%</div>
        <img alt="Moderated" />
        <video id="sd-video" src="video.mp4"></video>
      `;

      expect(detectGenerationOutcome().type).toBe("generating");

      // Remove generating - moderated should win
      document.body.innerHTML = `
        <img alt="Moderated" />
        <video id="sd-video" src="video.mp4"></video>
      `;

      expect(detectGenerationOutcome().type).toBe("moderated");

      // Remove moderated - success should win
      document.body.innerHTML = `
        <video id="sd-video" src="video.mp4"></video>
      `;

      expect(detectGenerationOutcome().type).toBe("success");
    });
  });
});
