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

**Storage**: Prompt history stored in `chrome.storage.local` under key `postHistory`, keyed by source image UUID.

**Message Types**: `modeChange`, `getMode`, `fillAndSubmit`, `submitFromClipboard`, `clickVideoOption`, `clickDownload`, `openTab`

### Build System

`scripts/build.ts` uses esbuild:
- All TypeScript compiled to IIFE format (required for content/popup scripts)
- Static files (manifest, HTML, CSS, icons) copied to dist
- Watch mode keeps dist directory intact to preserve Chrome file handles
