import { PageObject } from "./PageObject";
import { SELECTORS, selectFirst, selectAllFirst } from "../selectors";

/**
 * PageObject for interacting with the video thumbnail carousel.
 * Handles navigation, selection, and moderation detection.
 */
export class VideoCarouselPage extends PageObject {
  /** Returns true if the carousel is present in the DOM. */
  isPresent(): boolean {
    return this.getContainer() !== null;
  }

  /** Returns all carousel item buttons. */
  getItems(): HTMLButtonElement[] {
    const container = this.getContainer();
    if (!container) return [];

    const items = selectAllFirst<HTMLButtonElement>(
      container,
      SELECTORS.carousel.item,
    );
    return items ? Array.from(items) : [];
  }

  /** Returns the number of items in the carousel. */
  getItemCount(): number {
    return this.getItems().length;
  }

  /** Returns the index of the currently selected item, or -1 if none selected. */
  getSelectedIndex(): number {
    const items = this.getItems();
    return items.findIndex((btn) =>
      btn.classList.contains(SELECTORS.carousel.selectedClass),
    );
  }

  /** Returns true if the given item element contains a moderation indicator. */
  isItemModerated(item: HTMLElement): boolean {
    return selectFirst(item, SELECTORS.moderation.icon) !== null;
  }

  /** Clicks the carousel item at the specified index. */
  selectItem(index: number): boolean {
    const items = this.getItems();
    if (index < 0 || index >= items.length) return false;

    items[index].click();
    return true;
  }

  /** Navigates to the next carousel item. Returns false if carousel not present. */
  navigateNext(): boolean {
    const items = this.getItems();
    if (items.length === 0) return false;

    const currentIndex = this.getSelectedIndex();

    // If no selection, click first item
    if (currentIndex === -1) {
      items[0].click();
      return true;
    }

    // If already at last, do nothing but return success
    if (currentIndex >= items.length - 1) {
      return true;
    }

    items[currentIndex + 1].click();
    return true;
  }

  /** Navigates to the previous carousel item. Returns false if carousel not present. */
  navigatePrev(): boolean {
    const items = this.getItems();
    if (items.length === 0) return false;

    const currentIndex = this.getSelectedIndex();

    // If no selection or already at first, do nothing but return success
    if (currentIndex <= 0) {
      return true;
    }

    items[currentIndex - 1].click();
    return true;
  }

  /** Selects the first non-moderated carousel item. */
  selectFirstValid(): boolean {
    const items = this.getItems();

    for (const item of items) {
      if (!this.isItemModerated(item)) {
        item.click();
        return true;
      }
    }

    return false;
  }

  /** Selects the carousel item matching the given video ID in its thumbnail URL. */
  selectByVideoId(videoId: string): boolean {
    const items = this.getItems();

    for (const item of items) {
      const img = item.querySelector("img");
      if (img?.src?.includes(videoId)) {
        item.click();
        return true;
      }
    }

    return false;
  }

  /** Returns the carousel container element. */
  private getContainer(): Element | null {
    return this.$(SELECTORS.carousel.container);
  }
}
