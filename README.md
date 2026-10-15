# Focus Mode — Chrome Extension (Manifest V3)

> **Reclaim your digital focus.** Focus Mode removes addictive algorithmic feeds, infinite vertical video loops (Shorts & Reels), and unsolicited recommendations on YouTube and Facebook, shifting your browsing experience to intentional, search-first exploration.

---

## 1. Architecture Overview

Focus Mode is built strictly on **Chrome Extension Manifest V3**, using minimal, least-privilege host permissions and zero external telemetry, tracking, or backend servers.

```
focus-mode/
├── manifest.json            # MV3 configuration & declarative permissions
├── icons/                   # 16px, 48px, 128px high-DPI focus target icons
├── background/
│   └── background.js        # Service Worker (badge management, pause alarms, storage defaults)
├── popup/
│   ├── popup.html           # Accessible settings dashboard
│   ├── popup.css            # Compact dark-themed styling
│   └── popup.js             # Real-time toggle synchronization & pause countdown
├── content/
│   ├── shared.js            # Core SPA history watcher, storage listener & attribute engine
│   ├── youtube.js           # YouTube route classifier, Shorts interceptor & Search-First UI
│   ├── youtube.css          # Zero-flicker declarative CSS hiding rules for YouTube
│   ├── facebook.js          # Facebook route classifier, suggested post scanner & UI hub
│   └── facebook.css         # Declarative CSS hiding rules for Facebook
├── test/
│   ├── unit/                # Automated unit tests (Node.js test runner)
│   │   ├── url-routing.test.js
│   │   ├── storage-settings.test.js
│   │   ├── dom-selectors.test.js
│   │   └── adapter-behavior.test.js
│   └── e2e/                 # Automated headless Chrome integration test
│       └── test-extension.js
├── README.md                # Installation, usage, and maintenance guide
└── TEST-REPORT.md           # Empirical verification log & acceptance evidence
```

---

## 2. Installation Instructions

1. Open Google Chrome.
2. In the URL address bar, enter:
   ```
   chrome://extensions
   ```
3. Look in the top right corner and enable **Developer mode** (toggle switch).
4. Click the **Load unpacked** button in the top left toolbar.
5. In the file picker dialog, navigate to the Focus Mode directory:
   ```
   C:\Users\ayoub\.gemini\antigravity\scratch\focus-mode
   ```
6. Click **Select Folder**.
7. The **Focus Mode - Intentional Browsing** card will appear in your extension list with its green reticle icon.
8. (Recommended) Click the Chrome puzzle piece icon on your browser toolbar and pin **Focus Mode** for quick access.

---

## 3. How to Configure & Use Focus Mode

Clicking the Focus Mode extension icon opens the compact settings popup:

### Global Controls
- **Global Master Switch (Top Right)**: Instantly turns off all filtering across all websites without uninstalling the extension.
- **Temporary Pause (15m / 30m / 1h)**: Need a quick break or need to inspect something? Click 15m, 30m, or 1h. Filtering is suspended, the icon badge shows `PAUS`, and a live countdown timer displays remaining time. Click **Resume Now** anytime to restore protection immediately.

### Per-Site Controls
Switch between the **YouTube** and **Facebook** tabs at the top to configure site-specific rules:

- **Site Master Switch**: Disable or enable Focus Mode for just YouTube or just Facebook.
- **Independent Toggles**:
  1. **Block Shorts & Reels**: Removes infinite scrolling vertical video trays, navigation bookmarks, and intercepts direct URLs.
  2. **Hide recommended feed**: Removes the homepage recommendation grid while preserving your search bar, channel pages, subscriptions, and normal video playback.
  3. **Hide suggested content**: Hides algorithmic suggestion shelves ("People also watched", "For you") and end-screen overlays.
  4. **Hide recommendation sidebar**: Hides the related video sidebar on YouTube watch pages. (Marked **Unsupported** on Facebook to prevent breaking navigation).
  5. **Search-first mode**: Replaces the empty feed on the Home page with an intentional search interface and focuses the search input.

---

## 4. Supported Sites & Feature Matrix

| Feature | YouTube Support Status | Facebook Support Status | Notes |
| :--- | :---: | :---: | :--- |
| **Block Shorts / Reels** | **FULL** | **FULL** | Hides shelves, cards, nav items; intercepts direct `/shorts/*` and `/reel/*` URLs with a focus search screen. |
| **Hide Recommended Feed** | **FULL** | **FULL** | Targets Home only. Preserves search, subscriptions, groups, pages, messages, and direct links. |
| **Hide Suggested Content** | **FULL** | **PARTIAL** | YouTube hides recommendation shelves and end-screens. Facebook relies on header markers ("Suggested for you", "Sponsored") in supported locales. |
| **Hide Recommendation Sidebar** | **FULL** | **UNSUPPORTED** | YouTube related videos sidebar is hidden on watch pages. Disabled on Facebook because Facebook sidebars house core navigation and messaging contacts. |
| **Search-First Mode** | **FULL** | **FULL** | Displays an intentional focus card with direct search and auto-focuses the search bar on Home. |

---

## 5. Non-Overblocking & Usability Safeguards

Focus Mode is engineered to prevent accidental collateral damage to productivity workflows:

- **Search Is Always Preserved**:
  - YouTube search queries (`/results?search_query=...`) and direct video watch pages (`/watch?v=...`) remain fully functional.
  - Facebook search (`/search/*`), Groups (`/groups/*`), Pages (`/pages/*`), and direct Messages (`/messages/*`) remain fully accessible.
- **No Video Player Tampering**: The HTML5 video player and playback controls on ordinary watch pages are never blocked or hidden.
- **Subscriptions & Channels Untouched**: You can browse channel pages (`/@creator`) and your subscribed feeds without interference.
- **Direct Shorts / Reels Conversion**: Direct Shorts links display a clear dialog with a **"Watch in Normal Player"** button that opens `/watch?v=:id`, allowing normal video playback without the addictive vertical swipe loop.

---

## 6. Troubleshooting & Debugging

- **Settings changes didn't apply?**
  Settings sync immediately via `chrome.storage.sync` and the shared DOM attribute manager. If you ever experience a stale page, click the reload button or toggle the extension Global switch off and on.
- **A YouTube or Facebook UI change bypassed a selector?**
  1. Right-click the element and select **Inspect**.
  2. Check if YouTube or Facebook altered the tag name or attribute (e.g. from `ytd-rich-grid-renderer` to a new custom element).
  3. Add the new selector to `content/youtube.css` or `content/facebook.css`.
  4. Reload the extension in `chrome://extensions` (click the reload circle).

---

## 7. Running Automated Tests

Run the test suite locally using Node.js (v20+ or v24+):

```bash
# Run unit & selector preservation tests (39 tests)
npm test

# Run live headless Chrome integration test via Chrome DevTools Protocol
npm run test:e2e
```
