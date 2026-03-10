import { describe, it, expect, beforeEach } from "vitest";
import { PageObject } from "./PageObject";

// Concrete implementation for testing the abstract base class
class TestPageObject extends PageObject {
  isPresent(): boolean {
    return this.$single(".test-element") !== null;
  }

  // Expose protected methods for testing
  public testSelectFirst(selectors: readonly string[]) {
    return this.$(selectors);
  }

  public testSelectAllFirst(selectors: readonly string[]) {
    return this.$$(selectors);
  }

  public testSelectSingle(selector: string) {
    return this.$single(selector);
  }

  public testSelectAll(selector: string) {
    return this.$$all(selector);
  }

  public getDocument() {
    return this.doc;
  }
}

describe("PageObject", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  describe("constructor", () => {
    it("uses global document by default", () => {
      const page = new TestPageObject();

      expect(page.getDocument()).toBe(document);
    });

    it("accepts custom document for testability", () => {
      const customDoc = document.implementation.createHTMLDocument("Test");
      const page = new TestPageObject(customDoc);

      expect(page.getDocument()).toBe(customDoc);
    });
  });

  describe("$(selectors) - selectFirst with array", () => {
    it("returns first matching element from selector array", () => {
      document.body.innerHTML = `
        <button data-testid="primary">Primary</button>
        <button class="fallback">Fallback</button>
      `;

      const page = new TestPageObject();
      const result = page.testSelectFirst([
        '[data-testid="primary"]',
        ".fallback",
      ]);

      expect(result).not.toBeNull();
      expect(result?.textContent).toBe("Primary");
    });

    it("tries selectors in order", () => {
      document.body.innerHTML = `<button class="fallback">Fallback</button>`;

      const page = new TestPageObject();
      const result = page.testSelectFirst([
        '[data-testid="missing"]',
        ".fallback",
      ]);

      expect(result?.textContent).toBe("Fallback");
    });

    it("returns null when no selector matches", () => {
      document.body.innerHTML = `<div>Content</div>`;

      const page = new TestPageObject();
      const result = page.testSelectFirst([".missing"]);

      expect(result).toBeNull();
    });
  });

  describe("$$(selectors) - selectAllFirst with array", () => {
    it("returns first non-empty NodeList from selector array", () => {
      document.body.innerHTML = `
        <button class="btn">One</button>
        <button class="btn">Two</button>
      `;

      const page = new TestPageObject();
      const result = page.testSelectAllFirst([".btn"]);

      expect(result).not.toBeNull();
      expect(result?.length).toBe(2);
    });

    it("tries selectors in order until finding matches", () => {
      document.body.innerHTML = `<span class="exists">Span</span>`;

      const page = new TestPageObject();
      const result = page.testSelectAllFirst([".missing", ".exists"]);

      expect(result?.length).toBe(1);
    });

    it("returns null when no selector matches any elements", () => {
      document.body.innerHTML = `<div>Content</div>`;

      const page = new TestPageObject();
      const result = page.testSelectAllFirst([".missing"]);

      expect(result).toBeNull();
    });
  });

  describe("$single(selector) - single selector shorthand", () => {
    it("queries with a single selector string", () => {
      document.body.innerHTML = `<button id="btn">Button</button>`;

      const page = new TestPageObject();
      const result = page.testSelectSingle("#btn");

      expect(result).not.toBeNull();
      expect(result?.textContent).toBe("Button");
    });

    it("returns null when selector does not match", () => {
      document.body.innerHTML = `<div>Content</div>`;

      const page = new TestPageObject();
      const result = page.testSelectSingle("#missing");

      expect(result).toBeNull();
    });
  });

  describe("$$all(selector) - querySelectorAll shorthand", () => {
    it("returns all matching elements", () => {
      document.body.innerHTML = `
        <li class="item">A</li>
        <li class="item">B</li>
        <li class="item">C</li>
      `;

      const page = new TestPageObject();
      const result = page.testSelectAll(".item");

      expect(result.length).toBe(3);
    });

    it("returns empty NodeList when no matches", () => {
      document.body.innerHTML = `<div>Content</div>`;

      const page = new TestPageObject();
      const result = page.testSelectAll(".missing");

      expect(result.length).toBe(0);
    });
  });

  describe("isPresent()", () => {
    it("returns true when page elements are found", () => {
      document.body.innerHTML = `<div class="test-element">Present</div>`;

      const page = new TestPageObject();

      expect(page.isPresent()).toBe(true);
    });

    it("returns false when page elements are not found", () => {
      document.body.innerHTML = `<div>Other content</div>`;

      const page = new TestPageObject();

      expect(page.isPresent()).toBe(false);
    });
  });

  describe("custom document injection", () => {
    it("scopes all queries to the injected document", () => {
      // Set up global document with one element
      document.body.innerHTML = `<button class="global">Global</button>`;

      // Create custom document with different element
      const customDoc = document.implementation.createHTMLDocument("Custom");
      customDoc.body.innerHTML = `<button class="custom">Custom</button>`;

      const page = new TestPageObject(customDoc);

      // Should find element in custom doc, not global
      const result = page.testSelectSingle(".custom");
      expect(result).not.toBeNull();
      expect(result?.textContent).toBe("Custom");

      // Should NOT find element from global doc
      const globalResult = page.testSelectSingle(".global");
      expect(globalResult).toBeNull();
    });
  });
});
