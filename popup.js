const btn = document.getElementById("btn");
const status = document.getElementById("status");

btn.addEventListener("click", () => {
  btn.disabled = true;
  status.className = "";
  status.textContent = "Capturing…";

  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    chrome.runtime.sendMessage({ action: "capture", tabId: tab.id }, response => {
      if (chrome.runtime.lastError || (response && response.error)) {
        status.className = "error";
        status.textContent = (response && response.error) || chrome.runtime.lastError.message;
      } else {
        status.className = "success";
        status.textContent = "Saved!";
      }
      btn.disabled = false;
    });
  });
});
