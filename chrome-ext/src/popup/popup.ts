// Popup script for Grok Imagine Power Tools

import {
  HistoryEntry,
  getPostHistory,
  saveToPostHistory,
  deleteFromPostHistory,
} from "../shared/storage";
import { logger } from "../shared/logger";

type Mode = "favorites" | "results" | "post" | "none";

type AutosubmitState =
  | { status: "idle" }
  | {
      status: "running";
      attempt: number;
      maxRetries: number;
      phase: "submitting" | "generating" | "waiting";
    }
  | { status: "success"; attempt: number }
  | {
      status: "stopped";
      reason:
        | "cancelled"
        | "rate_limited"
        | "max_retries"
        | "timeout"
        | "navigated";
      attempt: number;
    };

const PHASE_LABELS: Record<string, string> = {
  submitting: "Submitting...",
  generating: "Generating...",
  waiting: "Waiting for result...",
};

const STOP_REASON_LABELS: Record<string, string> = {
  cancelled: "Cancelled",
  rate_limited: "Rate limited",
  max_retries: "Max retries reached",
  timeout: "Timeout",
  navigated: "Page navigated away",
};

const MODE_LABELS: Record<Mode, string> = {
  favorites: "Favorites",
  results: "Results",
  post: "Post",
  none: "None",
};

// SVG icons
const REFRESH_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>`;

const DELETE_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`;

interface RenderHistoryOptions {
  onRestore: (entry: HistoryEntry) => void;
  onDelete: (entry: HistoryEntry) => void;
}

function renderHistory(
  entries: HistoryEntry[],
  listEl: HTMLElement,
  options: RenderHistoryOptions
): void {
  listEl.innerHTML = "";

  if (entries.length === 0) {
    const emptyLi = document.createElement("li");
    emptyLi.className = "history-empty";
    emptyLi.textContent = "No entries yet";
    listEl.appendChild(emptyLi);
    return;
  }

  const sorted = [...entries].sort((a, b) => b.timestamp - a.timestamp);

  for (const entry of sorted) {
    const li = document.createElement("li");
    li.className = "history-item";

    const contentDiv = document.createElement("div");
    contentDiv.className = "history-content";

    const textSpan = document.createElement("span");
    textSpan.className = "history-text";
    textSpan.textContent = entry.text;

    const timeSpan = document.createElement("span");
    timeSpan.className = "history-time";
    const count = entry.submitCount || 1;
    timeSpan.textContent = `×${count} · ${new Date(entry.timestamp).toLocaleString()}`;

    contentDiv.appendChild(textSpan);
    contentDiv.appendChild(timeSpan);

    const actionsDiv = document.createElement("div");
    actionsDiv.className = "history-actions";

    const restoreBtn = document.createElement("button");
    restoreBtn.className = "history-btn restore-btn";
    restoreBtn.title = "Restore to input";
    restoreBtn.innerHTML = REFRESH_ICON;
    restoreBtn.addEventListener("click", () => options.onRestore(entry));

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "history-btn delete-btn";
    deleteBtn.title = "Delete";
    deleteBtn.innerHTML = DELETE_ICON;
    deleteBtn.addEventListener("click", () => options.onDelete(entry));

    actionsDiv.appendChild(restoreBtn);
    actionsDiv.appendChild(deleteBtn);

    li.appendChild(contentDiv);
    li.appendChild(actionsDiv);
    listEl.appendChild(li);
  }
}

// Generate the console script for setting up keyboard shortcuts
function generateShortcutsScript(): string {
  return `(async () => {
  const HOTKEYS = {
    'resubmit-last': 'R',
    'submit-clipboard': 'P',
    'tab-left': 'H',
    'tab-right': 'L',
    'video-6s': '6',
    'video-10s': '0',
    'video-480p': ',',
    'video-720p': '.',
    'video-spicy': 'X',
    'video-fun': 'F',
    'video-normal': 'N',
    'download-video': 'D'
  };

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  function deepQuerySelectorAll(root, selector) {
    const results = [...root.querySelectorAll(selector)];
    const allElements = root.querySelectorAll('*');
    for (const el of allElements) {
      if (el.shadowRoot) {
        results.push(...deepQuerySelectorAll(el.shadowRoot, selector));
      }
    }
    return results;
  }

  console.log('Searching for shortcut cards in shadow DOM...');
  const cards = deepQuerySelectorAll(document, '.shortcut-card');
  console.log('Found', cards.length, 'extension cards');

  let ourCard = null;
  for (const card of cards) {
    const title = card.querySelector('.card-title span');
    console.log('Card title:', title?.textContent?.trim());
    if (title && title.textContent.includes('Grok Imagine Power Tools')) {
      ourCard = card;
      break;
    }
  }

  if (!ourCard) {
    console.error('Could not find Grok Imagine Power Tools extension card');
    return;
  }

  console.log('Found extension card, setting shortcuts...');

  const entries = ourCard.querySelectorAll('.command-entry');
  console.log('Found', entries.length, 'command entries');
  let setCount = 0;

  for (const entry of entries) {
    const select = entry.querySelector('select');
    const commandName = select?.dataset.commandName;
    const key = HOTKEYS[commandName];

    if (!key) {
      console.log('Skipping command:', commandName, '(no hotkey defined)');
      continue;
    }

    const input = entry.querySelector('extensions-shortcut-input');
    if (!input) {
      console.log('No input element for', commandName);
      continue;
    }

    const shadowRoot = input.shadowRoot;
    if (!shadowRoot) {
      console.log('No shadowRoot for', commandName);
      continue;
    }

    let editBtn = shadowRoot.querySelector('cr-icon-button');
    if (!editBtn) editBtn = shadowRoot.querySelector('#edit');
    if (!editBtn) editBtn = shadowRoot.querySelector('button');

    if (editBtn) {
      editBtn.click();
      await sleep(200);

      const keyCodeMap = {
        ',': { code: 'Comma', keyCode: 188 },
        '.': { code: 'Period', keyCode: 190 },
        '/': { code: 'Slash', keyCode: 191 },
        ';': { code: 'Semicolon', keyCode: 186 },
        "'": { code: 'Quote', keyCode: 222 },
        '[': { code: 'BracketLeft', keyCode: 219 },
        ']': { code: 'BracketRight', keyCode: 221 },
        '-': { code: 'Minus', keyCode: 189 },
        '=': { code: 'Equal', keyCode: 187 },
      };

      let code, keyCode;
      if (keyCodeMap[key]) {
        code = keyCodeMap[key].code;
        keyCode = keyCodeMap[key].keyCode;
      } else if (key.match(/[A-Z]/i)) {
        code = 'Key' + key.toUpperCase();
        keyCode = key.toUpperCase().charCodeAt(0);
      } else if (key.match(/[0-9]/)) {
        code = 'Digit' + key;
        keyCode = key.charCodeAt(0);
      } else {
        code = 'Key' + key;
        keyCode = key.charCodeAt(0);
      }

      const captureInput = shadowRoot.querySelector('input') || shadowRoot.querySelector('#input');
      const target = captureInput || document.activeElement || input;

      const keyEvent = new KeyboardEvent('keydown', {
        key: key,
        code: code,
        keyCode: keyCode,
        which: keyCode,
        altKey: true,
        shiftKey: true,
        bubbles: true,
        cancelable: true,
        composed: true
      });
      target.dispatchEvent(keyEvent);
      await sleep(200);

      setCount++;
      console.log('Set', commandName, 'to Alt+Shift+' + key);
    } else {
      console.log('No edit button found for', commandName);
    }
  }

  console.log('Done! Set', setCount, 'shortcuts.');
})();`;
}

function setupShortcutsScriptHandler(): void {
  const copyBtn = document.getElementById("copy-shortcuts-script");
  const shortcutsStatus = document.getElementById("shortcuts-status");

  if (copyBtn && shortcutsStatus) {
    copyBtn.addEventListener("click", async () => {
      try {
        const script = generateShortcutsScript();
        await navigator.clipboard.writeText(script);
        shortcutsStatus.textContent = "Copied! Paste in DevTools console (F12) on the shortcuts page.";
        shortcutsStatus.className = "import-status success";
        shortcutsStatus.classList.remove("hidden");

        setTimeout(() => {
          shortcutsStatus.classList.add("hidden");
        }, 5000);
      } catch (error) {
        shortcutsStatus.textContent = "Failed to copy script.";
        shortcutsStatus.className = "import-status error";
        shortcutsStatus.classList.remove("hidden");
      }
    });
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  // Tab switching
  const tabButtons = document.querySelectorAll<HTMLButtonElement>(".tab-btn");
  const tabContents = document.querySelectorAll<HTMLElement>(".tab-content");

  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetTab = btn.dataset.tab;
      if (!targetTab) return;

      tabButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      tabContents.forEach((content) => {
        content.classList.toggle("active", content.id === `tab-${targetTab}`);
      });
    });
  });

  // Open Data Manager button
  const openDataPageBtn = document.getElementById("open-data-page");
  if (openDataPageBtn) {
    openDataPageBtn.addEventListener("click", () => {
      chrome.tabs.create({ url: chrome.runtime.getURL("data/data.html") });
    });
  }

  const modeBadge = document.getElementById("mode-badge");
  const statusEl = document.getElementById("status");
  const postUi = document.getElementById("post-ui");
  const postForm = document.getElementById("post-form") as HTMLFormElement | null;
  const postInput = document.getElementById("post-input") as HTMLTextAreaElement | null;
  const historyList = document.getElementById("history-list");

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab?.id) {
    if (modeBadge) {
      modeBadge.textContent = "Unknown";
      modeBadge.className = "mode-badge mode-none";
    }
    if (statusEl) {
      statusEl.textContent = "Could not determine current tab";
    }
    return;
  }

  const url = tab.url || "";
  const isGrokImagine = url.startsWith("https://grok.com/imagine");
  const isShortcutsPage = url === "chrome://extensions/shortcuts";

  if (isShortcutsPage) {
    if (modeBadge) {
      modeBadge.textContent = "Shortcuts";
      modeBadge.className = "mode-badge mode-post";
    }
    if (statusEl) {
      statusEl.textContent = "Configure keyboard shortcuts below";
    }

    const shortcutsSection = document.getElementById("shortcuts-section");
    const dataTabBtn = document.querySelector<HTMLButtonElement>('.tab-btn[data-tab="data"]');

    if (shortcutsSection) {
      shortcutsSection.classList.remove("hidden");
    }

    if (dataTabBtn) {
      dataTabBtn.click();
    }

    setupShortcutsScriptHandler();
    return;
  }

  if (!isGrokImagine) {
    if (modeBadge) {
      modeBadge.textContent = "N/A";
      modeBadge.className = "mode-badge mode-none";
    }
    if (statusEl) {
      statusEl.textContent = "Navigate to grok.com/imagine to use this extension";
    }
    return;
  }

  try {
    const response = await chrome.tabs.sendMessage(tab.id, { type: "getMode" });

    const mode: Mode = response?.mode ?? "none";
    const sourceImageId: string | null = response?.sourceImageId ?? null;

    if (modeBadge) {
      modeBadge.textContent = MODE_LABELS[mode];
      modeBadge.className = `mode-badge mode-${mode}`;
    }

    if (statusEl) {
      statusEl.textContent = tab.title || url;
    }

    if (mode === "post" && sourceImageId && postUi && postForm && postInput && historyList) {
      postUi.classList.remove("hidden");

      const historyOptions: RenderHistoryOptions = {
        onRestore: (entry) => {
          postInput.value = entry.text;
          postInput.focus();
        },
        onDelete: async (entry) => {
          await deleteFromPostHistory(sourceImageId, entry.timestamp);
          const updatedHistory = await getPostHistory(sourceImageId);
          renderHistory(updatedHistory, historyList, historyOptions);
        },
      };

      const history = await getPostHistory(sourceImageId);
      renderHistory(history, historyList, historyOptions);

      postForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const text = postInput.value.trim();
        if (!text) return;

        // Save to history (handles duplicates by incrementing submitCount)
        await saveToPostHistory(sourceImageId, text);
        const updatedHistory = await getPostHistory(sourceImageId);
        renderHistory(updatedHistory, historyList, historyOptions);

        postInput.value = "";

        try {
          const result = await chrome.tabs.sendMessage(tab.id!, {
            type: "fillAndSubmit",
            text,
          });

          if (result && !result.success) {
            logger.error("Failed to fill and submit:", result.error);
          }
        } catch (err) {
          logger.error("Failed to communicate with content script:", err);
        }
      });

      // =======================================================================
      // Autosubmit UI Setup
      // =======================================================================
      const autosubmitBtn = document.getElementById(
        "autosubmit-btn"
      ) as HTMLButtonElement | null;
      const autosubmitCountInput = document.getElementById(
        "autosubmit-count"
      ) as HTMLInputElement | null;
      const autosubmitStatusEl = document.getElementById("autosubmit-status");
      const autosubmitProgressEl = document.getElementById("autosubmit-progress");
      const autosubmitCancelBtn = document.getElementById(
        "autosubmit-cancel"
      ) as HTMLButtonElement | null;

      // Update UI based on autosubmit state
      function updateAutosubmitUI(state: AutosubmitState): void {
        if (
          !autosubmitStatusEl ||
          !autosubmitProgressEl ||
          !autosubmitBtn ||
          !autosubmitCancelBtn
        )
          return;

        logger.log("Autosubmit state update:", state);

        if (state.status === "idle") {
          autosubmitStatusEl.classList.add("hidden");
          autosubmitBtn.disabled = false;
          return;
        }

        autosubmitStatusEl.classList.remove("hidden");
        autosubmitStatusEl.className = "autosubmit-status"; // Reset classes

        if (state.status === "running") {
          autosubmitBtn.disabled = true;
          autosubmitCancelBtn.classList.remove("hidden");
          const phaseLabel = PHASE_LABELS[state.phase] || state.phase;
          autosubmitProgressEl.textContent = `Attempt ${state.attempt}/${state.maxRetries} - ${phaseLabel}`;
        } else if (state.status === "success") {
          autosubmitBtn.disabled = false;
          autosubmitCancelBtn.classList.add("hidden");
          autosubmitStatusEl.classList.add("success");
          autosubmitProgressEl.textContent = `Success on attempt ${state.attempt}!`;
        } else if (state.status === "stopped") {
          autosubmitBtn.disabled = false;
          autosubmitCancelBtn.classList.add("hidden");
          const reasonLabel = STOP_REASON_LABELS[state.reason] || state.reason;
          autosubmitStatusEl.classList.add(
            state.reason === "rate_limited" ? "error" : "stopped"
          );
          autosubmitProgressEl.textContent = `Stopped: ${reasonLabel} (attempt ${state.attempt})`;
        }
      }

      // Query current autosubmit state on popup open
      try {
        const stateResponse = await chrome.tabs.sendMessage(tab.id!, {
          type: "autosubmit:getState",
        });
        if (stateResponse?.state) {
          logger.log("Initial autosubmit state:", stateResponse.state);
          updateAutosubmitUI(stateResponse.state);
        }
      } catch (err) {
        logger.log("Could not get autosubmit state:", err);
      }

      // Listen for autosubmit status updates from content script
      chrome.runtime.onMessage.addListener((message) => {
        if (message.type === "autosubmit:status" && message.state) {
          logger.log("Received autosubmit:status:", message.state);
          updateAutosubmitUI(message.state);
        }
      });

      // Autosubmit button click handler
      if (autosubmitBtn && autosubmitCountInput) {
        autosubmitBtn.addEventListener("click", async () => {
          const maxRetries = Math.max(
            1,
            parseInt(autosubmitCountInput.value, 10) || 10
          );
          logger.log(`Starting autosubmit with maxRetries=${maxRetries}`);

          // First, submit the current prompt (like clicking Submit)
          const text = postInput.value.trim();
          if (text) {
            await saveToPostHistory(sourceImageId, text);
            const updatedHistory = await getPostHistory(sourceImageId);
            renderHistory(updatedHistory, historyList, historyOptions);
            postInput.value = "";
          }

          // Now start autosubmit
          try {
            await chrome.tabs.sendMessage(tab.id!, {
              type: "autosubmit:start",
              maxRetries,
            });
          } catch (err) {
            logger.error("Failed to start autosubmit:", err);
          }
        });
      }

      // Cancel button click handler
      if (autosubmitCancelBtn) {
        autosubmitCancelBtn.addEventListener("click", async () => {
          logger.log("Cancelling autosubmit");
          try {
            await chrome.tabs.sendMessage(tab.id!, { type: "autosubmit:cancel" });
          } catch (err) {
            logger.error("Failed to cancel autosubmit:", err);
          }
        });
      }
    } else if (mode === "post" && !sourceImageId && postUi && statusEl) {
      statusEl.textContent = "Could not detect source image";
    }
  } catch (error) {
    logger.error("Failed to get mode:", error);
    if (modeBadge) {
      modeBadge.textContent = "Error";
      modeBadge.className = "mode-badge mode-none";
    }
    if (statusEl) {
      statusEl.textContent = "Refresh the page to activate extension";
    }
  }
});
