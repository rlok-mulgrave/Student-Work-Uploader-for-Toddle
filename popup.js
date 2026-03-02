// Handle the "Run Now" button
document.getElementById('runBtn').addEventListener('click', () => {
  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    // Send message to content script to trigger manual run
    if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { action: "run_sequence" });
    }
  });
});