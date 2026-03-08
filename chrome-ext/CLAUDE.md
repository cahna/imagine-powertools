# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands

- `npm run build` - Production build to `dist/`
- `npm run dev` - Watch mode with inline source maps
- `npm run typecheck` - TypeScript type checking
- `npm test` - Run tests once
- `npm run test:watch` - Run tests in watch mode

After building, load the `dist/` folder as an unpacked extension in `chrome://extensions` (Developer mode).

## Architecture

Chrome Manifest V3 extension for adding power-user features to Imagine (grok.com/imagine).

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

**shared/theme.ts** - Theme management:

- `initTheme()`, `getThemePreference()`, `setThemePreference()`
- Supports 'light', 'dark', or 'system' (follows OS preference)
- Theme preference stored in `chrome.storage.local`

**shared/variables.css** - CSS custom properties for theming:

- Light theme in `:root`, dark theme in `[data-theme="dark"]`
- Linked from both `popup.html` and `data.html`

**content.ts** - Injected into `grok.com/imagine*` pages:

- Mode detection: `favorites`, `results`, `post`, or `none`
- DOM manipulation for filling prompts (supports both textarea and tiptap/ProseMirror contenteditable)
- Video option clicking via radiogroup buttons or Settings dropdown menu
- History interception via `pushState`/`replaceState` patching for SPA navigation
- Alt+Shift+Click handler to open images in new tabs
- Autosubmit feature with retry logic for moderated results

**content.core.ts** - Testable functions extracted from content.ts:

- Exported for use by both content.ts and tests
- `detectMode()`, `clickVideoOption()`, `fillAndSubmitVideo()`, `detectGenerationOutcome()`, etc.

**popup/popup.ts** - Extension popup UI:

- Displays current mode via content script messaging
- Post mode: prompt input form and history management
- Data tab: JSON import/export of prompt history

### Key Patterns

**Mode Detection**: The content script detects page state via URL patterns and DOM elements (e.g., presence of Back button indicates results mode).

**React Input Handling**: Uses native value setters + `input` event dispatch to work with React-controlled inputs (`setReactInputValue`). For tiptap editors, uses `execCommand('insertText')`.

**Storage**: Prompt history stored in IndexedDB (`ImaginePowerTools` database, `postHistory` object store), keyed by source image UUID. Each record contains `{ postId, entries: HistoryEntry[] }`. The background script maintains an LRU cache (100 entries) for fast reads during rapid tab cycling.

**Message Types** (defined in `shared/messageTypes.ts`):

### Build System

`scripts/build.ts` uses esbuild:

- All TypeScript compiled to IIFE format (required for content/popup scripts)
- Static files (manifest, HTML, CSS, icons) copied to dist
- Watch mode keeps dist directory intact to preserve Chrome file handles

### Testing

Uses Vitest with jsdom for behavioral tests. Key files:

- `vitest.config.ts` - Test configuration
- `src/test/setup.ts` - Chrome API mocks
- `src/content.test.ts` - Behavioral tests for content script functions
- `src/content.core.ts` - Functions extracted from content.ts to enable testing

Tests verify DOM interactions like clicking video options, filling prompts, and detecting page state. This catches bugs like accidentally removing helper functions that are still called.

## Contributing Guidelines

### Code Style

- **Message Types**: Use constants from `shared/messageTypes.ts` instead of magic strings. Import the appropriate `*MessageType` const object and use its properties (e.g., `ContentMessageType.GET_MODE` instead of `"getMode"`).

- **Docstrings**: Add JSDoc-style docstrings (`/** ... */`) to all functions describing what they do. Focus on the "what" not the "how". No need to document parameters or return types (TypeScript handles that).

- **Const Objects over Enums**: Prefer `as const` objects over TypeScript enums for better tree-shaking and runtime behavior.

### CSS & Theming

- **Use CSS Variables**: All colors should use variables from `shared/variables.css`. Never use hardcoded hex colors in CSS files.
- **Variable naming**: `--bg-*` for backgrounds, `--text-*` for text, `--border-*` for borders, `--accent-*` for primary action colors, `--success/error/warning/info-*` for status colors.
- **Dark mode**: Defined in `[data-theme="dark"]` selector in `variables.css`. Theme preference stored in `chrome.storage.local` via `shared/theme.ts`.
- **Adding new colors**: Add to both `:root` (light) and `[data-theme="dark"]` blocks in `variables.css`.

### Adding New Message Types

1. Add the new message type to the appropriate const object in `shared/messageTypes.ts`
2. Import and use the constant in both sender and receiver files
3. Update this documentation if adding a new message type category

### Adding New Keyboard Commands

Chrome limits extensions to 4 commands with `suggested_key` in manifest.json. This extension uses a workaround:

1. **manifest.json**: Add the command with only a `description` (no `suggested_key`):

   ```json
   "my-command": {
     "description": "Description of what this command does"
   }
   ```

2. **background.ts**: Add command routing in `chrome.commands.onCommand.addListener()` to forward to content script

3. **popup/popup.ts**: Add the hotkey mapping to the `HOTKEYS` object in `generateShortcutsScript()`:

   ```typescript
   const HOTKEYS = {
     // ... existing mappings ...
     "my-command": "M", // Will become Alt+Shift+M
   };
   ```

4. **content.ts / content.core.ts**: Implement the handler

Users configure shortcuts by:

1. Opening popup on `chrome://extensions/shortcuts` page
2. Clicking "Copy Setup Script" button
3. Pasting in DevTools console (F12)

This script automates setting all shortcuts to `Alt+Shift+<key>` at once.

### Pre-commit Checklist

- [ ] Add tests for new DOM interactions in `content.test.ts`
- [ ] Add tests for any new/changed "pure" utility functions
- [ ] Run `npx prettier --write .`
- [ ] `npm run typecheck` succeeds
- [ ] `npm test` succeeds
