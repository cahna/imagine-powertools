import { describe, it, expect, beforeEach, vi } from "vitest";
import { MoreOptionsMenu } from "./MoreOptionsMenu";

describe("MoreOptionsMenu", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  describe("isPresent()", () => {
    it("returns true when more options button exists with data-testid", () => {
      document.body.innerHTML = `
        <button data-testid="more-options-button">More</button>
      `;

      const menu = new MoreOptionsMenu();
      expect(menu.isPresent()).toBe(true);
    });

    it("returns true when more options button exists with aria-label", () => {
      document.body.innerHTML = `
        <button aria-label="More options">...</button>
      `;

      const menu = new MoreOptionsMenu();
      expect(menu.isPresent()).toBe(true);
    });

    it("returns false when no more options button exists", () => {
      document.body.innerHTML = `<div>No button here</div>`;

      const menu = new MoreOptionsMenu();
      expect(menu.isPresent()).toBe(false);
    });
  });

  describe("isOpen()", () => {
    it("returns true when button has aria-expanded=true", () => {
      document.body.innerHTML = `
        <button aria-label="More options" aria-expanded="true">...</button>
      `;

      const menu = new MoreOptionsMenu();
      expect(menu.isOpen()).toBe(true);
    });

    it("returns false when button has aria-expanded=false", () => {
      document.body.innerHTML = `
        <button aria-label="More options" aria-expanded="false">...</button>
      `;

      const menu = new MoreOptionsMenu();
      expect(menu.isOpen()).toBe(false);
    });

    it("returns false when button has no aria-expanded", () => {
      document.body.innerHTML = `
        <button aria-label="More options">...</button>
      `;

      const menu = new MoreOptionsMenu();
      expect(menu.isOpen()).toBe(false);
    });

    it("returns false when no button exists", () => {
      document.body.innerHTML = `<div>No button</div>`;

      const menu = new MoreOptionsMenu();
      expect(menu.isOpen()).toBe(false);
    });
  });

  describe("open()", () => {
    it("returns ok when button exists and is closed", () => {
      document.body.innerHTML = `
        <button aria-label="More options" aria-expanded="false">...</button>
      `;

      const menu = new MoreOptionsMenu();
      const result = menu.open();

      expect(result.isOk()).toBe(true);
    });

    it("returns ok immediately when already open", () => {
      document.body.innerHTML = `
        <button aria-label="More options" aria-expanded="true">...</button>
      `;

      const menu = new MoreOptionsMenu();
      const result = menu.open();

      expect(result.isOk()).toBe(true);
    });

    it("returns error when button not found", () => {
      document.body.innerHTML = `<div>No button</div>`;

      const menu = new MoreOptionsMenu();
      const result = menu.open();

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("element_not_found");
      }
    });

    it("dispatches click events when opening", () => {
      document.body.innerHTML = `
        <button aria-label="More options" aria-expanded="false">...</button>
      `;
      const button = document.querySelector("button")!;
      const clickSpy = vi.fn();
      button.addEventListener("click", clickSpy);

      const menu = new MoreOptionsMenu();
      menu.open();

      expect(clickSpy).toHaveBeenCalled();
    });
  });

  describe("clickMenuItem()", () => {
    it("clicks menu item with matching text", () => {
      document.body.innerHTML = `
        <button aria-label="More options" aria-expanded="true">...</button>
        <div data-radix-menu-content>
          <div role="menuitem" data-radix-collection-item>Delete</div>
          <div role="menuitem" data-radix-collection-item>Extend video</div>
        </div>
      `;

      const extendItem = document.querySelectorAll('[role="menuitem"]')[1];
      const clickSpy = vi.fn();
      extendItem.addEventListener("click", clickSpy);

      const menu = new MoreOptionsMenu();
      const result = menu.clickMenuItem("Extend video");

      expect(result.isOk()).toBe(true);
      expect(clickSpy).toHaveBeenCalled();
    });

    it("returns error when menu item not found", () => {
      document.body.innerHTML = `
        <button aria-label="More options" aria-expanded="true">...</button>
        <div data-radix-menu-content>
          <div role="menuitem" data-radix-collection-item>Delete</div>
        </div>
      `;

      const menu = new MoreOptionsMenu();
      const result = menu.clickMenuItem("Nonexistent");

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("element_not_found");
      }
    });

    it("matches partial text", () => {
      document.body.innerHTML = `
        <div data-radix-menu-content>
          <div role="menuitem" data-radix-collection-item>
            <span>Extend video</span>
            <span class="shortcut">E</span>
          </div>
        </div>
      `;

      const menuItem = document.querySelector('[role="menuitem"]')!;
      const clickSpy = vi.fn();
      menuItem.addEventListener("click", clickSpy);

      const menu = new MoreOptionsMenu();
      const result = menu.clickMenuItem("Extend");

      expect(result.isOk()).toBe(true);
      expect(clickSpy).toHaveBeenCalled();
    });
  });

  describe("clickExtendVideo()", () => {
    it("clicks Extend video menu item", () => {
      document.body.innerHTML = `
        <div data-radix-menu-content>
          <div role="menuitem" data-radix-collection-item>Extend video</div>
        </div>
      `;

      const menuItem = document.querySelector('[role="menuitem"]')!;
      const clickSpy = vi.fn();
      menuItem.addEventListener("click", clickSpy);

      const menu = new MoreOptionsMenu();
      const result = menu.clickExtendVideo();

      expect(result.isOk()).toBe(true);
      expect(clickSpy).toHaveBeenCalled();
    });
  });

  describe("clickDelete()", () => {
    it("clicks Delete menu item", () => {
      document.body.innerHTML = `
        <div data-radix-menu-content>
          <div role="menuitem" data-radix-collection-item>Delete</div>
        </div>
      `;

      const menuItem = document.querySelector('[role="menuitem"]')!;
      const clickSpy = vi.fn();
      menuItem.addEventListener("click", clickSpy);

      const menu = new MoreOptionsMenu();
      const result = menu.clickDelete();

      expect(result.isOk()).toBe(true);
      expect(clickSpy).toHaveBeenCalled();
    });
  });

  describe("clickThumbsUp()", () => {
    it("clicks Thumbs up menu item", () => {
      document.body.innerHTML = `
        <div data-radix-menu-content>
          <div role="menuitem" data-radix-collection-item>Thumbs up</div>
        </div>
      `;

      const menuItem = document.querySelector('[role="menuitem"]')!;
      const clickSpy = vi.fn();
      menuItem.addEventListener("click", clickSpy);

      const menu = new MoreOptionsMenu();
      const result = menu.clickThumbsUp();

      expect(result.isOk()).toBe(true);
      expect(clickSpy).toHaveBeenCalled();
    });
  });

  describe("clickThumbsDown()", () => {
    it("clicks Thumbs down menu item", () => {
      document.body.innerHTML = `
        <div data-radix-menu-content>
          <div role="menuitem" data-radix-collection-item>Thumbs down</div>
        </div>
      `;

      const menuItem = document.querySelector('[role="menuitem"]')!;
      const clickSpy = vi.fn();
      menuItem.addEventListener("click", clickSpy);

      const menu = new MoreOptionsMenu();
      const result = menu.clickThumbsDown();

      expect(result.isOk()).toBe(true);
      expect(clickSpy).toHaveBeenCalled();
    });
  });

  describe("findMenuItem()", () => {
    it("finds menu item by text", () => {
      document.body.innerHTML = `
        <div data-radix-menu-content>
          <div role="menuitem" data-radix-collection-item>Delete</div>
          <div role="menuitem" data-radix-collection-item>Extend video</div>
        </div>
      `;

      const menu = new MoreOptionsMenu();
      const item = menu.findMenuItem("Extend video");

      expect(item).not.toBeNull();
      expect(item?.textContent).toContain("Extend video");
    });

    it("returns null when item not found", () => {
      document.body.innerHTML = `
        <div data-radix-menu-content>
          <div role="menuitem" data-radix-collection-item>Delete</div>
        </div>
      `;

      const menu = new MoreOptionsMenu();
      const item = menu.findMenuItem("Nonexistent");

      expect(item).toBeNull();
    });

    it("returns null when no menu content exists", () => {
      document.body.innerHTML = `<div>No menu</div>`;

      const menu = new MoreOptionsMenu();
      const item = menu.findMenuItem("Anything");

      expect(item).toBeNull();
    });
  });

  describe("document injection", () => {
    it("scopes queries to injected document", () => {
      document.body.innerHTML = `<div>No menu in global doc</div>`;

      const customDoc = document.implementation.createHTMLDocument("Custom");
      customDoc.body.innerHTML = `
        <button aria-label="More options" aria-expanded="true">...</button>
        <div data-radix-menu-content>
          <div role="menuitem" data-radix-collection-item>Extend video</div>
        </div>
      `;

      const menu = new MoreOptionsMenu(customDoc);

      expect(menu.isPresent()).toBe(true);
      expect(menu.isOpen()).toBe(true);
      expect(menu.findMenuItem("Extend video")).not.toBeNull();
    });
  });
});
