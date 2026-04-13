import { PageObject } from "../PageObject";
import { SELECTORS } from "../../selectors";
import { Result, ok, err } from "../../shared/result";
import type { DomError } from "../../shared/errors";

/**
 * PageObject for the "More options" dropdown menu in the toolbar.
 * This menu appears in both image and video modes and contains actions like
 * extend video, delete, thumbs up/down, and tags.
 */
export class MoreOptionsMenu extends PageObject {
  /** Returns true if the more options button is present. */
  isPresent(): boolean {
    return this.getButton() !== null;
  }

  /** Returns true if the menu is currently open. */
  isOpen(): boolean {
    return this.getButton()?.getAttribute("aria-expanded") === "true";
  }

  /** Opens the menu if not already open. */
  open(): Result<void, DomError> {
    const btn = this.getButton();
    if (!btn) {
      return err({ type: "element_not_found", element: "more options button" });
    }

    if (this.isOpen()) return ok(undefined);

    this.dispatchMenuClick(btn);
    return ok(undefined);
  }

  /** Clicks the "Extend" menu item. */
  clickExtendVideo(): Result<void, DomError> {
    return this.clickMenuItem("Extend");
  }

  /** Clicks the "Remix" menu item. */
  clickRemix(): Result<void, DomError> {
    return this.clickMenuItem("Remix");
  }

  /** Clicks a mood preset option (Spicy or Normal). */
  clickMoodOption(mood: "spicy" | "normal"): Result<void, DomError> {
    const moodText = mood.charAt(0).toUpperCase() + mood.slice(1);
    return this.clickMenuItem(moodText);
  }

  /** Clicks the "Delete" menu item. */
  clickDelete(): Result<void, DomError> {
    return this.clickMenuItem("Delete");
  }

  /** Clicks the "Thumbs up" menu item. */
  clickThumbsUp(): Result<void, DomError> {
    return this.clickMenuItem("Thumbs up");
  }

  /** Clicks the "Thumbs down" menu item. */
  clickThumbsDown(): Result<void, DomError> {
    return this.clickMenuItem("Thumbs down");
  }

  /** Clicks a menu item with the specified text. */
  clickMenuItem(text: string): Result<void, DomError> {
    const item = this.findMenuItem(text);
    if (!item) {
      return err({ type: "element_not_found", element: `menu item "${text}"` });
    }

    this.dispatchMenuClick(item as HTMLElement);
    return ok(undefined);
  }

  /** Finds a menu item by its text content (supports partial match). */
  findMenuItem(text: string): Element | null {
    const menuItems = this.$$(SELECTORS.menu.item);
    if (!menuItems) return null;

    for (const item of menuItems) {
      if (item.textContent?.includes(text)) {
        return item;
      }
    }
    return null;
  }

  /** Returns the more options button element. */
  private getButton(): HTMLButtonElement | null {
    return this.$<HTMLButtonElement>(SELECTORS.moreOptionsButton);
  }

  /** Dispatches pointer and click events for Radix UI menu compatibility. */
  private dispatchMenuClick(element: HTMLElement): void {
    element.focus();

    element.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        cancelable: true,
        pointerType: "mouse",
      }),
    );

    element.dispatchEvent(
      new PointerEvent("pointerup", {
        bubbles: true,
        cancelable: true,
        pointerType: "mouse",
      }),
    );

    element.dispatchEvent(
      new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
      }),
    );
  }
}
