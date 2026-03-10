import { describe, it, expect, beforeEach, vi } from "vitest";
import { SettingsMenuPage } from "./SettingsMenuPage";

describe("SettingsMenuPage", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  describe("isPresent()", () => {
    it("returns true when settings button is present", () => {
      document.body.innerHTML = `
        <button aria-label="Settings">Settings</button>
      `;

      const page = new SettingsMenuPage();

      expect(page.isPresent()).toBe(true);
    });

    it("returns true when more options button is present", () => {
      document.body.innerHTML = `
        <button aria-label="More options">More</button>
      `;

      const page = new SettingsMenuPage();

      expect(page.isPresent()).toBe(true);
    });

    it("returns false when no menu buttons present", () => {
      document.body.innerHTML = `<div>Content</div>`;

      const page = new SettingsMenuPage();

      expect(page.isPresent()).toBe(false);
    });
  });

  describe("isSettingsMenuOpen()", () => {
    it("returns true when settings button has aria-expanded=true", () => {
      document.body.innerHTML = `
        <button aria-label="Settings" aria-expanded="true">Settings</button>
        <div data-radix-menu-content></div>
      `;

      const page = new SettingsMenuPage();

      expect(page.isSettingsMenuOpen()).toBe(true);
    });

    it("returns false when settings button has aria-expanded=false", () => {
      document.body.innerHTML = `
        <button aria-label="Settings" aria-expanded="false">Settings</button>
      `;

      const page = new SettingsMenuPage();

      expect(page.isSettingsMenuOpen()).toBe(false);
    });

    it("returns false when settings button not present", () => {
      document.body.innerHTML = `<div>Content</div>`;

      const page = new SettingsMenuPage();

      expect(page.isSettingsMenuOpen()).toBe(false);
    });
  });

  describe("isMoreOptionsMenuOpen()", () => {
    it("returns true when more options button has aria-expanded=true", () => {
      document.body.innerHTML = `
        <button aria-label="More options" aria-expanded="true">More</button>
        <div data-radix-menu-content></div>
      `;

      const page = new SettingsMenuPage();

      expect(page.isMoreOptionsMenuOpen()).toBe(true);
    });

    it("returns false when more options button has aria-expanded=false", () => {
      document.body.innerHTML = `
        <button aria-label="More options" aria-expanded="false">More</button>
      `;

      const page = new SettingsMenuPage();

      expect(page.isMoreOptionsMenuOpen()).toBe(false);
    });
  });

  describe("openSettingsMenu()", () => {
    it("dispatches click events to settings button", () => {
      const pointerDownHandler = vi.fn();
      const pointerUpHandler = vi.fn();
      const clickHandler = vi.fn();

      document.body.innerHTML = `
        <button aria-label="Settings" aria-expanded="false">Settings</button>
      `;

      const btn = document.querySelector("button")!;
      btn.addEventListener("pointerdown", pointerDownHandler);
      btn.addEventListener("pointerup", pointerUpHandler);
      btn.addEventListener("click", clickHandler);

      const page = new SettingsMenuPage();
      const result = page.openSettingsMenu();

      expect(result).toBe(true);
      expect(pointerDownHandler).toHaveBeenCalled();
      expect(pointerUpHandler).toHaveBeenCalled();
      expect(clickHandler).toHaveBeenCalled();
    });

    it("returns true without clicking when menu already open", () => {
      const clickHandler = vi.fn();
      document.body.innerHTML = `
        <button aria-label="Settings" aria-expanded="true">Settings</button>
        <div data-radix-menu-content></div>
      `;

      document
        .querySelector("button")!
        .addEventListener("click", clickHandler);

      const page = new SettingsMenuPage();
      const result = page.openSettingsMenu();

      expect(result).toBe(true);
      expect(clickHandler).not.toHaveBeenCalled();
    });

    it("returns false when settings button not present", () => {
      document.body.innerHTML = `<div>Content</div>`;

      const page = new SettingsMenuPage();

      expect(page.openSettingsMenu()).toBe(false);
    });
  });

  describe("openMoreOptionsMenu()", () => {
    it("dispatches click events to more options button", () => {
      const clickHandler = vi.fn();
      document.body.innerHTML = `
        <button aria-label="More options" aria-expanded="false">More</button>
      `;

      document.querySelector("button")!.addEventListener("click", clickHandler);

      const page = new SettingsMenuPage();
      const result = page.openMoreOptionsMenu();

      expect(result).toBe(true);
      expect(clickHandler).toHaveBeenCalled();
    });

    it("returns true without clicking when menu already open", () => {
      const clickHandler = vi.fn();
      document.body.innerHTML = `
        <button aria-label="More options" aria-expanded="true">More</button>
        <div data-radix-menu-content></div>
      `;

      document.querySelector("button")!.addEventListener("click", clickHandler);

      const page = new SettingsMenuPage();
      const result = page.openMoreOptionsMenu();

      expect(result).toBe(true);
      expect(clickHandler).not.toHaveBeenCalled();
    });
  });

  describe("findMenuItem()", () => {
    it("finds menu item by exact text", () => {
      document.body.innerHTML = `
        <div data-radix-menu-content>
          <div role="menuitem" data-radix-collection-item>Spicy</div>
          <div role="menuitem" data-radix-collection-item>Fun</div>
          <div role="menuitem" data-radix-collection-item>Normal</div>
        </div>
      `;

      const page = new SettingsMenuPage();
      const item = page.findMenuItem("Fun");

      expect(item).not.toBeNull();
      expect(item?.textContent).toBe("Fun");
    });

    it("finds menu item by partial text", () => {
      document.body.innerHTML = `
        <div data-radix-menu-content>
          <div role="menuitem" data-radix-collection-item>Extend video</div>
          <div role="menuitem" data-radix-collection-item>Delete video</div>
        </div>
      `;

      const page = new SettingsMenuPage();
      const item = page.findMenuItem("Extend");

      expect(item).not.toBeNull();
      expect(item?.textContent).toBe("Extend video");
    });

    it("returns null when menu item not found", () => {
      document.body.innerHTML = `
        <div data-radix-menu-content>
          <div role="menuitem" data-radix-collection-item>Fun</div>
        </div>
      `;

      const page = new SettingsMenuPage();

      expect(page.findMenuItem("Nonexistent")).toBeNull();
    });

    it("returns null when no menu content present", () => {
      document.body.innerHTML = `<div>Content</div>`;

      const page = new SettingsMenuPage();

      expect(page.findMenuItem("Fun")).toBeNull();
    });
  });

  describe("clickMenuItem()", () => {
    it("clicks the menu item with specified text", () => {
      const clickHandler = vi.fn();
      document.body.innerHTML = `
        <div data-radix-menu-content>
          <div role="menuitem" data-radix-collection-item id="item">Fun</div>
        </div>
      `;

      document.getElementById("item")!.addEventListener("click", clickHandler);

      const page = new SettingsMenuPage();
      const result = page.clickMenuItem("Fun");

      expect(result).toBe(true);
      expect(clickHandler).toHaveBeenCalled();
    });

    it("returns false when menu item not found", () => {
      document.body.innerHTML = `
        <div data-radix-menu-content>
          <div role="menuitem" data-radix-collection-item>Other</div>
        </div>
      `;

      const page = new SettingsMenuPage();

      expect(page.clickMenuItem("Nonexistent")).toBe(false);
    });
  });

  describe("clickMoodOption()", () => {
    it("capitalizes first letter and clicks menu item", () => {
      const clickHandler = vi.fn();
      document.body.innerHTML = `
        <button aria-label="Settings" aria-expanded="true">Settings</button>
        <div data-radix-menu-content>
          <div role="menuitem" data-radix-collection-item id="spicy">Spicy</div>
        </div>
      `;

      document.getElementById("spicy")!.addEventListener("click", clickHandler);

      const page = new SettingsMenuPage();
      const result = page.clickMoodOption("spicy");

      expect(result).toBe(true);
      expect(clickHandler).toHaveBeenCalled();
    });

    it("handles already capitalized input", () => {
      const clickHandler = vi.fn();
      document.body.innerHTML = `
        <button aria-label="Settings" aria-expanded="true">Settings</button>
        <div data-radix-menu-content>
          <div role="menuitem" data-radix-collection-item id="fun">Fun</div>
        </div>
      `;

      document.getElementById("fun")!.addEventListener("click", clickHandler);

      const page = new SettingsMenuPage();
      const result = page.clickMoodOption("Fun");

      expect(result).toBe(true);
      expect(clickHandler).toHaveBeenCalled();
    });
  });

  describe("clickExtendVideo()", () => {
    it("clicks Extend video menu item", () => {
      const clickHandler = vi.fn();
      document.body.innerHTML = `
        <button aria-label="More options" aria-expanded="true">More</button>
        <div data-radix-menu-content>
          <div role="menuitem" data-radix-collection-item id="extend">Extend video</div>
        </div>
      `;

      document
        .getElementById("extend")!
        .addEventListener("click", clickHandler);

      const page = new SettingsMenuPage();
      const result = page.clickExtendVideo();

      expect(result).toBe(true);
      expect(clickHandler).toHaveBeenCalled();
    });

    it("returns false when Extend video item not found", () => {
      document.body.innerHTML = `
        <button aria-label="More options" aria-expanded="true">More</button>
        <div data-radix-menu-content>
          <div role="menuitem" data-radix-collection-item>Delete video</div>
        </div>
      `;

      const page = new SettingsMenuPage();

      expect(page.clickExtendVideo()).toBe(false);
    });
  });

  describe("document injection", () => {
    it("scopes all queries to injected document", () => {
      document.body.innerHTML = `<div>No menus here</div>`;

      const customDoc = document.implementation.createHTMLDocument("Custom");
      customDoc.body.innerHTML = `
        <button aria-label="Settings" aria-expanded="true">Settings</button>
        <div data-radix-menu-content>
          <div role="menuitem" data-radix-collection-item>Spicy</div>
        </div>
      `;

      const page = new SettingsMenuPage(customDoc);

      expect(page.isPresent()).toBe(true);
      expect(page.isSettingsMenuOpen()).toBe(true);
      expect(page.findMenuItem("Spicy")).not.toBeNull();
    });
  });
});
