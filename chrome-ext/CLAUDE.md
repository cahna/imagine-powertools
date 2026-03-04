# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands

- `npm run build` - Production build to `dist/`
- `npm run dev` - Watch mode with inline source maps
- `npm run typecheck` - TypeScript type checking

After building, load the `dist/` folder as an unpacked extension in `chrome://extensions` (Developer mode).

## Architecture

Chrome Manifest V3 extension for adding power-user features to Grok Imagine (grok.com/imagine).

### Core Components

**background.ts** - Service worker handling:

- Keyboard command routing (defined in manifest.json `commands`)
- Tab mode tracking (Map of tabId -> Mode)
- Message passing between popup/content scripts
- Tab navigation commands
- Storage proxy for content scripts (IndexedDB not accessible from content scripts)
- LRU cache for hot-path storage reads

**shared/db.ts** - IndexedDB storage layer:

- Database: `ImaginePowerTools`, object store: `postHistory`
- Per-record operations: `getEntries`, `setEntries`, `getAllRecords`, `bulkSetRecords`, `clearAll`

**shared/storage.ts** - High-level storage API:

- Same interface as before (`getPostHistory`, `saveToPostHistory`, etc.)
- Backed by IndexedDB via db.ts
- Handles `submitCount` increment logic for duplicate prompts

**content.ts** - Injected into `grok.com/imagine*` pages:

- Mode detection: `favorites`, `results`, `post`, or `none`
- DOM manipulation for filling prompts (supports both textarea and tiptap/ProseMirror contenteditable)
- Video option clicking via radiogroup buttons or Settings dropdown menu
- History interception via `pushState`/`replaceState` patching for SPA navigation
- Alt+Shift+Click handler to open images in new tabs

**popup/popup.ts** - Extension popup UI:

- Displays current mode via content script messaging
- Post mode: prompt input form and history management
- Data tab: JSON import/export of prompt history

### Key Patterns

**Mode Detection**: The content script detects page state via URL patterns and DOM elements (e.g., presence of Back button indicates results mode).

**React Input Handling**: Uses native value setters + `input` event dispatch to work with React-controlled inputs (`setReactInputValue`). For tiptap editors, uses `execCommand('insertText')`.

**Storage**: Prompt history stored in IndexedDB (`ImaginePowerTools` database, `postHistory` object store), keyed by source image UUID. Each record contains `{ postId, entries: HistoryEntry[] }`. The background script maintains an LRU cache (100 entries) for fast reads during rapid tab cycling.

**Message Types**:

- Content script: `modeChange`, `getMode`, `fillAndSubmit`, `submitFromClipboard`, `clickVideoOption`, `clickDownload`, `openTab`
- Storage (content→background): `storage:getPostHistory`, `storage:saveToPostHistory`

### Build System

`scripts/build.ts` uses esbuild:

- All TypeScript compiled to IIFE format (required for content/popup scripts)
- Static files (manifest, HTML, CSS, icons) copied to dist
- Watch mode keeps dist directory intact to preserve Chrome file handles
