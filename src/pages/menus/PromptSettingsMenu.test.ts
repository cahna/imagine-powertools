import { describe, it, expect, beforeEach, vi } from "vitest";
import { PromptSettingsMenu } from "./PromptSettingsMenu";

describe("PromptSettingsMenu", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  describe("isPresent()", () => {
    it("returns true when settings button exists with data-testid", () => {
      document.body.innerHTML = `
        <button data-testid="settings-button">Settings</button>
      `;

      const menu = new PromptSettingsMenu();
      expect(menu.isPresent()).toBe(true);
    });

    it("returns true when settings button exists with aria-label", () => {
      document.body.innerHTML = `
        <button aria-label="Settings">...</button>
      `;

      const menu = new PromptSettingsMenu();
      expect(menu.isPresent()).toBe(true);
    });

    it("returns false when no settings button exists", () => {
      document.body.innerHTML = `<div>No button here</div>`;

      const menu = new PromptSettingsMenu();
      expect(menu.isPresent()).toBe(false);
    });
  });

  describe("isOpen()", () => {
    it("returns true when button has aria-expanded=true", () => {
      document.body.innerHTML = `
        <button aria-label="Settings" aria-expanded="true">...</button>
      `;

      const menu = new PromptSettingsMenu();
      expect(menu.isOpen()).toBe(true);
    });

    it("returns false when button has aria-expanded=false", () => {
      document.body.innerHTML = `
        <button aria-label="Settings" aria-expanded="false">...</button>
      `;

      const menu = new PromptSettingsMenu();
      expect(menu.isOpen()).toBe(false);
    });

    it("returns false when no button exists", () => {
      document.body.innerHTML = `<div>No button</div>`;

      const menu = new PromptSettingsMenu();
      expect(menu.isOpen()).toBe(false);
    });
  });

  describe("open()", () => {
    it("returns ok when button exists and is closed", () => {
      document.body.innerHTML = `
        <button aria-label="Settings" aria-expanded="false">...</button>
      `;

      const menu = new PromptSettingsMenu();
      const result = menu.open();

      expect(result.isOk()).toBe(true);
    });

    it("returns ok immediately when already open", () => {
      document.body.innerHTML = `
        <button aria-label="Settings" aria-expanded="true">...</button>
      `;

      const menu = new PromptSettingsMenu();
      const result = menu.open();

      expect(result.isOk()).toBe(true);
    });

    it("returns error when button not found", () => {
      document.body.innerHTML = `<div>No button</div>`;

      const menu = new PromptSettingsMenu();
      const result = menu.open();

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("element_not_found");
      }
    });

    it("dispatches click events when opening", () => {
      document.body.innerHTML = `
        <button aria-label="Settings" aria-expanded="false">...</button>
      `;
      const button = document.querySelector("button")!;
      const clickSpy = vi.fn();
      button.addEventListener("click", clickSpy);

      const menu = new PromptSettingsMenu();
      menu.open();

      expect(clickSpy).toHaveBeenCalled();
    });
  });

  describe("clickMoodOption()", () => {
    it("clicks Spicy mood option", () => {
      document.body.innerHTML = `
        <div data-radix-menu-content>
          <div role="menuitem" data-radix-collection-item>Spicy</div>
          <div role="menuitem" data-radix-collection-item>Fun</div>
          <div role="menuitem" data-radix-collection-item>Normal</div>
        </div>
      `;

      const spicyItem = document.querySelectorAll('[role="menuitem"]')[0];
      const clickSpy = vi.fn();
      spicyItem.addEventListener("click", clickSpy);

      const menu = new PromptSettingsMenu();
      const result = menu.clickMoodOption("spicy");

      expect(result.isOk()).toBe(true);
      expect(clickSpy).toHaveBeenCalled();
    });

    it("clicks Fun mood option", () => {
      document.body.innerHTML = `
        <div data-radix-menu-content>
          <div role="menuitem" data-radix-collection-item>Fun</div>
        </div>
      `;

      const funItem = document.querySelector('[role="menuitem"]')!;
      const clickSpy = vi.fn();
      funItem.addEventListener("click", clickSpy);

      const menu = new PromptSettingsMenu();
      const result = menu.clickMoodOption("fun");

      expect(result.isOk()).toBe(true);
      expect(clickSpy).toHaveBeenCalled();
    });

    it("clicks Normal mood option", () => {
      document.body.innerHTML = `
        <div data-radix-menu-content>
          <div role="menuitem" data-radix-collection-item>Normal</div>
        </div>
      `;

      const normalItem = document.querySelector('[role="menuitem"]')!;
      const clickSpy = vi.fn();
      normalItem.addEventListener("click", clickSpy);

      const menu = new PromptSettingsMenu();
      const result = menu.clickMoodOption("normal");

      expect(result.isOk()).toBe(true);
      expect(clickSpy).toHaveBeenCalled();
    });

    it("capitalizes mood option for matching", () => {
      document.body.innerHTML = `
        <div data-radix-menu-content>
          <div role="menuitem" data-radix-collection-item>Spicy preset</div>
        </div>
      `;

      const menu = new PromptSettingsMenu();
      const result = menu.clickMoodOption("spicy");

      expect(result.isOk()).toBe(true);
    });
  });

  describe("clickEditImage()", () => {
    it("clicks Edit image menu item", () => {
      document.body.innerHTML = `
        <div data-radix-menu-content>
          <div role="menuitem" data-radix-collection-item>Edit image</div>
        </div>
      `;

      const menuItem = document.querySelector('[role="menuitem"]')!;
      const clickSpy = vi.fn();
      menuItem.addEventListener("click", clickSpy);

      const menu = new PromptSettingsMenu();
      const result = menu.clickEditImage();

      expect(result.isOk()).toBe(true);
      expect(clickSpy).toHaveBeenCalled();
    });
  });

  describe("clickMakeVideo()", () => {
    it("clicks Make video menu item", () => {
      document.body.innerHTML = `
        <div data-radix-menu-content>
          <div role="menuitem" data-radix-collection-item>Make video</div>
        </div>
      `;

      const menuItem = document.querySelector('[role="menuitem"]')!;
      const clickSpy = vi.fn();
      menuItem.addEventListener("click", clickSpy);

      const menu = new PromptSettingsMenu();
      const result = menu.clickMakeVideo();

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

      const menu = new PromptSettingsMenu();
      const result = menu.clickExtendVideo();

      expect(result.isOk()).toBe(true);
      expect(clickSpy).toHaveBeenCalled();
    });
  });

  describe("clickRedo()", () => {
    it("clicks Redo menu item", () => {
      document.body.innerHTML = `
        <div data-radix-menu-content>
          <div role="menuitem" data-radix-collection-item>Redo</div>
        </div>
      `;

      const menuItem = document.querySelector('[role="menuitem"]')!;
      const clickSpy = vi.fn();
      menuItem.addEventListener("click", clickSpy);

      const menu = new PromptSettingsMenu();
      const result = menu.clickRedo();

      expect(result.isOk()).toBe(true);
      expect(clickSpy).toHaveBeenCalled();
    });
  });

  describe("clickMenuItem()", () => {
    it("clicks menu item with matching text", () => {
      document.body.innerHTML = `
        <div data-radix-menu-content>
          <div role="menuitem" data-radix-collection-item>Option A</div>
          <div role="menuitem" data-radix-collection-item>Option B</div>
        </div>
      `;

      const optionB = document.querySelectorAll('[role="menuitem"]')[1];
      const clickSpy = vi.fn();
      optionB.addEventListener("click", clickSpy);

      const menu = new PromptSettingsMenu();
      const result = menu.clickMenuItem("Option B");

      expect(result.isOk()).toBe(true);
      expect(clickSpy).toHaveBeenCalled();
    });

    it("returns error when menu item not found", () => {
      document.body.innerHTML = `
        <div data-radix-menu-content>
          <div role="menuitem" data-radix-collection-item>Option A</div>
        </div>
      `;

      const menu = new PromptSettingsMenu();
      const result = menu.clickMenuItem("Nonexistent");

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("element_not_found");
      }
    });
  });

  describe("findMenuItem()", () => {
    it("finds menu item by text", () => {
      document.body.innerHTML = `
        <div data-radix-menu-content>
          <div role="menuitem" data-radix-collection-item>Spicy</div>
          <div role="menuitem" data-radix-collection-item>Fun</div>
        </div>
      `;

      const menu = new PromptSettingsMenu();
      const item = menu.findMenuItem("Fun");

      expect(item).not.toBeNull();
      expect(item?.textContent).toContain("Fun");
    });

    it("returns null when item not found", () => {
      document.body.innerHTML = `
        <div data-radix-menu-content>
          <div role="menuitem" data-radix-collection-item>Spicy</div>
        </div>
      `;

      const menu = new PromptSettingsMenu();
      const item = menu.findMenuItem("Normal");

      expect(item).toBeNull();
    });
  });

  describe("document injection", () => {
    it("scopes queries to injected document", () => {
      document.body.innerHTML = `<div>No menu in global doc</div>`;

      const customDoc = document.implementation.createHTMLDocument("Custom");
      customDoc.body.innerHTML = `
        <button aria-label="Settings" aria-expanded="true">...</button>
        <div data-radix-menu-content>
          <div role="menuitem" data-radix-collection-item>Spicy</div>
        </div>
      `;

      const menu = new PromptSettingsMenu(customDoc);

      expect(menu.isPresent()).toBe(true);
      expect(menu.isOpen()).toBe(true);
      expect(menu.findMenuItem("Spicy")).not.toBeNull();
    });
  });
});
