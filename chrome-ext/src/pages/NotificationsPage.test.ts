import { describe, it, expect, beforeEach } from "vitest";
import { NotificationsPage } from "./NotificationsPage";

describe("NotificationsPage", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  describe("isPresent()", () => {
    it("returns true when notifications section exists", () => {
      document.body.innerHTML = `
        <section aria-label="Notifications">
          <div>Some notification</div>
        </section>
      `;

      const page = new NotificationsPage();

      expect(page.isPresent()).toBe(true);
    });

    it("returns true when notifications section has keyboard hint in aria-label", () => {
      document.body.innerHTML = `
        <section aria-label="Notifications alt+T">
          <div>Some notification</div>
        </section>
      `;

      const page = new NotificationsPage();

      expect(page.isPresent()).toBe(true);
    });

    it("returns false when notifications section does not exist", () => {
      document.body.innerHTML = `<div>Other content</div>`;

      const page = new NotificationsPage();

      expect(page.isPresent()).toBe(false);
    });
  });

  describe("isRateLimited()", () => {
    it("returns true when rate limit message is present", () => {
      document.body.innerHTML = `
        <section aria-label="Notifications">
          <span>Rate limit reached</span>
        </section>
      `;

      const page = new NotificationsPage();

      expect(page.isRateLimited()).toBe(true);
    });

    it("returns true when rate limit message is nested deeply", () => {
      document.body.innerHTML = `
        <section aria-label="Notifications alt+T">
          <div>
            <div>
              <span>Rate limit reached. Please try again later.</span>
            </div>
          </div>
        </section>
      `;

      const page = new NotificationsPage();

      expect(page.isRateLimited()).toBe(true);
    });

    it("returns false when notifications exist but no rate limit", () => {
      document.body.innerHTML = `
        <section aria-label="Notifications">
          <span>Video generated successfully</span>
        </section>
      `;

      const page = new NotificationsPage();

      expect(page.isRateLimited()).toBe(false);
    });

    it("returns false when no notifications section exists", () => {
      document.body.innerHTML = `<div>Content</div>`;

      const page = new NotificationsPage();

      expect(page.isRateLimited()).toBe(false);
    });
  });

  describe("getNotificationText()", () => {
    it("returns full text content of notifications section", () => {
      document.body.innerHTML = `
        <section aria-label="Notifications">
          <span>Video generated successfully</span>
        </section>
      `;

      const page = new NotificationsPage();

      expect(page.getNotificationText()).toContain(
        "Video generated successfully",
      );
    });

    it("returns null when no notifications section exists", () => {
      document.body.innerHTML = `<div>Content</div>`;

      const page = new NotificationsPage();

      expect(page.getNotificationText()).toBeNull();
    });

    it("returns combined text from multiple notification items", () => {
      document.body.innerHTML = `
        <section aria-label="Notifications">
          <div>First notification</div>
          <div>Second notification</div>
        </section>
      `;

      const page = new NotificationsPage();
      const text = page.getNotificationText();

      expect(text).toContain("First notification");
      expect(text).toContain("Second notification");
    });
  });

  describe("containsText()", () => {
    it("returns true when notifications contain the specified text", () => {
      document.body.innerHTML = `
        <section aria-label="Notifications">
          <span>Your video has been moderated</span>
        </section>
      `;

      const page = new NotificationsPage();

      expect(page.containsText("moderated")).toBe(true);
    });

    it("returns false when notifications do not contain the text", () => {
      document.body.innerHTML = `
        <section aria-label="Notifications">
          <span>Video generated successfully</span>
        </section>
      `;

      const page = new NotificationsPage();

      expect(page.containsText("moderated")).toBe(false);
    });

    it("returns false when no notifications exist", () => {
      document.body.innerHTML = `<div>Content</div>`;

      const page = new NotificationsPage();

      expect(page.containsText("anything")).toBe(false);
    });
  });

  describe("document injection", () => {
    it("scopes queries to injected document", () => {
      // Global document has no notifications
      document.body.innerHTML = `<div>No notifications here</div>`;

      // Custom document has notifications
      const customDoc = document.implementation.createHTMLDocument("Custom");
      customDoc.body.innerHTML = `
        <section aria-label="Notifications">
          <span>Rate limit reached</span>
        </section>
      `;

      const page = new NotificationsPage(customDoc);

      expect(page.isPresent()).toBe(true);
      expect(page.isRateLimited()).toBe(true);
    });
  });
});
