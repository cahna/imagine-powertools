import { PageObject } from "./PageObject";
import { SELECTORS } from "../selectors";

/**
 * PageObject for interacting with notification toasts.
 * Used to detect rate limiting and other system messages.
 */
export class NotificationsPage extends PageObject {
  /** Returns true if the notifications section is present in the DOM. */
  isPresent(): boolean {
    return this.getContainer() !== null;
  }

  /** Returns true if a rate limit notification is currently displayed. */
  isRateLimited(): boolean {
    return this.containsText(SELECTORS.notifications.rateLimitText);
  }

  /** Returns the full text content of the notifications section. */
  getNotificationText(): string | null {
    const container = this.getContainer();
    return container?.textContent ?? null;
  }

  /** Returns true if the notifications section contains the specified text. */
  containsText(text: string): boolean {
    const content = this.getNotificationText();
    return content?.includes(text) ?? false;
  }

  /** Returns the notifications container element. */
  private getContainer(): Element | null {
    return this.$(SELECTORS.notifications.container);
  }
}
