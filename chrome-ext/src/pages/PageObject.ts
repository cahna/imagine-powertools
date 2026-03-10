import { selectFirst, selectAllFirst } from "../selectors";

/**
 * Abstract base class for page objects.
 * Provides testability through document injection and common selector helpers.
 */
export abstract class PageObject {
  /** Creates a PageObject scoped to the provided document. */
  constructor(protected doc: Document = document) {}

  /**
   * Attempts each selector in order and returns the first matching element.
   * Use for selector arrays with fallback chains.
   */
  protected $<T extends Element = Element>(
    selectors: readonly string[],
  ): T | null {
    return selectFirst<T>(this.doc, selectors);
  }

  /**
   * Attempts each selector in order and returns the first non-empty NodeList.
   * Use for selector arrays with fallback chains.
   */
  protected $$<T extends Element = Element>(
    selectors: readonly string[],
  ): NodeListOf<T> | null {
    return selectAllFirst<T>(this.doc, selectors);
  }

  /**
   * Queries with a single selector string.
   * Use when no fallback chain is needed.
   */
  protected $single<T extends Element = Element>(selector: string): T | null {
    return this.doc.querySelector<T>(selector);
  }

  /**
   * Returns all elements matching a single selector.
   * Use when no fallback chain is needed.
   */
  protected $$all<T extends Element = Element>(
    selector: string,
  ): NodeListOf<T> {
    return this.doc.querySelectorAll<T>(selector);
  }

  /** Returns true if the page object's key elements are present in the DOM. */
  abstract isPresent(): boolean;
}
