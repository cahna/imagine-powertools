// Core functions extracted for testability
// These are imported by both content.ts and tests

export type Mode = "favorites" | "results" | "post" | "none";

// Detect the current mode based on URL and page content
export function detectMode(): Mode {
  const pathname = window.location.pathname;

  if (pathname === "/imagine/favorites") {
    return "favorites";
  }

  if (pathname.startsWith("/imagine/post/")) {
    return "post";
  }

  if (pathname === "/imagine") {
    // Check for back button (indicates we're viewing results)
    const backBtn = document.querySelector('button[aria-label="Back"]');
    if (backBtn) {
      return "results";
    }
  }

  return "none";
}

// Wait for an element to appear in the DOM
export function waitForElement(selector: string, timeout = 2000): Promise<Element | null> {
  return new Promise((resolve) => {
    // Check if element already exists
    const existing = document.querySelector(selector);
    if (existing) {
      resolve(existing);
      return;
    }

    const timeoutId = setTimeout(() => {
      observer.disconnect();
      resolve(null);
    }, timeout);

    const observer = new MutationObserver(() => {
      const element = document.querySelector(selector);
      if (element) {
        clearTimeout(timeoutId);
        observer.disconnect();
        resolve(element);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  });
}

// Find a menu item by its text content
export function findMenuItemByText(text: string): Element | null {
  const menuItems = document.querySelectorAll('div[role="menuitem"][data-radix-collection-item]');
  for (const item of menuItems) {
    if (item.textContent?.includes(text)) {
      return item;
    }
  }
  return null;
}

// Set value on a React-controlled input/textarea
export function setReactInputValue(element: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  // Get the native setter from the prototype
  const prototype = element instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype
    : HTMLInputElement.prototype;

  const nativeSetter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;

  if (nativeSetter) {
    nativeSetter.call(element, value);
  } else {
    // Fallback
    element.value = value;
  }

  // Dispatch input event so React picks up the change
  element.dispatchEvent(new Event("input", { bubbles: true }));
}

// Set content in a tiptap/ProseMirror contenteditable element
export function setTiptapContent(element: HTMLElement, text: string): void {
  // Focus the element
  element.focus();

  // Select all existing content
  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(element);
  selection?.removeAllRanges();
  selection?.addRange(range);

  // Insert new text (this replaces the selection and triggers tiptap's internal events)
  document.execCommand("insertText", false, text);
}

// Fill the video prompt and click the Make video button
// Supports both old UI (textarea) and new UI (tiptap contenteditable)
export function fillAndSubmitVideo(text: string): { success: boolean; error?: string } {
  // Try new UI first: contenteditable div with tiptap ProseMirror
  const contentEditable = document.querySelector<HTMLDivElement>(
    'div.tiptap.ProseMirror[contenteditable="true"]'
  );

  if (contentEditable) {
    setTiptapContent(contentEditable, text);
  } else {
    // Fallback to old UI: textarea
    const textarea = document.querySelector<HTMLTextAreaElement>(
      'textarea[aria-label="Make a video"]'
    );

    if (!textarea) {
      return { success: false, error: "Could not find video prompt input" };
    }

    setReactInputValue(textarea, text);
  }

  // Find and click the Make video button (same aria-label in both UIs)
  const makeVideoBtn = document.querySelector<HTMLButtonElement>(
    'button[aria-label="Make video"]'
  );

  if (!makeVideoBtn) {
    return { success: false, error: "Could not find Make video button" };
  }

  // Small delay to ensure React has processed the input
  setTimeout(() => {
    makeVideoBtn.click();
  }, 50);

  return { success: true };
}

// Click a mood option from the Settings dropdown menu
export async function clickMoodOptionFromMenu(option: string): Promise<{ success: boolean; error?: string }> {
  const settingsBtn = document.querySelector<HTMLButtonElement>('button[aria-label="Settings"]');

  if (!settingsBtn) {
    return { success: false, error: "Settings button not found" };
  }

  // Check if menu is already open
  const isOpen = settingsBtn.getAttribute("aria-expanded") === "true";

  if (!isOpen) {
    settingsBtn.focus();

    // Dispatch pointer events (Radix UI uses these)
    settingsBtn.dispatchEvent(new PointerEvent("pointerdown", {
      bubbles: true,
      cancelable: true,
      view: window,
      pointerType: "mouse",
    }));
    settingsBtn.dispatchEvent(new PointerEvent("pointerup", {
      bubbles: true,
      cancelable: true,
      view: window,
      pointerType: "mouse",
    }));
    settingsBtn.dispatchEvent(new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      view: window,
    }));

    // Wait for menu to appear
    const menuContent = await waitForElement('[data-radix-menu-content]', 1000);
    if (!menuContent) {
      return { success: false, error: "Settings menu did not open" };
    }

    // Small delay for menu animation
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  // Capitalize first letter for matching (e.g., "spicy" -> "Spicy")
  const moodText = option.charAt(0).toUpperCase() + option.slice(1);
  const targetElement = findMenuItemByText(moodText);

  if (!targetElement) {
    return { success: false, error: `Mood option "${option}" not found in menu` };
  }

  (targetElement as HTMLElement).click();
  return { success: true };
}

// Click a video option (duration, resolution, or mood)
// Handles collapsed form state by expanding it first for duration/resolution
export async function clickVideoOption(option: string): Promise<{ success: boolean; error?: string }> {
  // Duration and resolution options use radiogroups
  if (["6s", "10s", "480p", "720p"].includes(option)) {
    const isResolution = ["480p", "720p"].includes(option);
    const radioGroupLabel = isResolution ? "Video resolution" : "Video duration";

    // Check if radiogroup is already visible
    let radioGroup = document.querySelector(`[role="radiogroup"][aria-label="${radioGroupLabel}"]`);

    // If not visible, form is collapsed - click the text input to expand it
    if (!radioGroup) {
      const tiptapEditor = document.querySelector<HTMLElement>(
        'div.tiptap.ProseMirror[contenteditable="true"]'
      );

      if (!tiptapEditor) {
        return { success: false, error: "Could not find text input to expand form" };
      }

      // Focus the editor to trigger form expansion
      tiptapEditor.focus();

      // Wait for radiogroup to appear (form expansion animation)
      const appeared = await waitForElement(`[role="radiogroup"][aria-label="${radioGroupLabel}"]`, 1000);
      if (!appeared) {
        return { success: false, error: "Form did not expand - radiogroup not found" };
      }

      radioGroup = appeared;
    }

    // Find the radio button by checking for the option text in nested spans
    const buttons = radioGroup.querySelectorAll<HTMLButtonElement>('button[role="radio"]');
    for (const btn of buttons) {
      const spans = btn.querySelectorAll("span");
      for (const span of spans) {
        if (span.textContent?.trim() === option) {
          btn.click();
          return { success: true };
        }
      }
    }

    return { success: false, error: `Option "${option}" not found in radiogroup` };
  }

  // Mood options require opening the Settings menu
  if (["spicy", "fun", "normal"].includes(option)) {
    return await clickMoodOptionFromMenu(option);
  }

  return { success: false, error: `Unknown option: ${option}` };
}
