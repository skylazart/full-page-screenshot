# Full Page Screenshot

A Chrome extension (Manifest V3) that captures a full-page screenshot of the current tab and saves it as a PNG to your Downloads folder.

## How it works

Clicking **Capture Page** triggers a scroll-and-stitch pipeline in the background service worker:

1. The page's full dimensions are read from the DOM (`scrollWidth` / `scrollHeight`).
2. The page is scrolled through in viewport-height steps.
3. Each strip is captured via the Chrome DevTools Protocol (`Page.captureScreenshot`).
4. Strips are composited onto an `OffscreenCanvas` at their correct CSS-pixel positions.
5. The finished canvas is exported as a PNG and saved via `chrome.downloads`.

The original scroll position is restored after capture. The debugger is always detached, even on error.

## Files

| File            | Purpose                          |
|-----------------|----------------------------------|
| `manifest.json` | Extension manifest (MV3)         |
| `background.js` | Service worker — capture logic   |
| `popup.html`    | Toolbar popup UI                 |
| `popup.js`      | Popup button and status handling |

## Permissions

| Permission  | Reason                                                         |
|-------------|----------------------------------------------------------------|
| `activeTab` | Read the active tab's URL and query its dimensions             |
| `debugger`  | Attach Chrome DevTools Protocol to drive scrolling and capture |
| `downloads` | Save the PNG to the Downloads folder                           |

## Installation

1. Open `chrome://extensions` in Chrome.
2. Enable **Developer mode** (toggle in the top-right corner).
3. Click **Load unpacked** and select this folder.
4. The extension icon appears in the toolbar.

## Usage

1. Navigate to any page you want to capture.
2. Click the extension icon and press **Capture Page**.
3. The popup shows **Capturing…** while the page is being processed.
4. On success it shows **Saved!** and the file `screenshot-YYYY-MM-DD_HH-MM-SS.png` appears in your Downloads folder.

## Limitations

- Does not work on `chrome://` pages, the Chrome Web Store, or other extension pages — the DevTools Protocol cannot attach to those tabs.
- Elements with `position: fixed` or `position: sticky` (e.g. sticky navigation bars) will appear repeated in the final image once per captured strip.
- Very tall pages (beyond the browser's maximum canvas size) may fail to stitch.
