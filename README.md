# FocusTube (youtube-shorts-blocker)

A Chrome extension (**Manifest V3**) that **blocks YouTube Shorts** (URLs, side nav, home/search shelves, and recommendation cards) while leaving normal YouTube (home, search, long-form video, channels, playlists, comments, subs, Watch Later) available.

**Repository name:** `youtube-shorts-blocker` — publish to your own Git host / organization as needed.

## Features

- **URL redirect:** Visiting `/shorts/…` resolves to a normal `watch` URL when a video id is present, or to the YouTube home when not.
- **UI hiding:** Hides the Shorts item in the guide, mini guide, and mobile bar where possible (CSS + JS, best effort against moving DOMs).
- **Shelves and cards:** Hides reel/Shorts shelves and grid cards that point at `/shorts/…`.
- **Settings:** On/off and a **“Blocked Shorts today”** counter, stored in `chrome.storage.local` with automatic **daily reset** (by local date).
- **SPA-aware:** `MutationObserver` (debounced) + lightweight URL polling for YouTube’s client-side navigation.
- **Performance:** Debounced work, reuses a single `MutationObserver`, avoids debug logging by default.

## Project layout

```
youtube-shorts-blocker/
│── manifest.json
│── background.js
│── content.js
│── popup.html
│── popup.js
│── popup.css
│── styles.css
│── utils.js
│── icons/
│    icon16.png
│    icon32.png
│    icon48.png
│    icon128.png
│── README.md
```

## Load unpacked (developer mode)

1. Open Chrome and go to `chrome://extensions`.
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked** and select the `youtube-shorts-blocker` folder (this repo’s root with `manifest.json` in it).
4. Open [https://www.youtube.com](https://www.youtube.com) in a new tab. Use the extension icon to toggle FocusTube.

**Permissions in this build**

- `storage` — keep settings and the daily block counter.
- `host_permissions`: `https://www.youtube.com/*` — so the content script and CSS can run on YouTube only.

`activeTab` and `scripting` are not required for the current design.

## Icons

Placeholder PNGs are included so the package loads in Chrome. Replace the files in `icons/` with your own **16, 32, 48, and 128** px assets for production branding.

## Privacy

Settings and the daily counter are stored **locally** in the browser. No data is sent to a server as part of this code.
