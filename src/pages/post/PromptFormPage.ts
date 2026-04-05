import { PageObject } from "../PageObject";
import { SELECTORS } from "../../selectors";
import { TIMEOUTS } from "../../config";
import { PromptSettingsMenu } from "../menus";
import { Result, ok, err } from "../../shared/result";
import type { DomError } from "../../shared/errors";

/**
 * PageObject for interacting with the prompt input form and submission.
 * Supports both tiptap/ProseMirror editor and legacy textarea.
 */
export class PromptFormPage extends PageObject {
  readonly settingsMenu: PromptSettingsMenu;

  constructor(doc: Document = document) {
    super(doc);
    this.settingsMenu = new PromptSettingsMenu(doc);
  }

  /** Returns true if a prompt input is present. */
  isPresent(): boolean {
    return this.getInput() !== null;
  }

  /** Returns the prompt input element (tiptap editor or textarea). */
  getInput(): HTMLElement | null {
    return this.$(SELECTORS.videoInput);
  }

  /** Returns the Make video button. */
  getMakeVideoButton(): HTMLButtonElement | null {
    return this.$<HTMLButtonElement>(SELECTORS.makeVideoButton);
  }

  /** Fills the prompt input with the given text. */
  fillPrompt(text: string): Result<void, DomError> {
    const input = this.getInput();
    if (!input) {
      return err({ type: "element_not_found", element: "prompt input" });
    }

    if (this.isTiptapEditor(input)) {
      this.setTiptapContent(input, text);
    } else {
      this.setReactInputValue(input as HTMLTextAreaElement, text);
    }

    return ok(undefined);
  }

  /** Clicks the Make video button. */
  submit(): Result<void, DomError> {
    const button = this.getMakeVideoButton();
    if (!button) {
      return err({ type: "element_not_found", element: "Make video button" });
    }

    button.click();
    return ok(undefined);
  }

  /** Fills the prompt and submits the form. */
  fillAndSubmit(text: string): Result<void, DomError> {
    const input = this.getInput();
    if (!input) {
      return err({ type: "element_not_found", element: "prompt input" });
    }

    const button = this.getMakeVideoButton();
    if (!button) {
      return err({ type: "element_not_found", element: "Make video button" });
    }

    // Fill the prompt
    if (this.isTiptapEditor(input)) {
      this.setTiptapContent(input, text);
    } else {
      this.setReactInputValue(input as HTMLTextAreaElement, text);
    }

    // Click button after small delay for React to process
    setTimeout(() => {
      button.click();
    }, TIMEOUTS.inputToButtonDelay);

    return ok(undefined);
  }

  /** Returns true if the page is in extend video mode. */
  isInExtendMode(): boolean {
    return this.$(SELECTORS.extend.placeholder) !== null;
  }

  /** Focuses the prompt input. */
  focus(): Result<void, DomError> {
    const input = this.getInput();
    if (!input) {
      return err({ type: "element_not_found", element: "prompt input" });
    }

    input.focus();
    return ok(undefined);
  }

  /** Returns true if the element is a tiptap/ProseMirror editor. */
  private isTiptapEditor(element: HTMLElement): boolean {
    return (
      element.classList.contains("tiptap") ||
      element.classList.contains("ProseMirror")
    );
  }

  /** Sets content in a tiptap/ProseMirror contenteditable element. */
  private setTiptapContent(element: HTMLElement, text: string): void {
    element.focus();

    // Select all existing content
    const selection = window.getSelection();
    const range = this.doc.createRange();
    range.selectNodeContents(element);
    selection?.removeAllRanges();
    selection?.addRange(range);

    // Insert new text (replaces selection and triggers tiptap's internal events)
    this.doc.execCommand("insertText", false, text);
  }

  /** Sets value on a React-controlled input/textarea. */
  private setReactInputValue(
    element: HTMLInputElement | HTMLTextAreaElement,
    value: string,
  ): void {
    // Get the native setter from the prototype
    const prototype =
      element instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;

    const nativeSetter = Object.getOwnPropertyDescriptor(
      prototype,
      "value",
    )?.set;

    if (nativeSetter) {
      nativeSetter.call(element, value);
    } else {
      element.value = value;
    }

    // Dispatch input event so React picks up the change
    element.dispatchEvent(new Event("input", { bubbles: true }));
  }
}
