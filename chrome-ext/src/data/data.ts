// Data management page for Imagine Power Tools

import {
  PostHistory,
  HistoryEntry,
  getAllHistory,
  validatePostHistory,
  mergeHistories,
  bulkImportHistory,
  clearAllHistory,
} from "../shared/storage";

// State
let currentHistory: PostHistory = {};
let selectedSourceId: string | null = null;
let searchQuery = "";

// Modal state
let modalMode: "add" | "edit" = "add";
let editingTimestamp: number | null = null;

// DOM Elements
const elements = {
  // Nav
  navBtns: document.querySelectorAll<HTMLButtonElement>(".nav-btn"),
  tabContents: document.querySelectorAll<HTMLElement>(".tab-content"),

  // Explorer
  sourceCount: document.getElementById("source-count"),
  sourceSearch: document.getElementById("source-search") as HTMLInputElement,
  sourcesList: document.getElementById("sources-list"),
  promptsPlaceholder: document.getElementById("prompts-placeholder"),
  promptsContent: document.getElementById("prompts-content"),
  selectedSourceTitle: document.getElementById("selected-source-title"),
  selectedSourceLink: document.getElementById("selected-source-link") as HTMLAnchorElement,
  promptCount: document.getElementById("prompt-count"),
  promptsList: document.getElementById("prompts-list"),
  addPromptBtn: document.getElementById("add-prompt-btn"),
  deleteSourceBtn: document.getElementById("delete-source-btn"),

  // Import/Export
  stats: document.getElementById("stats"),
  exportBtn: document.getElementById("export-btn"),
  downloadBtn: document.getElementById("download-btn"),
  importFileBtn: document.getElementById("import-file-btn"),
  importFileInput: document.getElementById("import-file") as HTMLInputElement,
  importData: document.getElementById("import-data") as HTMLTextAreaElement,
  importBtn: document.getElementById("import-btn"),
  importStatus: document.getElementById("import-status"),
  clearBtn: document.getElementById("clear-btn"),

  // Modal
  modal: document.getElementById("edit-modal"),
  modalTitle: document.getElementById("modal-title"),
  modalTextarea: document.getElementById("modal-textarea") as HTMLTextAreaElement,
  modalClose: document.getElementById("modal-close"),
  modalCancel: document.getElementById("modal-cancel"),
  modalSave: document.getElementById("modal-save"),
  modalBackdrop: document.querySelector(".modal-backdrop"),
};

// Utility functions
function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "...";
}

// Stats
function updateStats(): void {
  if (!elements.stats) return;

  const postCount = Object.keys(currentHistory).length;
  const entryCount = Object.values(currentHistory).reduce(
    (sum, entries) => sum + entries.length,
    0
  );

  elements.stats.innerHTML = `
    <span class="stat-item">
      <span class="stat-value">${postCount.toLocaleString()}</span>
      <span class="stat-label">Sources</span>
    </span>
    <span class="stat-item">
      <span class="stat-value">${entryCount.toLocaleString()}</span>
      <span class="stat-label">Prompts</span>
    </span>
  `;
}

// Sources list
function renderSourcesList(): void {
  if (!elements.sourcesList || !elements.sourceCount) return;

  const entries = Object.entries(currentHistory);
  const filtered = searchQuery
    ? entries.filter(
        ([id, prompts]) =>
          id.toLowerCase().includes(searchQuery.toLowerCase()) ||
          prompts.some((p) =>
            p.text.toLowerCase().includes(searchQuery.toLowerCase())
          )
      )
    : entries;

  // Sort by most recent prompt
  filtered.sort((a, b) => {
    const aLatest = Math.max(...a[1].map((p) => p.timestamp));
    const bLatest = Math.max(...b[1].map((p) => p.timestamp));
    return bLatest - aLatest;
  });

  elements.sourceCount.textContent = filtered.length.toString();

  if (filtered.length === 0) {
    elements.sourcesList.innerHTML = `
      <li class="empty-state">
        ${searchQuery ? "No sources match your search" : "No sources yet"}
      </li>
    `;
    return;
  }

  elements.sourcesList.innerHTML = filtered
    .map(([id, prompts]) => {
      const latestPrompt = prompts.reduce((a, b) =>
        a.timestamp > b.timestamp ? a : b
      );
      const isActive = id === selectedSourceId;

      return `
        <li class="source-item ${isActive ? "active" : ""}" data-id="${id}">
          <div class="source-item-header">
            <span class="source-id">${id}</span>
            <span class="source-count">${prompts.length} prompt${prompts.length !== 1 ? "s" : ""}</span>
          </div>
          <div class="source-preview">${truncate(latestPrompt.text, 100)}</div>
        </li>
      `;
    })
    .join("");

  // Add click handlers
  elements.sourcesList.querySelectorAll(".source-item").forEach((item) => {
    item.addEventListener("click", () => {
      const id = item.getAttribute("data-id");
      if (id) selectSource(id);
    });
  });
}

// Select source
function selectSource(id: string): void {
  selectedSourceId = id;

  // Update active state in list
  elements.sourcesList?.querySelectorAll(".source-item").forEach((item) => {
    item.classList.toggle("active", item.getAttribute("data-id") === id);
  });

  renderPromptsList();
}

// Prompts list
function renderPromptsList(): void {
  if (!selectedSourceId) {
    elements.promptsPlaceholder?.classList.remove("hidden");
    elements.promptsContent?.classList.add("hidden");
    return;
  }

  elements.promptsPlaceholder?.classList.add("hidden");
  elements.promptsContent?.classList.remove("hidden");

  const prompts = currentHistory[selectedSourceId] || [];

  if (elements.selectedSourceTitle) {
    elements.selectedSourceTitle.textContent = selectedSourceId;
  }

  if (elements.selectedSourceLink) {
    elements.selectedSourceLink.href = `https://grok.com/imagine/post/${selectedSourceId}`;
  }

  if (elements.promptCount) {
    elements.promptCount.textContent = `${prompts.length} prompt${prompts.length !== 1 ? "s" : ""}`;
  }

  if (!elements.promptsList) return;

  if (prompts.length === 0) {
    elements.promptsList.innerHTML = `
      <li class="empty-state">No prompts for this source</li>
    `;
    return;
  }

  // Sort by timestamp descending
  const sorted = [...prompts].sort((a, b) => b.timestamp - a.timestamp);

  elements.promptsList.innerHTML = sorted
    .map(
      (prompt) => {
        const count = prompt.submitCount || 1;
        return `
      <li class="prompt-item" data-timestamp="${prompt.timestamp}">
        <div class="prompt-text">${escapeHtml(prompt.text)}</div>
        <div class="prompt-meta">
          <span class="prompt-time">${formatDate(prompt.timestamp)}</span>
          <span class="submit-count" title="Submitted ${count} time${count !== 1 ? 's' : ''}">×${count}</span>
          <div class="prompt-actions">
            <button class="btn btn-ghost edit-prompt-btn" title="Edit">Edit</button>
            <button class="btn btn-ghost danger delete-prompt-btn" title="Delete">Delete</button>
          </div>
        </div>
      </li>
    `;
      }
    )
    .join("");

  // Add event handlers
  elements.promptsList.querySelectorAll(".edit-prompt-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const item = (e.target as HTMLElement).closest(".prompt-item");
      const timestamp = parseInt(item?.getAttribute("data-timestamp") || "0");
      openEditModal(timestamp);
    });
  });

  elements.promptsList.querySelectorAll(".delete-prompt-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const item = (e.target as HTMLElement).closest(".prompt-item");
      const timestamp = parseInt(item?.getAttribute("data-timestamp") || "0");
      deletePrompt(timestamp);
    });
  });
}

function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// Modal functions
function openModal(): void {
  elements.modal?.classList.remove("hidden");
  elements.modalTextarea?.focus();
}

function closeModal(): void {
  elements.modal?.classList.add("hidden");
  if (elements.modalTextarea) {
    elements.modalTextarea.value = "";
  }
  editingTimestamp = null;
}

function openAddModal(): void {
  modalMode = "add";
  if (elements.modalTitle) {
    elements.modalTitle.textContent = "Add Prompt";
  }
  if (elements.modalTextarea) {
    elements.modalTextarea.value = "";
  }
  openModal();
}

function openEditModal(timestamp: number): void {
  if (!selectedSourceId) return;

  const prompts = currentHistory[selectedSourceId] || [];
  const prompt = prompts.find((p) => p.timestamp === timestamp);

  if (!prompt) return;

  modalMode = "edit";
  editingTimestamp = timestamp;

  if (elements.modalTitle) {
    elements.modalTitle.textContent = "Edit Prompt";
  }
  if (elements.modalTextarea) {
    elements.modalTextarea.value = prompt.text;
  }

  openModal();
}

async function saveModal(): Promise<void> {
  if (!selectedSourceId || !elements.modalTextarea) return;

  const text = elements.modalTextarea.value.trim();
  if (!text) return;

  if (modalMode === "add") {
    // Add new prompt
    if (!currentHistory[selectedSourceId]) {
      currentHistory[selectedSourceId] = [];
    }
    currentHistory[selectedSourceId].push({
      text,
      timestamp: Date.now(),
    });
  } else if (modalMode === "edit" && editingTimestamp !== null) {
    // Edit existing prompt
    const prompts = currentHistory[selectedSourceId];
    const index = prompts.findIndex((p) => p.timestamp === editingTimestamp);
    if (index !== -1) {
      prompts[index].text = text;
    }
  }

  await bulkImportHistory(currentHistory);

  closeModal();
  renderPromptsList();
  renderSourcesList();
  updateStats();
}

// Delete functions
async function deletePrompt(timestamp: number): Promise<void> {
  if (!selectedSourceId) return;

  if (!confirm("Delete this prompt?")) return;

  const prompts = currentHistory[selectedSourceId];
  currentHistory[selectedSourceId] = prompts.filter(
    (p) => p.timestamp !== timestamp
  );

  // Remove source if no prompts left
  if (currentHistory[selectedSourceId].length === 0) {
    delete currentHistory[selectedSourceId];
    selectedSourceId = null;
  }

  await bulkImportHistory(currentHistory);

  renderPromptsList();
  renderSourcesList();
  updateStats();
}

async function deleteSource(): Promise<void> {
  if (!selectedSourceId) return;

  const prompts = currentHistory[selectedSourceId] || [];
  if (
    !confirm(
      `Delete this source and all ${prompts.length} prompt${prompts.length !== 1 ? "s" : ""}?`
    )
  ) {
    return;
  }

  delete currentHistory[selectedSourceId];
  selectedSourceId = null;

  await bulkImportHistory(currentHistory);

  renderPromptsList();
  renderSourcesList();
  updateStats();
}

// Status message
function showStatus(message: string, isError: boolean): void {
  if (!elements.importStatus) return;

  elements.importStatus.textContent = message;
  elements.importStatus.className = `status-message ${isError ? "error" : "success"}`;
  elements.importStatus.classList.remove("hidden");

  if (!isError) {
    setTimeout(() => {
      elements.importStatus?.classList.add("hidden");
    }, 5000);
  }
}

// Initialize
async function init(): Promise<void> {
  currentHistory = await getAllHistory();
  updateStats();
  renderSourcesList();

  // Navigation
  elements.navBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = btn.dataset.tab;
      if (!tab) return;

      elements.navBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      elements.tabContents.forEach((content) => {
        content.classList.toggle("active", content.id === `tab-${tab}`);
      });
    });
  });

  // Search
  elements.sourceSearch?.addEventListener("input", (e) => {
    searchQuery = (e.target as HTMLInputElement).value;
    renderSourcesList();
  });

  // Add prompt button
  elements.addPromptBtn?.addEventListener("click", openAddModal);

  // Delete source button
  elements.deleteSourceBtn?.addEventListener("click", deleteSource);

  // Modal handlers
  elements.modalClose?.addEventListener("click", closeModal);
  elements.modalCancel?.addEventListener("click", closeModal);
  elements.modalBackdrop?.addEventListener("click", closeModal);
  elements.modalSave?.addEventListener("click", saveModal);

  // Export to clipboard
  elements.exportBtn?.addEventListener("click", async () => {
    const json = JSON.stringify(currentHistory, null, 2);
    await navigator.clipboard.writeText(json);
    if (elements.exportBtn) {
      elements.exportBtn.textContent = "Copied!";
      setTimeout(() => {
        elements.exportBtn!.textContent = "Copy to Clipboard";
      }, 2000);
    }
  });

  // Download JSON
  elements.downloadBtn?.addEventListener("click", () => {
    const json = JSON.stringify(currentHistory, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `grok-imagine-history-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  // File import
  elements.importFileBtn?.addEventListener("click", () => {
    elements.importFileInput?.click();
  });

  elements.importFileInput?.addEventListener("change", async () => {
    const file = elements.importFileInput?.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);

      if (!validatePostHistory(parsed)) {
        showStatus("Invalid data format.", true);
        return;
      }

      const { merged, addedCount, skippedCount } = mergeHistories(
        currentHistory,
        parsed
      );

      await bulkImportHistory(merged);
      currentHistory = merged;

      showStatus(
        `Added ${addedCount} source(s), skipped ${skippedCount} existing.`,
        false
      );

      updateStats();
      renderSourcesList();

      if (elements.importFileInput) {
        elements.importFileInput.value = "";
      }
    } catch (error) {
      showStatus(
        error instanceof SyntaxError ? "Invalid JSON format." : "Import failed.",
        true
      );
    }
  });

  // Text import
  elements.importBtn?.addEventListener("click", async () => {
    const json = elements.importData?.value.trim();
    if (!json) {
      showStatus("Please paste JSON data first.", true);
      return;
    }

    try {
      const parsed = JSON.parse(json);

      if (!validatePostHistory(parsed)) {
        showStatus("Invalid data format.", true);
        return;
      }

      const { merged, addedCount, skippedCount } = mergeHistories(
        currentHistory,
        parsed
      );

      await bulkImportHistory(merged);
      currentHistory = merged;

      showStatus(
        `Added ${addedCount} source(s), skipped ${skippedCount} existing.`,
        false
      );

      updateStats();
      renderSourcesList();

      if (elements.importData) {
        elements.importData.value = "";
      }
    } catch (error) {
      showStatus(
        error instanceof SyntaxError ? "Invalid JSON format." : "Import failed.",
        true
      );
    }
  });

  // Clear all
  elements.clearBtn?.addEventListener("click", async () => {
    if (
      !confirm("Delete ALL data? This cannot be undone.")
    ) {
      return;
    }

    await clearAllHistory();
    currentHistory = {};
    selectedSourceId = null;

    updateStats();
    renderSourcesList();
    renderPromptsList();
    showStatus("All data cleared.", false);
  });
}

document.addEventListener("DOMContentLoaded", init);
