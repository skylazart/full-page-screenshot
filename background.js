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
    const { result: { value: dims } } = await chrome.debugger.sendCommand(target, "Runtime.evaluate", {
      expression: `({
        pageW: Math.max(document.body.scrollWidth,  document.documentElement.scrollWidth),
        pageH: Math.max(document.body.scrollHeight, document.documentElement.scrollHeight),
        viewW: window.innerWidth,
        viewH: window.innerHeight,
        scrollX: window.scrollX,
        scrollY: window.scrollY
      })`,
      returnByValue: true,
    });
    const { pageW, pageH, viewW, viewH, scrollX, scrollY } = dims;

    const canvas = new OffscreenCanvas(pageW, pageH);
    const ctx    = canvas.getContext("2d");

    for (let y = 0; y < pageH; y += viewH) {
      await chrome.debugger.sendCommand(target, "Runtime.evaluate", {
        expression: `window.scrollTo(0, ${y})`,
        returnByValue: false,
      });
      await new Promise(r => setTimeout(r, 200));

      // Read actual Y after browser clamping at the bottom
      const { result: { value: actualY } } = await chrome.debugger.sendCommand(target, "Runtime.evaluate", {
        expression: "window.scrollY",
        returnByValue: true,
      });

      const { data } = await chrome.debugger.sendCommand(target, "Page.captureScreenshot", {
        format: "png",
        fromSurface: true,
      });

      const bytes  = Uint8Array.from(atob(data), c => c.charCodeAt(0));
      const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
      ctx.drawImage(bitmap, 0, Math.round(actualY), viewW, viewH);
      bitmap.close();
    }

    // Restore original scroll position
    await chrome.debugger.sendCommand(target, "Runtime.evaluate", {
      expression: `window.scrollTo(${scrollX}, ${scrollY})`,
      returnByValue: false,
    });

    const finalBlob = await canvas.convertToBlob({ type: "image/png" });
    const dataUrl   = await blobToDataUrl(finalBlob);

    const filename = "screenshot-" + formatDate(new Date()) + ".png";
    await chrome.downloads.download({ url: dataUrl, filename, saveAs: false });

    return { ok: true };
  } finally {
    await chrome.debugger.detach(target).catch(() => {});
  }
}

async function blobToDataUrl(blob) {
  const ab    = await blob.arrayBuffer();
  const bytes = new Uint8Array(ab);
  let binary  = "";
  const chunk = 8192;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return "data:image/png;base64," + btoa(binary);
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
