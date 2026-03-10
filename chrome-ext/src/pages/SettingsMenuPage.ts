import { PageObject } from "./PageObject";
import { SELECTORS } from "../selectors";
import { Result, ok, err } from "../shared/result";
import type { DomError } from "../shared/errors";

/**
 * PageObject for interacting with Settings and More Options menus.
 * Handles opening menus and clicking menu items.
 */
export class SettingsMenuPage extends PageObject {
  /** Returns true if any menu button is present. */
  isPresent(): boolean {
    return (
      this.getSettingsButton() !== null || this.getMoreOptionsButton() !== null
    );
  }

  /** Returns true if the settings menu is currently open. */
  isSettingsMenuOpen(): boolean {
    const btn = this.getSettingsButton();
    return btn?.getAttribute("aria-expanded") === "true";
  }

  /** Returns true if the more options menu is currently open. */
  isMoreOptionsMenuOpen(): boolean {
    const btn = this.getMoreOptionsButton();
    return btn?.getAttribute("aria-expanded") === "true";
  }

  /** Opens the settings menu if not already open. */
  openSettingsMenu(): Result<void, DomError> {
    const btn = this.getSettingsButton();
    if (!btn) {
      return err({ type: "element_not_found", element: "settings button" });
    }

    if (this.isSettingsMenuOpen()) return ok(undefined);

    this.dispatchMenuClick(btn);
    return ok(undefined);
  }

  /** Opens the more options menu if not already open. */
  openMoreOptionsMenu(): Result<void, DomError> {
    const btn = this.getMoreOptionsButton();
    if (!btn) {
      return err({ type: "element_not_found", element: "more options button" });
    }

    if (this.isMoreOptionsMenuOpen()) return ok(undefined);

    this.dispatchMenuClick(btn);
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

  /** Clicks a menu item with the specified text. */
  clickMenuItem(text: string): Result<void, DomError> {
    const item = this.findMenuItem(text);
    if (!item) {
      return err({ type: "element_not_found", element: `menu item "${text}"` });
    }

    this.dispatchMenuClick(item as HTMLElement);
    return ok(undefined);
  }

  /** Clicks a mood option (spicy, fun, normal) in the settings menu. */
  clickMoodOption(option: string): Result<void, DomError> {
    // Capitalize first letter for matching (e.g., "spicy" -> "Spicy")
    const moodText = option.charAt(0).toUpperCase() + option.slice(1);
    return this.clickMenuItem(moodText);
  }

  /** Clicks the Extend video menu item. */
  clickExtendVideo(): Result<void, DomError> {
    return this.clickMenuItem("Extend video");
  }

  /** Returns the settings button element. */
  private getSettingsButton(): HTMLButtonElement | null {
    return this.$<HTMLButtonElement>(SELECTORS.settingsButton);
  }

  /** Returns the more options button element. */
  private getMoreOptionsButton(): HTMLButtonElement | null {
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
