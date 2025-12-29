/**
 * ByteLetters Background Service Worker
 * Handles extension icon clicks
 */

// When user clicks the extension icon in toolbar
chrome.action.onClicked.addListener(async (tab) => {
  // Open a new tab with ByteLetters (the new tab page)
  await chrome.tabs.create({ url: 'chrome://newtab' });
});

// Set badge to indicate extension is active (optional)
chrome.runtime.onInstalled.addListener(() => {
  console.log('ByteLetters installed/updated');
});
