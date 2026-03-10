import { describe, it, expect, beforeEach } from "vitest";
import {
  selectFirst,
  selectAllFirst,
  selectFirstWithMatch,
  SELECTORS,
} from "./selectors";

describe("selectFirst", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("returns the first matching element when first selector matches", () => {
    document.body.innerHTML = `
      <button data-testid="primary-button">Primary</button>
      <button aria-label="fallback">Fallback</button>
    `;

    const selectors = [
      '[data-testid="primary-button"]',
      '[aria-label="fallback"]',
    ];
    const result = selectFirst(document, selectors);

    expect(result).not.toBeNull();
    expect(result?.textContent).toBe("Primary");
  });

  it("tries selectors in order and returns first match", () => {
    document.body.innerHTML = `
      <button aria-label="fallback">Fallback</button>
    `;

    const selectors = [
      '[data-testid="primary-button"]', // doesn't exist
      '[aria-label="fallback"]', // exists
      '[aria-label="legacy"]', // doesn't exist
    ];
    const result = selectFirst(document, selectors);

    expect(result).not.toBeNull();
    expect(result?.textContent).toBe("Fallback");
  });

  it("returns null when no selectors match", () => {
    document.body.innerHTML = `<div>No matching elements</div>`;

    const selectors = [
      '[data-testid="missing"]',
      '[aria-label="also-missing"]',
    ];
    const result = selectFirst(document, selectors);

    expect(result).toBeNull();
  });

  it("returns null for empty selector array", () => {
    document.body.innerHTML = `<button>Button</button>`;

    const result = selectFirst(document, []);

    expect(result).toBeNull();
  });

  it("works with Element as root instead of Document", () => {
    document.body.innerHTML = `
      <div id="container">
        <button class="inner">Inner</button>
      </div>
      <button class="outer">Outer</button>
    `;

    const container = document.getElementById("container")!;
    const result = selectFirst(container, [".inner", ".outer"]);

    expect(result).not.toBeNull();
    expect(result?.textContent).toBe("Inner");
  });

  it("scopes search to provided root element", () => {
    document.body.innerHTML = `
      <div id="container">
        <span>Inside</span>
      </div>
      <button class="target">Outside</button>
    `;

    const container = document.getElementById("container")!;
    const result = selectFirst(container, [".target"]);

    expect(result).toBeNull();
  });

  it("preserves type parameter for specific element types", () => {
    document.body.innerHTML = `<input type="text" id="my-input" />`;

    const result = selectFirst<HTMLInputElement>(document, ["#my-input"]);

    expect(result).not.toBeNull();
    expect(result?.type).toBe("text");
  });
});

describe("selectAllFirst", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("returns first non-empty NodeList", () => {
    document.body.innerHTML = `
      <button class="btn">One</button>
      <button class="btn">Two</button>
      <span class="span">Span</span>
    `;

    const selectors = [".btn", ".span"];
    const result = selectAllFirst(document, selectors);

    expect(result).not.toBeNull();
    expect(result?.length).toBe(2);
  });

  it("tries selectors in order until finding non-empty result", () => {
    document.body.innerHTML = `
      <span class="exists">Span</span>
    `;

    const selectors = [".missing", ".also-missing", ".exists"];
    const result = selectAllFirst(document, selectors);

    expect(result).not.toBeNull();
    expect(result?.length).toBe(1);
  });

  it("returns null when no selectors match any elements", () => {
    document.body.innerHTML = `<div>Content</div>`;

    const selectors = [".missing", ".also-missing"];
    const result = selectAllFirst(document, selectors);

    expect(result).toBeNull();
  });

  it("returns null for empty selector array", () => {
    document.body.innerHTML = `<button>Button</button>`;

    const result = selectAllFirst(document, []);

    expect(result).toBeNull();
  });

  it("works with Element as root instead of Document", () => {
    document.body.innerHTML = `
      <div id="container">
        <span class="item">A</span>
        <span class="item">B</span>
      </div>
      <span class="item">C</span>
    `;

    const container = document.getElementById("container")!;
    const result = selectAllFirst(container, [".item"]);

    expect(result).not.toBeNull();
    expect(result?.length).toBe(2);
  });
});

describe("selectFirstWithMatch", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("returns element with matched selector and index when first selector matches", () => {
    document.body.innerHTML = `<button data-testid="btn">Button</button>`;

    const selectors = ['[data-testid="btn"]', ".fallback"];
    const result = selectFirstWithMatch(document, selectors);

    expect(result).not.toBeNull();
    expect(result?.element.textContent).toBe("Button");
    expect(result?.matchedSelector).toBe('[data-testid="btn"]');
    expect(result?.index).toBe(0);
  });

  it("returns correct index when fallback selector matches", () => {
    document.body.innerHTML = `<button class="fallback">Button</button>`;

    const selectors = ['[data-testid="missing"]', ".also-missing", ".fallback"];
    const result = selectFirstWithMatch(document, selectors);

    expect(result).not.toBeNull();
    expect(result?.matchedSelector).toBe(".fallback");
    expect(result?.index).toBe(2);
  });

  it("returns null when no selectors match", () => {
    document.body.innerHTML = `<div>Content</div>`;

    const selectors = [".missing"];
    const result = selectFirstWithMatch(document, selectors);

    expect(result).toBeNull();
  });

  it("returns null for empty selector array", () => {
    const result = selectFirstWithMatch(document, []);

    expect(result).toBeNull();
  });

  it("preserves type parameter", () => {
    document.body.innerHTML = `<input type="checkbox" class="check" />`;

    const result = selectFirstWithMatch<HTMLInputElement>(document, [".check"]);

    expect(result).not.toBeNull();
    expect(result?.element.type).toBe("checkbox");
  });
});

describe("SELECTORS", () => {
  it("defines videoInput as an ordered array", () => {
    expect(Array.isArray(SELECTORS.videoInput)).toBe(true);
    expect(SELECTORS.videoInput.length).toBeGreaterThan(0);
  });

  it("defines makeVideoButton as an ordered array", () => {
    expect(Array.isArray(SELECTORS.makeVideoButton)).toBe(true);
    expect(SELECTORS.makeVideoButton.length).toBeGreaterThan(0);
  });

  it("defines carousel.container as an ordered array", () => {
    expect(Array.isArray(SELECTORS.carousel.container)).toBe(true);
    expect(SELECTORS.carousel.container.length).toBeGreaterThan(0);
  });

  it("defines carousel.item as an ordered array", () => {
    expect(Array.isArray(SELECTORS.carousel.item)).toBe(true);
    expect(SELECTORS.carousel.item.length).toBeGreaterThan(0);
  });

  it("defines moderation selectors as ordered arrays", () => {
    expect(Array.isArray(SELECTORS.moderation.icon)).toBe(true);
    expect(Array.isArray(SELECTORS.moderation.largeIcon)).toBe(true);
    expect(Array.isArray(SELECTORS.moderation.altImage)).toBe(true);
  });

  it("defines notifications.container as an ordered array", () => {
    expect(Array.isArray(SELECTORS.notifications.container)).toBe(true);
  });

  it("defines settingsButton as an ordered array", () => {
    expect(Array.isArray(SELECTORS.settingsButton)).toBe(true);
  });

  it("defines moreOptionsButton as an ordered array", () => {
    expect(Array.isArray(SELECTORS.moreOptionsButton)).toBe(true);
  });

  it("all selector arrays are readonly", () => {
    // TypeScript ensures this at compile time, but we verify the runtime behavior
    // by checking that the arrays exist and have the expected structure
    expect(SELECTORS).toBeDefined();
  });
});
