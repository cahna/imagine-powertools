import { PageObject } from "./PageObject";
import { SELECTORS } from "../selectors";
import { TIMEOUTS } from "../config";

/**
 * PageObject for interacting with the video prompt input and submission.
 * Supports both tiptap/ProseMirror editor and legacy textarea.
 */
export class VideoPromptPage extends PageObject {
  /** Returns true if a video prompt input is present. */
  isPresent(): boolean {
    return this.getInput() !== null;
  }

  /** Returns the video prompt input element (tiptap editor or textarea). */
  getInput(): HTMLElement | null {
    return this.$(SELECTORS.videoInput);
  }

  /** Returns the Make video button. */
  getMakeVideoButton(): HTMLButtonElement | null {
    return this.$<HTMLButtonElement>(SELECTORS.makeVideoButton);
  }

  /** Fills the prompt input with the given text. */
  fillPrompt(text: string): boolean {
    const input = this.getInput();
    if (!input) return false;

    if (this.isTiptapEditor(input)) {
      this.setTiptapContent(input, text);
    } else {
      this.setReactInputValue(input as HTMLTextAreaElement, text);
    }

    return true;
  }

  /** Clicks the Make video button. */
  submit(): boolean {
    const button = this.getMakeVideoButton();
    if (!button) return false;

    button.click();
    return true;
  }

  /** Fills the prompt and submits the form. */
  fillAndSubmit(text: string): { success: boolean; error?: string } {
    const input = this.getInput();
    if (!input) {
      return { success: false, error: "Could not find video prompt input" };
    }

    const button = this.getMakeVideoButton();
    if (!button) {
      return { success: false, error: "Could not find Make video button" };
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

    return { success: true };
  }

  /** Returns true if the page is in extend video mode. */
  isInExtendMode(): boolean {
    return this.$(SELECTORS.extend.placeholder) !== null;
  }

  /** Focuses the video prompt input. */
  focus(): boolean {
    const input = this.getInput();
    if (!input) return false;

    input.focus();
    return true;
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
