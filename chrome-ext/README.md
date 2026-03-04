# Grok Imagine Power Tools

A Chrome extension that adds power-user features to [Grok Imagine](https://grok.com/imagine), including keyboard shortcuts and prompt history management.

## Features

### Keyboard Shortcuts

**Built-in shortcuts (work immediately):**
| Shortcut | Action |
|----------|--------|
| `Alt+Shift+R` | Re-submit the most recent prompt for the current image |
| `Alt+Shift+P` | Submit prompt from clipboard |
| `Alt+Shift+H` | Switch to previous browser tab |
| `Alt+Shift+L` | Switch to next browser tab |

**Video Options shortcuts (require manual configuration):**
| Shortcut | Action |
|----------|--------|
| `Alt+Shift+6` | Set video duration to 6 seconds |
| `Alt+Shift+0` | Set video duration to 10 seconds |
| `Alt+Shift+,` | Set video resolution to 480p |
| `Alt+Shift+.` | Set video resolution to 720p |
| `Alt+Shift+X` | Set video mood to Spicy |
| `Alt+Shift+F` | Set video mood to Fun |
| `Alt+Shift+N` | Set video mood to Normal |

**Other shortcuts:**
| Shortcut | Action |
|----------|--------|
| `Alt+Shift+Click` | Open image/video in new tab (from Favorites or Results view) |

### Prompt History

When viewing a generated image (`/imagine/post/...`), the extension popup shows:
- A text input to submit new prompts
- History of previously submitted prompts for that image
- Ability to restore or delete history entries

### Data Import/Export

The popup's "Data" tab allows you to:
- **Export** all stored prompt history as JSON
- **Import** previously exported JSON data (merges with existing data)

## Installation

### From Source

1. Clone this repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build the extension:
   ```bash
   npm run build
   ```
4. Open Chrome and navigate to `chrome://extensions`
5. Enable "Developer mode" (toggle in top right)
6. Click "Load unpacked"
7. Select the `dist` folder

### Configure Additional Shortcuts

Chrome limits extensions to 4 default keyboard shortcuts. To enable the Video Options shortcuts:

1. Go to `chrome://extensions/shortcuts`
2. Find "Grok Imagine Power Tools"
3. Click the pencil icon next to each Video Options command
4. Press your desired key combination (suggested shortcuts listed above)

## Development

### Scripts

- `npm run build` - Build the extension to `dist/`
- `npm run dev` - Build in watch mode with source maps
- `npm run typecheck` - Run TypeScript type checking

### Project Structure

```
src/
├── manifest.json      # Extension manifest (Manifest V3)
├── background.ts      # Service worker for handling commands + storage cache
├── content.ts         # Content script injected into grok.com/imagine
├── shared/
│   ├── db.ts          # IndexedDB storage layer
│   └── storage.ts     # High-level storage API
├── popup/
│   ├── popup.html     # Popup UI
│   ├── popup.ts       # Popup logic
│   └── popup.css      # Popup styles
└── data/
    ├── data.html      # Data Manager page
    ├── data.ts        # Data Manager logic
    └── data.css       # Data Manager styles
```

### Storage

Prompt history is stored in IndexedDB (`ImaginePowerTools` database) for better performance with large datasets. The background script maintains an LRU cache for frequently accessed entries. Data can be exported/imported as JSON via the Data Manager.

## Usage Notes

- The extension only activates on `https://grok.com/imagine*` pages
- Prompt history is keyed by source image ID, so variants of the same image share history
- Video Options shortcuts work on post pages where the "Video Options" button is visible
- If the Video Options menu is closed, the shortcut will automatically open it before selecting the option
