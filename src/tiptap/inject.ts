/**
 * Injects the tiptap page script into the page.
 * The page script runs in the MAIN world to access tiptap's editor instance.
 */

let injected = false;

/** Injects the tiptap page script if not already injected. */
export function injectTiptapScript(): void {
  if (injected) {
    return;
  }

  // Inject page script into MAIN world using web_accessible_resources
  const script = document.createElement("script");
  script.id = "ipt-tiptap-script";
  script.src = chrome.runtime.getURL("tiptap/pageScript.js");
  script.onload = () => {
    console.log("[ImaginePowerTools] Tiptap page script injection complete");
  };
  script.onerror = (e) => {
    console.error(
      "[ImaginePowerTools] Tiptap page script injection failed:",
      e,
    );
  };
  document.documentElement.appendChild(script);

  injected = true;
}

/** Returns whether the tiptap page script has been injected. */
export function isTiptapInjected(): boolean {
  return injected;
}
