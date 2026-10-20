// Facto browser extension — background service worker.
//
// Scope note: this MVP only ever opens the Facto site with the claim pre-filled via a
// URL query param (?text=... or ?url=...) — it never reads page content, injects scripts,
// or talks to any API directly. That's why the manifest needs no host_permissions or
// activeTab/scripting permission: a context menu entry + chrome.tabs.create is enough.
// Right-clicking an *image* (e.g. a suspicious photo in a Facebook/Instagram post) isn't
// handled here — fetching arbitrary cross-origin image bytes from a background script is
// unreliable (CORS, signed/expiring CDN URLs, lazy-loaded elements), so that path was cut
// from v0.1 rather than shipped half-working. Pasting a screenshot into the site directly
// still works exactly as before.

const SITE_URL = "https://aminut-il.vercel.app";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "facto-check-selection",
    title: 'בדוק את הטענה "%s" ב-Facto',
    contexts: ["selection"],
  });
  chrome.contextMenus.create({
    id: "facto-check-link",
    title: "בדוק קישור זה ב-Facto",
    contexts: ["link"],
  });
  chrome.contextMenus.create({
    id: "facto-check-page",
    title: "בדוק עמוד זה ב-Facto",
    contexts: ["page"],
  });
});

chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId === "facto-check-selection" && info.selectionText) {
    openWithParam("text", info.selectionText);
  } else if (info.menuItemId === "facto-check-link" && info.linkUrl) {
    openWithParam("url", info.linkUrl);
  } else if (info.menuItemId === "facto-check-page" && info.pageUrl) {
    openWithParam("url", info.pageUrl);
  }
});

function openWithParam(key, value) {
  const url = new URL(SITE_URL);
  url.searchParams.set(key, value);
  chrome.tabs.create({ url: url.toString() });
}
