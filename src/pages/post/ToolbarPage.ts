import { PageObject } from "../PageObject";
import { SELECTORS } from "../../selectors";
import { MoreOptionsMenu } from "../menus";
import { Result, ok, err } from "../../shared/result";
import type { DomError } from "../../shared/errors";

/**
 * PageObject for the right-side toolbar column on post pages.
 * Contains media type switcher, save, share, redo, download, and more options buttons.
 */
export class ToolbarPage extends PageObject {
  readonly moreOptionsMenu: MoreOptionsMenu;

  constructor(doc: Document = document) {
    super(doc);
    this.moreOptionsMenu = new MoreOptionsMenu(doc);
  }

  /** Returns true if the toolbar is present. */
  isPresent(): boolean {
    return this.getDownloadButton() !== null;
  }

  /** Returns true if video mode is selected in the media type switcher. */
  isVideoModeSelected(): boolean {
    const switcher = this.getMediaTypeSwitcher();
    if (!switcher) return false;
    // Video is the first button in the switcher
    const videoBtn = switcher.querySelector("button:first-child");
    return videoBtn?.classList.contains("bg-button-filled") ?? false;
  }

  /** Returns true if image mode is selected in the media type switcher. */
  isImageModeSelected(): boolean {
    const switcher = this.getMediaTypeSwitcher();
    if (!switcher) return false;
    // Image is the second button in the switcher
    const imageBtn = switcher.querySelector("button:nth-child(2)");
    return imageBtn?.classList.contains("bg-button-filled") ?? false;
  }

  /** Clicks the download button. */
  clickDownload(): Result<void, DomError> {
    const btn = this.getDownloadButton();
    if (!btn) {
      return err({ type: "element_not_found", element: "download button" });
    }
    btn.click();
    return ok(undefined);
  }

  /** Clicks the save/unsave button. */
  clickSave(): Result<void, DomError> {
    const btn = this.$single<HTMLButtonElement>('button[aria-label="Save"]');
    if (!btn) {
      // Try unsave variant
      const unsaveBtn = this.$single<HTMLButtonElement>(
        'button[aria-label="Unsave"]',
      );
      if (!unsaveBtn) {
        return err({ type: "element_not_found", element: "save button" });
      }
      unsaveBtn.click();
      return ok(undefined);
    }
    btn.click();
    return ok(undefined);
  }

  /** Clicks the share button. */
  clickShare(): Result<void, DomError> {
    const btn = this.$single<HTMLButtonElement>('button[aria-label="Share"]');
    if (!btn) {
      return err({ type: "element_not_found", element: "share button" });
    }
    btn.click();
    return ok(undefined);
  }

  /** Clicks the redo button. */
  clickRedo(): Result<void, DomError> {
    const btn = this.$single<HTMLButtonElement>('button[aria-label="Redo"]');
    if (!btn) {
      return err({ type: "element_not_found", element: "redo button" });
    }
    btn.click();
    return ok(undefined);
  }

  /** Returns the media type switcher container. */
  private getMediaTypeSwitcher(): HTMLElement | null {
    return this.$single('[aria-label="Media type selection"]');
  }

  /** Returns the download button element. */
  private getDownloadButton(): HTMLButtonElement | null {
    return this.$<HTMLButtonElement>(SELECTORS.downloadButton);
  }
}
