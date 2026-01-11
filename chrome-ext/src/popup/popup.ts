// Popup script for Grok Imagine Power Tools

type Mode = "favorites" | "results" | "post" | "none";

interface HistoryEntry {
  text: string;
  timestamp: number;
}

interface PostHistory {
  [postId: string]: HistoryEntry[];
}

const MODE_LABELS: Record<Mode, string> = {
  favorites: "Favorites",
  results: "Results",
  post: "Post",
  none: "None",
};

// Storage key for post history
const STORAGE_KEY = "postHistory";

// Get history for a specific post
async function getPostHistory(postId: string): Promise<HistoryEntry[]> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const history: PostHistory = result[STORAGE_KEY] || {};
  return history[postId] || [];
}

// Save an entry to post history
async function saveToPostHistory(postId: string, text: string): Promise<void> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const history: PostHistory = result[STORAGE_KEY] || {};

  if (!history[postId]) {
    history[postId] = [];
  }

  history[postId].push({
    text,
    timestamp: Date.now(),
  });

  await chrome.storage.local.set({ [STORAGE_KEY]: history });
}

// Delete an entry from post history
async function deleteFromPostHistory(postId: string, timestamp: number): Promise<void> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const history: PostHistory = result[STORAGE_KEY] || {};

  if (history[postId]) {
    history[postId] = history[postId].filter((entry) => entry.timestamp !== timestamp);
    await chrome.storage.local.set({ [STORAGE_KEY]: history });
  }
}

// SVG icons
const REFRESH_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>`;

const DELETE_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`;

interface RenderHistoryOptions {
  onRestore: (entry: HistoryEntry) => void;
  onDelete: (entry: HistoryEntry) => void;
}

// Render history list
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

  // Show most recent first
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
    timeSpan.textContent = new Date(entry.timestamp).toLocaleString();

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

document.addEventListener("DOMContentLoaded", async () => {
  const modeBadge = document.getElementById("mode-badge");
  const statusEl = document.getElementById("status");
  const postUi = document.getElementById("post-ui");
  const postForm = document.getElementById("post-form") as HTMLFormElement | null;
  const postInput = document.getElementById("post-input") as HTMLTextAreaElement | null;
  const historyList = document.getElementById("history-list");

  // Get current tab
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

  // Check if we're on a grok.com/imagine page
  const url = tab.url || "";
  const isGrokImagine = url.startsWith("https://grok.com/imagine");

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

  // Query content script directly for mode (more reliable than background)
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

    // Show post UI if in post mode with a valid source image ID
    if (mode === "post" && sourceImageId && postUi && postForm && postInput && historyList) {
      postUi.classList.remove("hidden");

      // History render options with callbacks (keyed by source image ID)
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

      // Load and render history
      const history = await getPostHistory(sourceImageId);
      renderHistory(history, historyList, historyOptions);

      // Handle form submission
      postForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const text = postInput.value.trim();
        if (!text) return;

        // Check if text already exists in history
        const currentHistory = await getPostHistory(sourceImageId);
        const alreadyExists = currentHistory.some((entry) => entry.text === text);

        if (!alreadyExists) {
          // Save to history only if unique (keyed by source image ID)
          await saveToPostHistory(sourceImageId, text);

          // Refresh history
          const updatedHistory = await getPostHistory(sourceImageId);
          renderHistory(updatedHistory, historyList, historyOptions);
        }

        // Clear input
        postInput.value = "";

        // Fill the page's textarea and click Make video
        try {
          const result = await chrome.tabs.sendMessage(tab.id!, {
            type: "fillAndSubmit",
            text,
          });

          if (result && !result.success) {
            console.error("Failed to fill and submit:", result.error);
          }
        } catch (err) {
          console.error("Failed to communicate with content script:", err);
        }
      });
    } else if (mode === "post" && !sourceImageId && postUi && statusEl) {
      // Post mode but couldn't find source image ID
      statusEl.textContent = "Could not detect source image";
    }
  } catch (error) {
    console.error("Failed to get mode:", error);
    if (modeBadge) {
      modeBadge.textContent = "Error";
      modeBadge.className = "mode-badge mode-none";
    }
    if (statusEl) {
      statusEl.textContent = "Refresh the page to activate extension";
    }
  }
});
