import { PageObject } from "./PageObject";
import { SELECTORS, selectFirst, selectAllFirst } from "../selectors";
import { NotificationsPage } from "./NotificationsPage";

/** Represents the current generation state. */
export type GenerationOutcome =
  | { type: "generating"; progress?: string }
  | { type: "success" }
  | { type: "moderated" }
  | { type: "rate_limited" }
  | { type: "unknown" };

/**
 * PageObject for detecting video generation status.
 * Handles detection of generating, success, moderated, and rate limited states.
 */
export class GenerationStatusPage extends PageObject {
  private notifications: NotificationsPage;

  /** Creates a GenerationStatusPage scoped to the provided document. */
  constructor(doc: Document = document) {
    super(doc);
    this.notifications = new NotificationsPage(doc);
  }

  /** Returns true if any generation status indicator is present. */
  isPresent(): boolean {
    return (
      this.isGenerating() ||
      this.isModerated() ||
      this.isSuccess() ||
      this.notifications.isRateLimited()
    );
  }

  /** Returns true if video generation is in progress. */
  isGenerating(): boolean {
    // Check for pulsing "Generating" text
    const pulseEl = this.$single(".animate-pulse");
    if (pulseEl?.textContent?.includes("Generating")) {
      return true;
    }

    // Check for Cancel Video button
    const buttons = this.$$all("button");
    for (const btn of buttons) {
      if (btn.textContent?.includes("Cancel Video")) {
        return true;
      }
    }

    return false;
  }

  /** Returns the generation progress percentage if available. */
  getProgress(): string | undefined {
    const pulseEl = this.$single(".animate-pulse");
    if (!pulseEl?.textContent?.includes("Generating")) {
      return undefined;
    }

    const match = pulseEl.textContent.match(/Generating\s*(\d+%)?/);
    return match?.[1];
  }

  /** Returns true if the current result is moderated. */
  isModerated(): boolean {
    // Check for moderated image alt
    const moderatedImg = this.$(SELECTORS.moderation.altImage);
    if (moderatedImg) return true;

    // Check for large eye-off icon in preview area
    if (this.isPreviewAreaModerated()) return true;

    // Check for selected carousel item with eye-off icon
    if (this.isSelectedCarouselItemModerated()) return true;

    return false;
  }

  /** Returns true if a successful video is present. */
  isSuccess(): boolean {
    const sdVideo = this.$single<HTMLVideoElement>("video#sd-video");
    const hdVideo = this.$single<HTMLVideoElement>("video#hd-video");

    return (
      (sdVideo?.src?.includes(".mp4") ?? false) ||
      (hdVideo?.src?.includes(".mp4") ?? false)
    );
  }

  /** Returns true if the preview area shows a moderated state (large eye-off icon). */
  isPreviewAreaModerated(): boolean {
    return this.$(SELECTORS.moderation.largeIcon) !== null;
  }

  /** Returns true if the currently selected carousel item is moderated. */
  isSelectedCarouselItemModerated(): boolean {
    const container = this.$(SELECTORS.carousel.container);
    if (!container) return false;

    // Find selected item (has ring-fg-primary class)
    const items = selectAllFirst(container, SELECTORS.carousel.item);
    if (!items) return false;

    for (const item of items) {
      if (item.classList.contains(SELECTORS.carousel.selectedClass)) {
        // Check if it has eye-off icon
        return selectFirst(item, SELECTORS.moderation.icon) !== null;
      }
    }

    return false;
  }

  /**
   * Detects the current generation outcome with priority ordering:
   * rate_limited > generating > moderated > success > unknown
   */
  detectOutcome(): GenerationOutcome {
    // Check rate limit first (highest priority - stop immediately)
    if (this.notifications.isRateLimited()) {
      return { type: "rate_limited" };
    }

    // Check for generation in progress
    if (this.isGenerating()) {
      return { type: "generating", progress: this.getProgress() };
    }

    // Check for moderation
    if (this.isModerated()) {
      return { type: "moderated" };
    }

    // Check for successful video
    if (this.isSuccess()) {
      return { type: "success" };
    }

    return { type: "unknown" };
  }
}
