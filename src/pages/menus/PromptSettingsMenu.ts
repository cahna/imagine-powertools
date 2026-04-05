import { PageObject } from "../PageObject";
import { SELECTORS } from "../../selectors";
import { Result, ok, err } from "../../shared/result";
import type { DomError } from "../../shared/errors";

/**
 * PageObject for the "Settings" dropdown menu in the prompt area.
 * This menu has different options depending on whether an image or video is displayed:
 * - Image mode: Edit image, Make video
 * - Video mode: Mood presets (Spicy, Fun, Normal), Extend video, Redo
 */
export class PromptSettingsMenu extends PageObject {
  /** Returns true if the settings button is present. */
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
      return err({ type: "element_not_found", element: "settings button" });
    }

    if (this.isOpen()) return ok(undefined);

    this.dispatchMenuClick(btn);
    return ok(undefined);
  }

  // --- Image mode actions ---

  /** Clicks the "Edit image" menu item (image mode). */
  clickEditImage(): Result<void, DomError> {
    return this.clickMenuItem("Edit image");
  }

  /** Clicks the "Make video" menu item (image mode). */
  clickMakeVideo(): Result<void, DomError> {
    return this.clickMenuItem("Make video");
  }

  // --- Video mode actions ---

  /** Clicks a mood preset option (video mode). */
  clickMoodOption(mood: "spicy" | "fun" | "normal"): Result<void, DomError> {
    const moodText = mood.charAt(0).toUpperCase() + mood.slice(1);
    return this.clickMenuItem(moodText);
  }

  /** Clicks the "Extend video" menu item (video mode). */
  clickExtendVideo(): Result<void, DomError> {
    return this.clickMenuItem("Extend video");
  }

  /** Clicks the "Redo" menu item (video mode). */
  clickRedo(): Result<void, DomError> {
    return this.clickMenuItem("Redo");
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

  /** Returns the settings button element. */
  private getButton(): HTMLButtonElement | null {
    return this.$<HTMLButtonElement>(SELECTORS.settingsButton);
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
