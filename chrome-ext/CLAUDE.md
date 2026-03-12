# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Critical Notes

**NEVER use the chrome-devtools MCP tool** for testing or interacting with Grok Imagine pages. It does not work with credentials and is detected as a bot, which triggers Cloudflare to block access. You may try using the Chrome DevTools Protocol HTTP API directly instead (e.g., via curl to `http://localhost:9222`).

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

**content.ts** - Entry point injected into `grok.com/imagine*` pages (~400 lines):

- Message routing to appropriate handlers
- Initialization of navigation patching and autosubmit
- Delegates to handlers/ modules for actual functionality

**content.core.ts** - Testable DOM interaction functions:

- `detectMode()`, `clickVideoOption()`, `fillAndSubmitVideo()`, `detectGenerationOutcome()`, etc.
- Uses PageObjects for DOM queries and actions
- Exported for use by handlers and tests

**handlers/** - Focused handler modules split from content.ts:

- `storage.ts` - Storage operations via message passing to background script
- `navigation.ts` - Mode detection, history interception for SPA navigation
- `urlExtraction.ts` - UUID extraction from URLs and DOM elements
- `favoritesClick.ts` - Alt+Shift+Click handler to open images in new tabs
- `autosubmit.ts` - XState state machine integration, retry loop for moderated results

**pages/** - PageObject pattern for DOM interactions:

- `PageObject.ts` - Base class with `$()` and `$$()` query helpers, document injection
- `GenerationStatusPage.ts` - Detects generation outcomes (success, moderated, error)
- `NotificationsPage.ts` - Toast notification detection and dismissal

**pages/menus/** - Menu PageObjects:

- `MoreOptionsMenu.ts` - Toolbar's "More options" popup (delete, thumbs, extend)
- `PromptSettingsMenu.ts` - Prompt area's "Settings" popup (mood, redo, extend)

**pages/post/** - Post page PageObjects:

- `PostPage.ts` - Composite facade providing access to all post page components
- `ToolbarPage.ts` - Right-side toolbar (download, save, share, redo, media type switcher)
- `PromptFormPage.ts` - Prompt input form (tiptap editor or textarea)
- `VideoCarouselPage.ts` - Video carousel navigation and selection

**popup/popup.ts** - Extension popup UI:

- Displays current mode via content script messaging
- Post mode: prompt input form and history management
- Data tab: JSON import/export of prompt history

### Key Patterns

**PageObject Pattern**: DOM interactions are encapsulated in PageObject classes (`src/pages/`). Each PageObject:

- Accepts optional `document` parameter for testing with custom DOM
- Provides `isPresent()` to check if the component exists
- Returns `Result<T, DomError>` for fallible operations (using neverthrow)
- Composite PageObjects (e.g., `PostPage`) provide structured access to child components

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
- `src/content.test.ts` - Behavioral tests for content.core.ts functions
- `src/pages/**/*.test.ts` - PageObject unit tests (DOM queries, actions)
- `src/machines/*.test.ts` - XState machine tests

Tests verify DOM interactions like clicking video options, filling prompts, and detecting page state. PageObject tests verify element detection and document injection scoping.

## Contributing Guidelines

### Code Style

- **Message Types**: Use constants from `shared/messageTypes.ts` instead of magic strings. Import the appropriate `*MessageType` const object and use its properties (e.g., `ContentMessageType.GET_MODE` instead of `"getMode"`).

- **Docstrings**: Add JSDoc-style docstrings (`/** ... */`) to all functions describing what they do. Focus on the "what" not the "how". No need to document parameters or return types (TypeScript handles that).

- **Const Objects over Enums**: Prefer `as const` objects over TypeScript enums for better tree-shaking and runtime behavior.

### Selector Arrays

- **Never use `[0]` on selector arrays** - always iterate through all selectors using `selectFirst()` or pass the full array to functions that support it
- When a utility only accepts a single selector but you need fallback support, extend the utility to accept `string | readonly string[]` rather than working around it

### Reusing Existing Infrastructure

- Before writing inline DOM queries, check if a PageObject or helper already exists for that purpose
- When adding new functionality, prefer extending existing utilities over duplicating logic
- If the same pattern appears in multiple handlers, extract it into a shared helper in `content.core.ts`

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

- [ ] Add tests for new PageObjects in `src/pages/**/*.test.ts`
- [ ] Add tests for new DOM interactions in `content.test.ts`
- [ ] Add tests for any new/changed "pure" utility functions
- [ ] Run `npx prettier --write .`
- [ ] `npm run typecheck` succeeds
- [ ] `npm test` succeeds
