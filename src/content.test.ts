import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  detectMode,
  clickVideoOption,
  fillAndSubmitVideo,
  findMenuItemByText,
  detectGenerationOutcome,
  detectGenerationOutcomeWithContext,
  isInExtendMode,
  clickMakeVideoButton,
  clickExtendVideoFromMenu,
  navigateVideoCarousel,
  getCurrentPostId,
  getCarouselItemCount,
  isSelectedCarouselItemModerated,
  isPreviewAreaModerated,
  selectFirstValidCarouselItem,
  selectCarouselItemByVideoId,
  type GenerationContext,
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

  it('returns "post-extend" when on post page with Exit extend mode button', () => {
    Object.defineProperty(window, "location", {
      value: { pathname: "/imagine/post/abc-123-def" },
      writable: true,
    });

    document.body.innerHTML = `
      <div class="tiptap ProseMirror">
        <p data-placeholder="Extend video" class="is-empty"></p>
      </div>
    `;

    expect(detectMode()).toBe("post-extend");
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
        'button[role="radio"]',
      ) as HTMLButtonElement;
      btn6s.addEventListener("click", clickHandler);

      const result = await clickVideoOption("6s");

      expect(result.isOk()).toBe(true);
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
        'button[role="radio"]',
      )[1] as HTMLButtonElement;
      btn10s.addEventListener("click", clickHandler);

      const result = await clickVideoOption("10s");

      expect(result.isOk()).toBe(true);
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
        'button[role="radio"]',
      ) as HTMLButtonElement;
      btn480p.addEventListener("click", clickHandler);

      const result = await clickVideoOption("480p");

      expect(result.isOk()).toBe(true);
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
        'button[role="radio"]',
      )[1] as HTMLButtonElement;
      btn720p.addEventListener("click", clickHandler);

      const result = await clickVideoOption("720p");

      expect(result.isOk()).toBe(true);
      expect(clickHandler).toHaveBeenCalled();
    });
  });

  describe("extend mode duration options (+6s, +10s)", () => {
    it("clicks +6s option when in extend mode and requesting 6s", async () => {
      const clickHandler = vi.fn();
      document.body.innerHTML = `
        <div class="tiptap ProseMirror">
          <p data-placeholder="Extend video" class="is-empty"></p>
        </div>
        <div role="radiogroup" aria-label="Video duration">
          <button role="radio"><span>+6s</span></button>
          <button role="radio"><span>+10s</span></button>
        </div>
      `;

      const btn6s = document.querySelector(
        'button[role="radio"]',
      ) as HTMLButtonElement;
      btn6s.addEventListener("click", clickHandler);

      const result = await clickVideoOption("6s");

      expect(result.isOk()).toBe(true);
      expect(clickHandler).toHaveBeenCalled();
    });

    it("clicks +10s option when in extend mode and requesting 10s", async () => {
      const clickHandler = vi.fn();
      document.body.innerHTML = `
        <div class="tiptap ProseMirror">
          <p data-placeholder="Extend video" class="is-empty"></p>
        </div>
        <div role="radiogroup" aria-label="Video duration">
          <button role="radio"><span>+6s</span></button>
          <button role="radio"><span>+10s</span></button>
        </div>
      `;

      const btn10s = document.querySelectorAll(
        'button[role="radio"]',
      )[1] as HTMLButtonElement;
      btn10s.addEventListener("click", clickHandler);

      const result = await clickVideoOption("10s");

      expect(result.isOk()).toBe(true);
      expect(clickHandler).toHaveBeenCalled();
    });

    it("does not transform duration when NOT in extend mode", async () => {
      const clickHandler = vi.fn();
      document.body.innerHTML = `
        <div role="radiogroup" aria-label="Video duration">
          <button role="radio"><span>6s</span></button>
          <button role="radio"><span>10s</span></button>
        </div>
      `;

      const btn6s = document.querySelector(
        'button[role="radio"]',
      ) as HTMLButtonElement;
      btn6s.addEventListener("click", clickHandler);

      const result = await clickVideoOption("6s");

      expect(result.isOk()).toBe(true);
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
      expect(result.isOk()).toBe(true);
    });

    it("returns error when no editor and no radiogroup found", async () => {
      document.body.innerHTML = "";

      const result = await clickVideoOption("6s");

      expect(result.isErr()).toBe(true);
      const error = result._unsafeUnwrapErr();
      expect(error.type).toBe("element_not_found");
    });
  });

  describe("mood options (More Options menu)", () => {
    // Mood options are now in the More Options menu (not Settings menu)
    // Note: "fun" mood option has been removed from Grok Imagine
    it("clicks spicy option via More Options menu", async () => {
      const menuItemClicked = vi.fn();
      document.body.innerHTML = `
        <button aria-label="More options" aria-expanded="true">More options</button>
        <div data-radix-menu-content>
          <div role="menuitem" data-radix-collection-item>Spicy</div>
          <div role="menuitem" data-radix-collection-item>Normal</div>
        </div>
      `;

      document.querySelectorAll('[role="menuitem"]').forEach((item) => {
        item.addEventListener("click", menuItemClicked);
      });

      const result = await clickVideoOption("spicy");

      expect(result.isOk()).toBe(true);
      expect(menuItemClicked).toHaveBeenCalled();
    });

    it("clicks normal option via More Options menu", async () => {
      document.body.innerHTML = `
        <button aria-label="More options" aria-expanded="true">More options</button>
        <div data-radix-menu-content>
          <div role="menuitem" data-radix-collection-item>Spicy</div>
          <div role="menuitem" data-radix-collection-item>Normal</div>
        </div>
      `;

      const result = await clickVideoOption("normal");
      expect(result.isOk()).toBe(true);
    });

    it("returns error when More options button not found for mood option", async () => {
      document.body.innerHTML = "";

      const result = await clickVideoOption("spicy");

      expect(result.isErr()).toBe(true);
      const error = result._unsafeUnwrapErr();
      expect(error.type).toBe("element_not_found");
      expect(error).toHaveProperty("element", "more options button");
    });

    it("returns error for removed fun option", async () => {
      const result = await clickVideoOption("fun");

      expect(result.isErr()).toBe(true);
      const error = result._unsafeUnwrapErr();
      expect(error.type).toBe("invalid_state");
    });
  });

  it("returns error for unknown options", async () => {
    const result = await clickVideoOption("unknown");

    expect(result.isErr()).toBe(true);
    const error = result._unsafeUnwrapErr();
    expect(error.type).toBe("invalid_state");
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
      'button[aria-label="Make video"]',
    ) as HTMLButtonElement;
    btn.addEventListener("click", clickHandler);

    const result = fillAndSubmitVideo("test prompt");

    expect(result.isOk()).toBe(true);
    expect(document.execCommand).toHaveBeenCalledWith(
      "insertText",
      false,
      "test prompt",
    );
  });

  it("returns error when no input found", () => {
    document.body.innerHTML = `
      <button aria-label="Make video">Make video</button>
    `;

    const result = fillAndSubmitVideo("test prompt");

    expect(result.isErr()).toBe(true);
    const error = result._unsafeUnwrapErr();
    expect(error.type).toBe("element_not_found");
    expect(error).toHaveProperty("element", "prompt input");
  });

  it("returns error when Make video button not found", () => {
    document.body.innerHTML = `
      <div class="tiptap ProseMirror" contenteditable="true"></div>
    `;

    const result = fillAndSubmitVideo("test prompt");

    expect(result.isErr()).toBe(true);
    const error = result._unsafeUnwrapErr();
    expect(error.type).toBe("element_not_found");
    expect(error).toHaveProperty("element", "Make video button");
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

    it("detects moderation from large eye-off icon in preview area", () => {
      document.body.innerHTML = `
        <svg class="lucide lucide-eye-off size-24 text-primary">
          <path d="M10.733 5.076"></path>
        </svg>
      `;

      const result = detectGenerationOutcome();

      expect(result.type).toBe("moderated");
    });

    it("detects moderation from selected carousel item with eye-off icon", () => {
      document.body.innerHTML = `
        <div class="snap-y snap-mandatory">
          <button class="snap-center ring-fg-primary">
            <svg class="lucide lucide-eye-off size-4 text-gray-400">
              <path d="M10.733 5.076"></path>
            </svg>
          </button>
        </div>
      `;

      const result = detectGenerationOutcome();

      expect(result.type).toBe("moderated");
    });

    it("does not detect moderation from small eye-off icon in non-selected carousel item", () => {
      document.body.innerHTML = `
        <div class="snap-y snap-mandatory">
          <button class="snap-center opacity-75">
            <svg class="lucide lucide-eye-off size-4 text-gray-400">
              <path d="M10.733 5.076"></path>
            </svg>
          </button>
        </div>
      `;

      const result = detectGenerationOutcome();

      // Should be unknown since item is not selected
      expect(result.type).toBe("unknown");
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

describe("getCurrentPostId", () => {
  beforeEach(() => {
    Object.defineProperty(window, "location", {
      value: { pathname: "/" },
      writable: true,
    });
  });

  it("extracts post ID from /imagine/post/{id} path", () => {
    Object.defineProperty(window, "location", {
      value: { pathname: "/imagine/post/abc-123-def-456" },
      writable: true,
    });

    expect(getCurrentPostId()).toBe("abc-123-def-456");
  });

  it("returns null for non-post paths", () => {
    Object.defineProperty(window, "location", {
      value: { pathname: "/imagine/favorites" },
      writable: true,
    });

    expect(getCurrentPostId()).toBeNull();
  });

  it("returns null for root path", () => {
    Object.defineProperty(window, "location", {
      value: { pathname: "/" },
      writable: true,
    });

    expect(getCurrentPostId()).toBeNull();
  });
});

describe("getCarouselItemCount", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("counts carousel items correctly", () => {
    document.body.innerHTML = `
      <div class="snap-y snap-mandatory">
        <button class="snap-center">1</button>
        <button class="snap-center">2</button>
        <button class="snap-center">3</button>
      </div>
    `;

    expect(getCarouselItemCount()).toBe(3);
  });

  it("returns 0 when carousel container not found", () => {
    document.body.innerHTML = `<div>No carousel</div>`;

    expect(getCarouselItemCount()).toBe(0);
  });

  it("returns 0 for empty carousel", () => {
    document.body.innerHTML = `<div class="snap-y snap-mandatory"></div>`;

    expect(getCarouselItemCount()).toBe(0);
  });
});

describe("isSelectedCarouselItemModerated", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("returns true when selected item has eye-off icon", () => {
    document.body.innerHTML = `
      <div class="snap-y snap-mandatory">
        <button class="snap-center ring-fg-primary">
          <svg class="lucide lucide-eye-off"></svg>
        </button>
      </div>
    `;

    expect(isSelectedCarouselItemModerated()).toBe(true);
  });

  it("returns false when selected item has no eye-off icon", () => {
    document.body.innerHTML = `
      <div class="snap-y snap-mandatory">
        <button class="snap-center ring-fg-primary">
          <img src="thumbnail.jpg" />
        </button>
      </div>
    `;

    expect(isSelectedCarouselItemModerated()).toBe(false);
  });

  it("returns false when no item is selected", () => {
    document.body.innerHTML = `
      <div class="snap-y snap-mandatory">
        <button class="snap-center opacity-75">
          <svg class="lucide lucide-eye-off"></svg>
        </button>
      </div>
    `;

    expect(isSelectedCarouselItemModerated()).toBe(false);
  });

  it("returns false when carousel not found", () => {
    document.body.innerHTML = `<div>No carousel</div>`;

    expect(isSelectedCarouselItemModerated()).toBe(false);
  });
});

describe("isPreviewAreaModerated", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("returns true when large eye-off icon present", () => {
    document.body.innerHTML = `
      <svg class="lucide lucide-eye-off size-24 text-primary"></svg>
    `;

    expect(isPreviewAreaModerated()).toBe(true);
  });

  it("returns false when only small eye-off icon present", () => {
    document.body.innerHTML = `
      <svg class="lucide lucide-eye-off size-4 text-gray-400"></svg>
    `;

    expect(isPreviewAreaModerated()).toBe(false);
  });

  it("returns false when no eye-off icon present", () => {
    document.body.innerHTML = `<div>Normal content</div>`;

    expect(isPreviewAreaModerated()).toBe(false);
  });
});

describe("selectFirstValidCarouselItem", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("clicks the first non-moderated item", () => {
    const clickHandler = vi.fn();
    document.body.innerHTML = `
      <div class="snap-y snap-mandatory">
        <button class="snap-center" id="btn1">
          <img src="thumbnail.jpg" />
        </button>
        <button class="snap-center" id="btn2">
          <img src="thumbnail2.jpg" />
        </button>
      </div>
    `;
    document.getElementById("btn1")!.addEventListener("click", clickHandler);

    const result = selectFirstValidCarouselItem();

    expect(result.isOk()).toBe(true);
    expect(clickHandler).toHaveBeenCalled();
  });

  it("skips moderated items and clicks first valid one", () => {
    const clickHandler = vi.fn();
    document.body.innerHTML = `
      <div class="snap-y snap-mandatory">
        <button class="snap-center" id="btn1">
          <svg class="lucide lucide-eye-off"></svg>
        </button>
        <button class="snap-center" id="btn2">
          <img src="thumbnail.jpg" />
        </button>
      </div>
    `;
    document.getElementById("btn2")!.addEventListener("click", clickHandler);

    const result = selectFirstValidCarouselItem();

    expect(result.isOk()).toBe(true);
    expect(clickHandler).toHaveBeenCalled();
  });

  it("returns error when all items are moderated", () => {
    document.body.innerHTML = `
      <div class="snap-y snap-mandatory">
        <button class="snap-center">
          <svg class="lucide lucide-eye-off"></svg>
        </button>
        <button class="snap-center">
          <svg class="lucide lucide-eye-off"></svg>
        </button>
      </div>
    `;

    const result = selectFirstValidCarouselItem();

    expect(result.isErr()).toBe(true);
  });

  it("returns error when carousel not found", () => {
    document.body.innerHTML = `<div>No carousel</div>`;

    const result = selectFirstValidCarouselItem();

    expect(result.isErr()).toBe(true);
  });
});

describe("selectCarouselItemByVideoId", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("clicks carousel item matching video ID in preview_image.jpg URL", () => {
    const clickHandler = vi.fn();
    document.body.innerHTML = `
      <div class="snap-y snap-mandatory">
        <button class="snap-center" id="btn1">
          <img src="https://assets.grok.com/users/123/generated/abc-123-def/preview_image.jpg" />
        </button>
        <button class="snap-center" id="btn2">
          <img src="https://assets.grok.com/users/123/generated/xyz-789-uvw/preview_image.jpg" />
        </button>
      </div>
    `;
    document.getElementById("btn2")!.addEventListener("click", clickHandler);

    const result = selectCarouselItemByVideoId("xyz-789-uvw");

    expect(result.isOk()).toBe(true);
    expect(clickHandler).toHaveBeenCalled();
  });

  it("clicks carousel item matching video ID in share-videos thumbnail URL", () => {
    const clickHandler = vi.fn();
    document.body.innerHTML = `
      <div class="snap-y snap-mandatory">
        <button class="snap-center" id="btn1">
          <img src="https://imagine-public.x.ai/imagine-public/share-videos/abc-123_thumbnail.jpg" />
        </button>
      </div>
    `;
    document.getElementById("btn1")!.addEventListener("click", clickHandler);

    const result = selectCarouselItemByVideoId("abc-123");

    expect(result.isOk()).toBe(true);
    expect(clickHandler).toHaveBeenCalled();
  });

  it("returns error when video ID not found", () => {
    document.body.innerHTML = `
      <div class="snap-y snap-mandatory">
        <button class="snap-center">
          <img src="https://example.com/other-video.jpg" />
        </button>
      </div>
    `;

    const result = selectCarouselItemByVideoId("nonexistent-id");

    expect(result.isErr()).toBe(true);
  });

  it("returns error when carousel not found", () => {
    document.body.innerHTML = `<div>No carousel</div>`;

    const result = selectCarouselItemByVideoId("any-id");

    expect(result.isErr()).toBe(true);
  });
});

describe("detectGenerationOutcomeWithContext", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    Object.defineProperty(window, "location", {
      value: { pathname: "/" },
      writable: true,
    });
  });

  it("returns moderated when URL reverted from expected post", () => {
    // Scenario: generation started at new-uuid, but URL reverted to old-uuid
    // and there's a successful video visible (from the previous post)
    document.body.innerHTML = `
      <video id="sd-video" src="https://example.com/video.mp4"></video>
    `;
    Object.defineProperty(window, "location", {
      value: { pathname: "/imagine/post/old-uuid" },
      writable: true,
    });

    const context: GenerationContext = {
      initialPostId: "old-uuid",
      initialCarouselCount: 3,
      expectedPostId: "new-uuid-that-was-moderated",
    };

    const result = detectGenerationOutcomeWithContext(context);

    expect(result.type).toBe("moderated");
  });

  it("returns success when URL matches expected post", () => {
    document.body.innerHTML = `
      <video id="sd-video" src="https://example.com/video.mp4"></video>
    `;
    Object.defineProperty(window, "location", {
      value: { pathname: "/imagine/post/new-uuid" },
      writable: true,
    });

    const context: GenerationContext = {
      initialPostId: "old-uuid",
      initialCarouselCount: 3,
      expectedPostId: "new-uuid",
    };

    const result = detectGenerationOutcomeWithContext(context);

    expect(result.type).toBe("success");
  });

  it("passes through non-success/unknown outcomes without context validation", () => {
    document.body.innerHTML = `
      <section aria-label="Notifications">Rate limit reached</section>
    `;
    Object.defineProperty(window, "location", {
      value: { pathname: "/imagine/post/different-uuid" },
      writable: true,
    });

    const context: GenerationContext = {
      initialPostId: "old-uuid",
      initialCarouselCount: 3,
      expectedPostId: "expected-uuid",
    };

    const result = detectGenerationOutcomeWithContext(context);

    // Should return rate_limited, not check context
    expect(result.type).toBe("rate_limited");
  });

  it("returns moderated for unknown state when URL changed unexpectedly", () => {
    document.body.innerHTML = `<div>Some content</div>`;
    Object.defineProperty(window, "location", {
      value: { pathname: "/imagine/post/old-uuid" },
      writable: true,
    });

    const context: GenerationContext = {
      initialPostId: "old-uuid",
      initialCarouselCount: 3,
      expectedPostId: "new-uuid",
    };

    const result = detectGenerationOutcomeWithContext(context);

    expect(result.type).toBe("moderated");
  });

  it("returns unknown when no expectedPostId set", () => {
    document.body.innerHTML = `<div>Some content</div>`;

    const context: GenerationContext = {
      initialPostId: "old-uuid",
      initialCarouselCount: 3,
      expectedPostId: null,
    };

    const result = detectGenerationOutcomeWithContext(context);

    expect(result.type).toBe("unknown");
  });
});

describe("isInExtendMode", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("returns true when Extend video placeholder is present", () => {
    document.body.innerHTML = `
      <div class="tiptap ProseMirror">
        <p data-placeholder="Extend video" class="is-empty"></p>
      </div>
    `;

    expect(isInExtendMode()).toBe(true);
  });

  it("returns false when Extend video placeholder is not present", () => {
    document.body.innerHTML = `
      <div class="tiptap ProseMirror">
        <p data-placeholder="Make a video" class="is-empty"></p>
      </div>
    `;

    expect(isInExtendMode()).toBe(false);
  });

  it("returns false for empty body", () => {
    document.body.innerHTML = "";

    expect(isInExtendMode()).toBe(false);
  });
});

describe("clickMakeVideoButton", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("clicks Make video button and returns success", () => {
    const clickHandler = vi.fn();
    document.body.innerHTML = `
      <button aria-label="Make video">Make video</button>
    `;

    const btn = document.querySelector(
      'button[aria-label="Make video"]',
    ) as HTMLButtonElement;
    btn.addEventListener("click", clickHandler);

    const result = clickMakeVideoButton();

    expect(result.isOk()).toBe(true);
    expect(clickHandler).toHaveBeenCalled();
  });

  it("returns error when Make video button not found", () => {
    document.body.innerHTML = `
      <button aria-label="Something else">Button</button>
    `;

    const result = clickMakeVideoButton();

    expect(result.isErr()).toBe(true);
    const error = result._unsafeUnwrapErr();
    expect(error.type).toBe("element_not_found");
    expect(error).toHaveProperty("element", "Make video button");
  });
});

describe("clickExtendVideoFromMenu", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("returns error when no successful video present", async () => {
    document.body.innerHTML = `
      <button aria-label="More options">More</button>
    `;

    const result = await clickExtendVideoFromMenu();

    expect(result.isErr()).toBe(true);
    const error = result._unsafeUnwrapErr();
    expect(error.type).toBe("invalid_state");
  });

  it("returns error when More options button not found", async () => {
    document.body.innerHTML = `
      <video id="sd-video" src="https://example.com/video.mp4"></video>
    `;

    const result = await clickExtendVideoFromMenu();

    expect(result.isErr()).toBe(true);
    const error = result._unsafeUnwrapErr();
    expect(error.type).toBe("element_not_found");
    expect(error).toHaveProperty("element", "more options button");
  });

  it("opens menu and clicks Extend video when video is present", async () => {
    const menuItemClicked = vi.fn();
    document.body.innerHTML = `
      <video id="sd-video" src="https://example.com/video.mp4"></video>
      <button aria-label="More options" aria-expanded="false">More</button>
    `;

    const moreBtn = document.querySelector(
      'button[aria-label="More options"]',
    ) as HTMLButtonElement;

    // Simulate menu opening on click
    moreBtn.addEventListener("click", () => {
      moreBtn.setAttribute("aria-expanded", "true");
      const menu = document.createElement("div");
      menu.setAttribute("data-radix-menu-content", "");
      menu.innerHTML = `
        <div role="menuitem" data-radix-collection-item>Delete video</div>
        <div role="menuitem" data-radix-collection-item>Extend video</div>
      `;
      document.body.appendChild(menu);

      // Add click handler to Extend video item after it's in DOM
      const extendItem = findMenuItemByText("Extend video");
      if (extendItem) {
        extendItem.addEventListener("click", menuItemClicked);
      }
    });

    const result = await clickExtendVideoFromMenu();

    expect(result.isOk()).toBe(true);
    expect(menuItemClicked).toHaveBeenCalled();
  });

  it("clicks Extend video when menu is already open", async () => {
    const menuItemClicked = vi.fn();
    document.body.innerHTML = `
      <video id="sd-video" src="https://example.com/video.mp4"></video>
      <button aria-label="More options" aria-expanded="true">More</button>
      <div data-radix-menu-content>
        <div role="menuitem" data-radix-collection-item>Delete video</div>
        <div role="menuitem" data-radix-collection-item>Extend video</div>
      </div>
    `;

    const extendItem = findMenuItemByText("Extend video");
    extendItem?.addEventListener("click", menuItemClicked);

    const result = await clickExtendVideoFromMenu();

    expect(result.isOk()).toBe(true);
    expect(menuItemClicked).toHaveBeenCalled();
  });

  it("returns error when Extend video menu item not found", async () => {
    document.body.innerHTML = `
      <video id="sd-video" src="https://example.com/video.mp4"></video>
      <button aria-label="More options" aria-expanded="true">More</button>
      <div data-radix-menu-content>
        <div role="menuitem" data-radix-collection-item>Delete video</div>
        <div role="menuitem" data-radix-collection-item>Thumbs up</div>
      </div>
    `;

    const result = await clickExtendVideoFromMenu();

    expect(result.isErr()).toBe(true);
    const error = result._unsafeUnwrapErr();
    expect(error.type).toBe("element_not_found");
  });
});

describe("navigateVideoCarousel", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("returns error when carousel container not found", () => {
    document.body.innerHTML = `<div>No carousel here</div>`;

    const result = navigateVideoCarousel("next");

    expect(result.isErr()).toBe(true);
    const error = result._unsafeUnwrapErr();
    expect(error.type).toBe("element_not_found");
    expect(error).toHaveProperty("element", "video carousel");
  });

  it("returns error when no thumbnail buttons found", () => {
    document.body.innerHTML = `
      <div class="snap-y snap-mandatory">
        <div>Empty carousel</div>
      </div>
    `;

    const result = navigateVideoCarousel("next");

    expect(result.isErr()).toBe(true);
    const error = result._unsafeUnwrapErr();
    expect(error.type).toBe("element_not_found");
    expect(error).toHaveProperty("element", "carousel items");
  });

  it("clicks next button when navigating next", () => {
    const clickHandler = vi.fn();
    document.body.innerHTML = `
      <div class="snap-y snap-mandatory">
        <button class="snap-center ring-fg-primary">Thumbnail 1</button>
        <button class="snap-center">Thumbnail 2</button>
        <button class="snap-center">Thumbnail 3</button>
      </div>
    `;

    const buttons = document.querySelectorAll("button.snap-center");
    buttons[1].addEventListener("click", clickHandler);

    const result = navigateVideoCarousel("next");

    expect(result.isOk()).toBe(true);
    expect(clickHandler).toHaveBeenCalled();
  });

  it("clicks previous button when navigating prev", () => {
    const clickHandler = vi.fn();
    document.body.innerHTML = `
      <div class="snap-y snap-mandatory">
        <button class="snap-center">Thumbnail 1</button>
        <button class="snap-center ring-fg-primary">Thumbnail 2</button>
        <button class="snap-center">Thumbnail 3</button>
      </div>
    `;

    const buttons = document.querySelectorAll("button.snap-center");
    buttons[0].addEventListener("click", clickHandler);

    const result = navigateVideoCarousel("prev");

    expect(result.isOk()).toBe(true);
    expect(clickHandler).toHaveBeenCalled();
  });

  it("does nothing when already at last and navigating next", () => {
    const clickHandler = vi.fn();
    document.body.innerHTML = `
      <div class="snap-y snap-mandatory">
        <button class="snap-center">Thumbnail 1</button>
        <button class="snap-center">Thumbnail 2</button>
        <button class="snap-center ring-fg-primary">Thumbnail 3</button>
      </div>
    `;

    const buttons = document.querySelectorAll("button.snap-center");
    buttons.forEach((btn) => btn.addEventListener("click", clickHandler));

    const result = navigateVideoCarousel("next");

    expect(result.isOk()).toBe(true);
    expect(clickHandler).not.toHaveBeenCalled();
  });

  it("does nothing when already at first and navigating prev", () => {
    const clickHandler = vi.fn();
    document.body.innerHTML = `
      <div class="snap-y snap-mandatory">
        <button class="snap-center ring-fg-primary">Thumbnail 1</button>
        <button class="snap-center">Thumbnail 2</button>
        <button class="snap-center">Thumbnail 3</button>
      </div>
    `;

    const buttons = document.querySelectorAll("button.snap-center");
    buttons.forEach((btn) => btn.addEventListener("click", clickHandler));

    const result = navigateVideoCarousel("prev");

    expect(result.isOk()).toBe(true);
    expect(clickHandler).not.toHaveBeenCalled();
  });

  it("defaults to first button when no selection found", () => {
    const clickHandler = vi.fn();
    document.body.innerHTML = `
      <div class="snap-y snap-mandatory">
        <button class="snap-center">Thumbnail 1</button>
        <button class="snap-center">Thumbnail 2</button>
        <button class="snap-center">Thumbnail 3</button>
      </div>
    `;

    const buttons = document.querySelectorAll("button.snap-center");
    buttons[0].addEventListener("click", clickHandler);

    const result = navigateVideoCarousel("next");

    expect(result.isOk()).toBe(true);
    expect(clickHandler).toHaveBeenCalled();
  });
});
