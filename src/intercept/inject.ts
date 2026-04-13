/**
 * Injects the page script and modal CSS into the page.
 * The page script runs in the MAIN world to intercept fetch().
 */

import { modalCssSource } from "./modalCssSource";

let injected = false;

/** Injects the page script and CSS if not already injected. */
export function injectPageScript(): void {
  if (injected) {
    console.log("[ImaginePowerTools] Page script already injected, skipping");
    return;
  }

  console.log("[ImaginePowerTools] Injecting page script and CSS...");

  // Inject modal CSS
  const style = document.createElement("style");
  style.id = "ipt-modal-styles";
  style.textContent = modalCssSource;
  document.head.appendChild(style);

  // Inject page script into MAIN world using web_accessible_resources
  const script = document.createElement("script");
  script.id = "ipt-intercept-script";
  script.src = chrome.runtime.getURL("intercept/pageScript.js");
  script.onload = () => {
    console.log("[ImaginePowerTools] Page script injection complete");
  };
  script.onerror = (e) => {
    console.error("[ImaginePowerTools] Page script injection failed:", e);
  };
  document.documentElement.appendChild(script);

  injected = true;
}

/** Returns whether the page script has been injected. */
export function isInjected(): boolean {
  return injected;
}
