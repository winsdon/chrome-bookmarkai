# BookmarkAI

<p align="center">
  <img src="src/icons/icon128.png" alt="BookmarkAI Logo" width="128" height="128">
</p>

<p align="center">
  <b>AI-Powered Chrome Bookmark Organizer</b><br>
  使用 AI 智能整理和分类浏览器书签的 Chrome 扩展
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#installation">Installation</a> •
  <a href="#usage">Usage</a> •
  <a href="#supported-apis">Supported APIs</a>
</p>

---

## Features

- **Smart Classification** - AI analyzes bookmark content and generates appropriate category suggestions
- **One-Click Organization** - Automatically creates folders and moves bookmarks to corresponding categories
- **Custom Categories** - Support preset custom categories, AI will prioritize using them
- **Multi-Model Support** - Supports OpenAI GPT series and compatible APIs
- **Visual Preview** - Preview classification results before execution

## Installation

1. Clone this repository
   ```bash
   git clone https://github.com/winsdon/chrome-bookmarkai.git
   ```

2. Open Chrome browser and navigate to `chrome://extensions/`

3. Enable **Developer mode** in the top right corner

4. Click **Load unpacked**

5. Select the project root directory (the folder containing `manifest.json`)

## Usage

### 1. Configure API

1. Click the extension icon, then click the settings button in the top right
2. Enter your API key (supports OpenAI or compatible APIs)
3. Select a model or enter a custom model name
4. Click **Test Connection** to verify configuration
5. Save settings

### 2. Organize Bookmarks

1. Click the extension icon to open the main panel
2. Click **Analyze Bookmarks** - AI will analyze uncategorized bookmarks
3. Review the classification suggestions preview
4. Click **Apply Classification** to execute the organization

## Project Structure

```
chrome-bookmarkai/
├── manifest.json              # Extension configuration
├── src/
│   ├── popup.html            # Popup window HTML
│   ├── popup.js              # Popup window logic
│   ├── options.html          # Settings page HTML
│   ├── options.js            # Settings page logic
│   ├── background.js         # Background service worker
│   ├── icons/                # Extension icons
│   ├── styles/               # Stylesheets
│   └── modules/              # Feature modules
│       ├── bookmarkManager.js    # Bookmark management
│       ├── aiService.js          # AI service integration
│       └── storageManager.js     # Storage management
```

## Supported APIs

- **OpenAI API** (default)
- Any OpenAI-compatible API service:
  - Azure OpenAI
  - Local LLMs (e.g., Ollama with compatibility layer)
  - Other third-party API services

## Privacy

- Bookmark data is only processed locally and sent to your configured AI API
- API keys are stored in Chrome's local storage
- No data is sent to third-party services (except your configured AI API)

## Development

This extension is built with vanilla JavaScript - no build steps required.

After modifying code, click the refresh button on the extension card at `chrome://extensions/` to reload.

## License

MIT
