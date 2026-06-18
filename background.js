chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "capture") {
    captureFullPage(message.tabId).then(sendResponse).catch(err => sendResponse({ error: err.message }));
    return true;
  }
});

async function captureFullPage(tabId) {
  const target = { tabId };
  await chrome.debugger.attach(target, "1.3");

  try {
    // Get full page dimensions and current scroll position
    const { result: { value: dims } } = await chrome.debugger.sendCommand(target, "Runtime.evaluate", {
      expression: `({
        pageW: Math.max(document.body.scrollWidth,  document.documentElement.scrollWidth),
        pageH: Math.max(document.body.scrollHeight, document.documentElement.scrollHeight),
        scrollX: window.scrollX,
        scrollY: window.scrollY
      })`,
      returnByValue: true,
    });
    const { pageW, pageH, scrollX, scrollY } = dims;

    // Expand the viewport to the full page dimensions so all content is rendered,
    // then capture in one shot — no scrolling, no stitching, no artifacts.
    // deviceScaleFactor: 1 gives logical-pixel output (avoids DPR scaling issues
    // and keeps file size predictable).
    await chrome.debugger.sendCommand(target, "Emulation.setDeviceMetricsOverride", {
      width: pageW,
      height: pageH,
      deviceScaleFactor: 1,
      mobile: false,
    });

    // Brief pause for reflow / lazy-loaded content triggered by the resize
    await new Promise(r => setTimeout(r, 400));

    const { data } = await chrome.debugger.sendCommand(target, "Page.captureScreenshot", {
      format: "webp",
      quality: 90,
      captureBeyondViewport: true,
      fromSurface: true,
    });

    // Restore original viewport and scroll position
    await chrome.debugger.sendCommand(target, "Emulation.clearDeviceMetricsOverride");
    await chrome.debugger.sendCommand(target, "Runtime.evaluate", {
      expression: `window.scrollTo(${scrollX}, ${scrollY})`,
      returnByValue: false,
    });

    const bytes  = Uint8Array.from(atob(data), c => c.charCodeAt(0));
    const blob   = new Blob([bytes], { type: "image/webp" });
    const dataUrl = await blobToDataUrl(blob, "image/webp");

    const filename = "screenshot-" + formatDate(new Date()) + ".webp";
    await chrome.downloads.download({ url: dataUrl, filename, saveAs: false });

    return { ok: true };
  } finally {
    await chrome.debugger.sendCommand(target, "Emulation.clearDeviceMetricsOverride").catch(() => {});
    await chrome.debugger.detach(target).catch(() => {});
  }
}

async function blobToDataUrl(blob, mimeType = "image/webp") {
  const ab    = await blob.arrayBuffer();
  const bytes = new Uint8Array(ab);
  let binary  = "";
  const chunk = 8192;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return `data:${mimeType};base64,` + btoa(binary);
}

function formatDate(d) {
  const pad = n => String(n).padStart(2, "0");
  return (
    d.getFullYear() +
    "-" + pad(d.getMonth() + 1) +
    "-" + pad(d.getDate()) +
    "_" + pad(d.getHours()) +
    "-" + pad(d.getMinutes()) +
    "-" + pad(d.getSeconds())
  );
}
