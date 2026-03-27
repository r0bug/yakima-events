// Background service worker for YFEvents Page Capture

chrome.runtime.onMessage.addListener(function(message, sender) {
  if (message.type === 'updateBadge') {
    var count = message.count || 0;
    var tabId = sender.tab ? sender.tab.id : undefined;
    if (count > 0 && tabId) {
      chrome.action.setBadgeText({ text: String(count), tabId: tabId });
      chrome.action.setBadgeBackgroundColor({ color: '#b7410e', tabId: tabId });
    } else if (tabId) {
      chrome.action.setBadgeText({ text: '', tabId: tabId });
    }
  }
});
