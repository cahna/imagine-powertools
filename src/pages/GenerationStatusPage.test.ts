import { describe, it, expect, beforeEach } from "vitest";
import {
  GenerationStatusPage,
  type GenerationOutcome,
} from "./GenerationStatusPage";

describe("GenerationStatusPage", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  describe("isPresent()", () => {
    it("returns true when any status indicator is present", () => {
      document.body.innerHTML = `
        <div class="animate-pulse">Generating</div>
      `;

      const page = new GenerationStatusPage();

      expect(page.isPresent()).toBe(true);
    });

    it("returns true when video element is present", () => {
      document.body.innerHTML = `
        <video id="sd-video" src="video.mp4"></video>
      `;

      const page = new GenerationStatusPage();

      expect(page.isPresent()).toBe(true);
    });

    it("returns false when no status indicators are present", () => {
      document.body.innerHTML = `<div>Other content</div>`;

      const page = new GenerationStatusPage();

      expect(page.isPresent()).toBe(false);
    });
  });

  describe("isGenerating()", () => {
    it("returns true when animate-pulse element contains Generating", () => {
      document.body.innerHTML = `
        <div class="animate-pulse">Generating</div>
      `;

      const page = new GenerationStatusPage();

      expect(page.isGenerating()).toBe(true);
    });

    it("returns true when Cancel Video button is present", () => {
      document.body.innerHTML = `
        <button>Cancel Video</button>
      `;

      const page = new GenerationStatusPage();

      expect(page.isGenerating()).toBe(true);
    });

    it("returns false when no generating indicators present", () => {
      document.body.innerHTML = `
        <video id="sd-video" src="video.mp4"></video>
      `;

      const page = new GenerationStatusPage();

      expect(page.isGenerating()).toBe(false);
    });
  });

  describe("getProgress()", () => {
    it("extracts percentage from Generating text", () => {
      document.body.innerHTML = `
        <div class="animate-pulse">Generating 45%</div>
      `;

      const page = new GenerationStatusPage();

      expect(page.getProgress()).toBe("45%");
    });

    it("returns undefined when no percentage present", () => {
      document.body.innerHTML = `
        <div class="animate-pulse">Generating</div>
      `;

      const page = new GenerationStatusPage();

      expect(page.getProgress()).toBeUndefined();
    });

    it("returns undefined when not generating", () => {
      document.body.innerHTML = `
        <video id="sd-video" src="video.mp4"></video>
      `;

      const page = new GenerationStatusPage();

      expect(page.getProgress()).toBeUndefined();
    });
  });

  describe("isModerated()", () => {
    it("returns true when img[alt=Moderated] is present", () => {
      document.body.innerHTML = `
        <img alt="Moderated" src="moderated.jpg" />
      `;

      const page = new GenerationStatusPage();

      expect(page.isModerated()).toBe(true);
    });

    it("returns true when large eye-off icon is present", () => {
      document.body.innerHTML = `
        <svg class="lucide lucide-eye-off size-24"></svg>
      `;

      const page = new GenerationStatusPage();

      expect(page.isModerated()).toBe(true);
    });

    it("returns false when only small eye-off icon present (not in preview)", () => {
      document.body.innerHTML = `
        <svg class="lucide lucide-eye-off size-4"></svg>
      `;

      const page = new GenerationStatusPage();

      expect(page.isModerated()).toBe(false);
    });

    it("returns false when no moderation indicators present", () => {
      document.body.innerHTML = `
        <video id="sd-video" src="video.mp4"></video>
      `;

      const page = new GenerationStatusPage();

      expect(page.isModerated()).toBe(false);
    });
  });

  describe("isSuccess()", () => {
    it("returns true when sd-video has mp4 src", () => {
      document.body.innerHTML = `
        <video id="sd-video" src="https://example.com/video.mp4"></video>
      `;

      const page = new GenerationStatusPage();

      expect(page.isSuccess()).toBe(true);
    });

    it("returns true when hd-video has mp4 src", () => {
      document.body.innerHTML = `
        <video id="hd-video" src="https://example.com/video.mp4"></video>
      `;

      const page = new GenerationStatusPage();

      expect(page.isSuccess()).toBe(true);
    });

    it("returns false when video has no src", () => {
      document.body.innerHTML = `
        <video id="sd-video" src=""></video>
      `;

      const page = new GenerationStatusPage();

      expect(page.isSuccess()).toBe(false);
    });

    it("returns false when no video element present", () => {
      document.body.innerHTML = `<div>Content</div>`;

      const page = new GenerationStatusPage();

      expect(page.isSuccess()).toBe(false);
    });
  });

  describe("detectOutcome()", () => {
    describe("priority order", () => {
      it("rate_limited takes highest priority", () => {
        document.body.innerHTML = `
          <section aria-label="Notifications">Rate limit reached</section>
          <div class="animate-pulse">Generating 50%</div>
          <img alt="Moderated" />
          <video id="sd-video" src="video.mp4"></video>
        `;

        const page = new GenerationStatusPage();

        expect(page.detectOutcome().type).toBe("rate_limited");
      });

      it("generating takes priority over moderated and success", () => {
        document.body.innerHTML = `
          <div class="animate-pulse">Generating 50%</div>
          <img alt="Moderated" />
          <video id="sd-video" src="video.mp4"></video>
        `;

        const page = new GenerationStatusPage();
        const outcome = page.detectOutcome();

        expect(outcome.type).toBe("generating");
        if (outcome.type === "generating") {
          expect(outcome.progress).toBe("50%");
        }
      });

      it("moderated takes priority over success", () => {
        document.body.innerHTML = `
          <img alt="Moderated" />
          <video id="sd-video" src="video.mp4"></video>
        `;

        const page = new GenerationStatusPage();

        expect(page.detectOutcome().type).toBe("moderated");
      });

      it("success when only video present", () => {
        document.body.innerHTML = `
          <video id="sd-video" src="video.mp4"></video>
        `;

        const page = new GenerationStatusPage();

        expect(page.detectOutcome().type).toBe("success");
      });

      it("unknown when no indicators present", () => {
        document.body.innerHTML = `<div>Content</div>`;

        const page = new GenerationStatusPage();

        expect(page.detectOutcome().type).toBe("unknown");
      });
    });

    describe("generating with Cancel Video button", () => {
      it("detects generating from Cancel Video button", () => {
        document.body.innerHTML = `
          <button>Cancel Video</button>
          <video id="sd-video" src="video.mp4"></video>
        `;

        const page = new GenerationStatusPage();

        expect(page.detectOutcome().type).toBe("generating");
      });
    });

    describe("moderation detection patterns", () => {
      it("detects moderated from img alt", () => {
        document.body.innerHTML = `<img alt="Moderated" src="mod.jpg" />`;

        const page = new GenerationStatusPage();

        expect(page.detectOutcome().type).toBe("moderated");
      });

      it("detects moderated from large eye-off icon", () => {
        document.body.innerHTML = `
          <svg class="lucide lucide-eye-off size-24 text-primary"></svg>
        `;

        const page = new GenerationStatusPage();

        expect(page.detectOutcome().type).toBe("moderated");
      });
    });
  });

  describe("isSelectedCarouselItemModerated()", () => {
    it("returns true when selected carousel item has eye-off icon", () => {
      document.body.innerHTML = `
        <div class="snap-y snap-mandatory">
          <button class="snap-center ring-fg-primary">
            <svg class="lucide lucide-eye-off"></svg>
          </button>
        </div>
      `;

      const page = new GenerationStatusPage();

      expect(page.isSelectedCarouselItemModerated()).toBe(true);
    });

    it("returns false when selected item has no eye-off icon", () => {
      document.body.innerHTML = `
        <div class="snap-y snap-mandatory">
          <button class="snap-center ring-fg-primary">
            <img src="thumbnail.jpg" />
          </button>
        </div>
      `;

      const page = new GenerationStatusPage();

      expect(page.isSelectedCarouselItemModerated()).toBe(false);
    });

    it("returns false when no item is selected", () => {
      document.body.innerHTML = `
        <div class="snap-y snap-mandatory">
          <button class="snap-center opacity-75">
            <svg class="lucide lucide-eye-off"></svg>
          </button>
        </div>
      `;

      const page = new GenerationStatusPage();

      expect(page.isSelectedCarouselItemModerated()).toBe(false);
    });

    it("returns false when carousel not present", () => {
      document.body.innerHTML = `<div>No carousel</div>`;

      const page = new GenerationStatusPage();

      expect(page.isSelectedCarouselItemModerated()).toBe(false);
    });
  });

  describe("isPreviewAreaModerated()", () => {
    it("returns true when large eye-off icon present", () => {
      document.body.innerHTML = `
        <svg class="lucide lucide-eye-off size-24"></svg>
      `;

      const page = new GenerationStatusPage();

      expect(page.isPreviewAreaModerated()).toBe(true);
    });

    it("returns false when only small eye-off icon present", () => {
      document.body.innerHTML = `
        <svg class="lucide lucide-eye-off size-4"></svg>
      `;

      const page = new GenerationStatusPage();

      expect(page.isPreviewAreaModerated()).toBe(false);
    });

    it("returns false when no eye-off icon present", () => {
      document.body.innerHTML = `<div>Content</div>`;

      const page = new GenerationStatusPage();

      expect(page.isPreviewAreaModerated()).toBe(false);
    });
  });

  describe("document injection", () => {
    it("scopes all queries to injected document", () => {
      document.body.innerHTML = `<div>No rate limit here</div>`;

      const customDoc = document.implementation.createHTMLDocument("Custom");
      customDoc.body.innerHTML = `
        <section aria-label="Notifications">Rate limit reached</section>
      `;

      const page = new GenerationStatusPage(customDoc);

      expect(page.detectOutcome().type).toBe("rate_limited");
    });
  });
});
