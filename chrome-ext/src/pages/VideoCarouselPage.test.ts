import { describe, it, expect, beforeEach, vi } from "vitest";
import { VideoCarouselPage } from "./VideoCarouselPage";

describe("VideoCarouselPage", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  describe("isPresent()", () => {
    it("returns true when carousel container exists", () => {
      document.body.innerHTML = `
        <div class="snap-y snap-mandatory">
          <button class="snap-center">Thumbnail</button>
        </div>
      `;

      const page = new VideoCarouselPage();

      expect(page.isPresent()).toBe(true);
    });

    it("returns false when carousel container does not exist", () => {
      document.body.innerHTML = `<div>Other content</div>`;

      const page = new VideoCarouselPage();

      expect(page.isPresent()).toBe(false);
    });
  });

  describe("getItems()", () => {
    it("returns all carousel item buttons", () => {
      document.body.innerHTML = `
        <div class="snap-y snap-mandatory">
          <button class="snap-center">1</button>
          <button class="snap-center">2</button>
          <button class="snap-center">3</button>
        </div>
      `;

      const page = new VideoCarouselPage();

      expect(page.getItems()).toHaveLength(3);
    });

    it("returns empty array when carousel not present", () => {
      document.body.innerHTML = `<div>Content</div>`;

      const page = new VideoCarouselPage();

      expect(page.getItems()).toHaveLength(0);
    });

    it("returns empty array when carousel has no items", () => {
      document.body.innerHTML = `
        <div class="snap-y snap-mandatory"></div>
      `;

      const page = new VideoCarouselPage();

      expect(page.getItems()).toHaveLength(0);
    });
  });

  describe("getItemCount()", () => {
    it("returns correct count of carousel items", () => {
      document.body.innerHTML = `
        <div class="snap-y snap-mandatory">
          <button class="snap-center">1</button>
          <button class="snap-center">2</button>
          <button class="snap-center">3</button>
        </div>
      `;

      const page = new VideoCarouselPage();

      expect(page.getItemCount()).toBe(3);
    });

    it("returns 0 when carousel not present", () => {
      document.body.innerHTML = `<div>Content</div>`;

      const page = new VideoCarouselPage();

      expect(page.getItemCount()).toBe(0);
    });
  });

  describe("getSelectedIndex()", () => {
    it("returns index of selected item", () => {
      document.body.innerHTML = `
        <div class="snap-y snap-mandatory">
          <button class="snap-center">1</button>
          <button class="snap-center ring-fg-primary">2</button>
          <button class="snap-center">3</button>
        </div>
      `;

      const page = new VideoCarouselPage();

      expect(page.getSelectedIndex()).toBe(1);
    });

    it("returns -1 when no item is selected", () => {
      document.body.innerHTML = `
        <div class="snap-y snap-mandatory">
          <button class="snap-center">1</button>
          <button class="snap-center">2</button>
        </div>
      `;

      const page = new VideoCarouselPage();

      expect(page.getSelectedIndex()).toBe(-1);
    });

    it("returns -1 when carousel not present", () => {
      document.body.innerHTML = `<div>Content</div>`;

      const page = new VideoCarouselPage();

      expect(page.getSelectedIndex()).toBe(-1);
    });
  });

  describe("isItemModerated()", () => {
    it("returns true when item has eye-off icon", () => {
      document.body.innerHTML = `
        <div class="snap-y snap-mandatory">
          <button class="snap-center" id="item">
            <svg class="lucide lucide-eye-off"></svg>
          </button>
        </div>
      `;

      const page = new VideoCarouselPage();
      const item = document.getElementById("item") as HTMLElement;

      expect(page.isItemModerated(item)).toBe(true);
    });

    it("returns false when item has no eye-off icon", () => {
      document.body.innerHTML = `
        <div class="snap-y snap-mandatory">
          <button class="snap-center" id="item">
            <img src="thumbnail.jpg" />
          </button>
        </div>
      `;

      const page = new VideoCarouselPage();
      const item = document.getElementById("item") as HTMLElement;

      expect(page.isItemModerated(item)).toBe(false);
    });
  });

  describe("selectItem()", () => {
    it("clicks the item at specified index", () => {
      const clickHandler = vi.fn();
      document.body.innerHTML = `
        <div class="snap-y snap-mandatory">
          <button class="snap-center" id="btn1">1</button>
          <button class="snap-center" id="btn2">2</button>
        </div>
      `;
      document.getElementById("btn2")!.addEventListener("click", clickHandler);

      const page = new VideoCarouselPage();
      const result = page.selectItem(1);

      expect(result.isOk()).toBe(true);
      expect(clickHandler).toHaveBeenCalled();
    });

    it("returns error for out of range index", () => {
      document.body.innerHTML = `
        <div class="snap-y snap-mandatory">
          <button class="snap-center">1</button>
        </div>
      `;

      const page = new VideoCarouselPage();

      expect(page.selectItem(5).isErr()).toBe(true);
      expect(page.selectItem(-1).isErr()).toBe(true);
    });

    it("returns error when carousel not present", () => {
      document.body.innerHTML = `<div>Content</div>`;

      const page = new VideoCarouselPage();

      expect(page.selectItem(0).isErr()).toBe(true);
    });
  });

  describe("navigateNext()", () => {
    it("clicks the next item", () => {
      const clickHandler = vi.fn();
      document.body.innerHTML = `
        <div class="snap-y snap-mandatory">
          <button class="snap-center ring-fg-primary">1</button>
          <button class="snap-center" id="btn2">2</button>
          <button class="snap-center">3</button>
        </div>
      `;
      document.getElementById("btn2")!.addEventListener("click", clickHandler);

      const page = new VideoCarouselPage();
      const result = page.navigateNext();

      expect(result.isOk()).toBe(true);
      expect(clickHandler).toHaveBeenCalled();
    });

    it("returns true but does not click when already at last item", () => {
      const clickHandler = vi.fn();
      document.body.innerHTML = `
        <div class="snap-y snap-mandatory">
          <button class="snap-center">1</button>
          <button class="snap-center ring-fg-primary" id="last">2</button>
        </div>
      `;
      document.querySelectorAll("button").forEach((btn) => {
        btn.addEventListener("click", clickHandler);
      });

      const page = new VideoCarouselPage();
      const result = page.navigateNext();

      expect(result.isOk()).toBe(true);
      expect(clickHandler).not.toHaveBeenCalled();
    });

    it("clicks first item when no selection", () => {
      const clickHandler = vi.fn();
      document.body.innerHTML = `
        <div class="snap-y snap-mandatory">
          <button class="snap-center" id="first">1</button>
          <button class="snap-center">2</button>
        </div>
      `;
      document.getElementById("first")!.addEventListener("click", clickHandler);

      const page = new VideoCarouselPage();
      const result = page.navigateNext();

      expect(result.isOk()).toBe(true);
      expect(clickHandler).toHaveBeenCalled();
    });

    it("returns error when carousel not present", () => {
      document.body.innerHTML = `<div>Content</div>`;

      const page = new VideoCarouselPage();

      expect(page.navigateNext().isErr()).toBe(true);
    });
  });

  describe("navigatePrev()", () => {
    it("clicks the previous item", () => {
      const clickHandler = vi.fn();
      document.body.innerHTML = `
        <div class="snap-y snap-mandatory">
          <button class="snap-center" id="btn1">1</button>
          <button class="snap-center ring-fg-primary">2</button>
          <button class="snap-center">3</button>
        </div>
      `;
      document.getElementById("btn1")!.addEventListener("click", clickHandler);

      const page = new VideoCarouselPage();
      const result = page.navigatePrev();

      expect(result.isOk()).toBe(true);
      expect(clickHandler).toHaveBeenCalled();
    });

    it("returns true but does not click when already at first item", () => {
      const clickHandler = vi.fn();
      document.body.innerHTML = `
        <div class="snap-y snap-mandatory">
          <button class="snap-center ring-fg-primary">1</button>
          <button class="snap-center">2</button>
        </div>
      `;
      document.querySelectorAll("button").forEach((btn) => {
        btn.addEventListener("click", clickHandler);
      });

      const page = new VideoCarouselPage();
      const result = page.navigatePrev();

      expect(result.isOk()).toBe(true);
      expect(clickHandler).not.toHaveBeenCalled();
    });
  });

  describe("selectFirstValid()", () => {
    it("clicks first non-moderated item", () => {
      const clickHandler = vi.fn();
      document.body.innerHTML = `
        <div class="snap-y snap-mandatory">
          <button class="snap-center">
            <svg class="lucide lucide-eye-off"></svg>
          </button>
          <button class="snap-center" id="valid">
            <img src="thumbnail.jpg" />
          </button>
        </div>
      `;
      document.getElementById("valid")!.addEventListener("click", clickHandler);

      const page = new VideoCarouselPage();
      const result = page.selectFirstValid();

      expect(result.isOk()).toBe(true);
      expect(clickHandler).toHaveBeenCalled();
    });

    it("clicks first item when none are moderated", () => {
      const clickHandler = vi.fn();
      document.body.innerHTML = `
        <div class="snap-y snap-mandatory">
          <button class="snap-center" id="first">
            <img src="thumb1.jpg" />
          </button>
          <button class="snap-center">
            <img src="thumb2.jpg" />
          </button>
        </div>
      `;
      document.getElementById("first")!.addEventListener("click", clickHandler);

      const page = new VideoCarouselPage();
      const result = page.selectFirstValid();

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

      const page = new VideoCarouselPage();

      expect(page.selectFirstValid().isErr()).toBe(true);
    });

    it("returns error when carousel not present", () => {
      document.body.innerHTML = `<div>Content</div>`;

      const page = new VideoCarouselPage();

      expect(page.selectFirstValid().isErr()).toBe(true);
    });
  });

  describe("selectByVideoId()", () => {
    it("clicks carousel item matching video ID in preview_image.jpg URL", () => {
      const clickHandler = vi.fn();
      document.body.innerHTML = `
        <div class="snap-y snap-mandatory">
          <button class="snap-center">
            <img src="https://assets.grok.com/generated/abc-123/preview_image.jpg" />
          </button>
          <button class="snap-center" id="target">
            <img src="https://assets.grok.com/generated/xyz-789/preview_image.jpg" />
          </button>
        </div>
      `;
      document
        .getElementById("target")!
        .addEventListener("click", clickHandler);

      const page = new VideoCarouselPage();
      const result = page.selectByVideoId("xyz-789");

      expect(result.isOk()).toBe(true);
      expect(clickHandler).toHaveBeenCalled();
    });

    it("clicks carousel item matching video ID in share-videos URL", () => {
      const clickHandler = vi.fn();
      document.body.innerHTML = `
        <div class="snap-y snap-mandatory">
          <button class="snap-center" id="target">
            <img src="https://imagine-public.x.ai/share-videos/abc-123_thumbnail.jpg" />
          </button>
        </div>
      `;
      document
        .getElementById("target")!
        .addEventListener("click", clickHandler);

      const page = new VideoCarouselPage();
      const result = page.selectByVideoId("abc-123");

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

      const page = new VideoCarouselPage();

      expect(page.selectByVideoId("nonexistent").isErr()).toBe(true);
    });

    it("returns error when carousel not present", () => {
      document.body.innerHTML = `<div>Content</div>`;

      const page = new VideoCarouselPage();

      expect(page.selectByVideoId("any-id").isErr()).toBe(true);
    });
  });

  describe("document injection", () => {
    it("scopes all queries to injected document", () => {
      document.body.innerHTML = `<div>No carousel here</div>`;

      const customDoc = document.implementation.createHTMLDocument("Custom");
      customDoc.body.innerHTML = `
        <div class="snap-y snap-mandatory">
          <button class="snap-center ring-fg-primary">1</button>
          <button class="snap-center">2</button>
        </div>
      `;

      const page = new VideoCarouselPage(customDoc);

      expect(page.isPresent()).toBe(true);
      expect(page.getItemCount()).toBe(2);
      expect(page.getSelectedIndex()).toBe(0);
    });
  });
});
