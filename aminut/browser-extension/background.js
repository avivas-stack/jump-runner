// Facto browser extension — background service worker.
//
// Text/link checking: opens the Facto site with the claim pre-filled via a URL query
// param (?text=... or ?url=...) — no page access needed for that at all.
//
// Image checking works differently, on purpose: fetching an arbitrary cross-origin
// image's bytes from a background script is unreliable (CORS, signed/expiring CDN URLs,
// lazy-loaded elements) — most Facebook/Instagram CDN images would simply fail. Instead,
// this screenshots the visible tab (chrome.tabs.captureVisibleTab, which has no CORS
// restriction since it's a screenshot of what's already rendered, not a network fetch)
// and crops it to the right-clicked image's on-screen position. That position is found
// with an on-demand injected script (chrome.scripting.executeScript, authorized by the
// context-menu click itself via the "activeTab" permission) rather than an always-on
// content script — so the extension never reads anything on pages you haven't just
// right-clicked on.

const SITE_URL = "https://aminut-il.vercel.app";
const PENDING_IMAGE_STORAGE_KEY = "factoPendingImage";

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
  chrome.contextMenus.create({
    id: "facto-check-image",
    title: "בדוק תמונה זו ב-Facto",
    contexts: ["image"],
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "facto-check-selection" && info.selectionText) {
    openWithParam("text", info.selectionText);
  } else if (info.menuItemId === "facto-check-link" && info.linkUrl) {
    openWithParam("url", info.linkUrl);
  } else if (info.menuItemId === "facto-check-page" && info.pageUrl) {
    openWithParam("url", info.pageUrl);
  } else if (info.menuItemId === "facto-check-image" && info.srcUrl && tab?.id != null) {
    handleCheckImage(info, tab.id).catch((err) => {
      // Best-effort only: fall back to just opening the site rather than leaving the
      // click looking like it did nothing.
      console.error("Facto: image capture failed, opening site without it:", err);
      chrome.tabs.create({ url: SITE_URL });
    });
  }
});

function openWithParam(key, value) {
  const url = new URL(SITE_URL);
  url.searchParams.set(key, value);
  chrome.tabs.create({ url: url.toString() });
}

/**
 * Finds the on-screen position of the <img> the user right-clicked, by matching its
 * src/currentSrc against the URL the context menu gave us — there's no direct DOM
 * reference available from a contextMenus click, only this injected-script workaround.
 * Runs in the page's own context via chrome.scripting.executeScript (isolated world).
 */
function findImageRectInPage(srcUrl) {
  const images = Array.from(document.images);
  const match =
    images.find((img) => img.currentSrc === srcUrl) ?? images.find((img) => img.src === srcUrl);
  if (!match) return null;
  const rect = match.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
    devicePixelRatio: window.devicePixelRatio || 1,
  };
}

async function handleCheckImage(info, tabId) {
  const [injection] = await chrome.scripting.executeScript({
    target: { tabId },
    func: findImageRectInPage,
    args: [info.srcUrl],
  });
  const rect = injection?.result;

  const screenshotDataUrl = await chrome.tabs.captureVisibleTab(undefined, { format: "png" });

  const croppedBase64 = rect
    ? await cropScreenshot(screenshotDataUrl, rect)
    : dataUrlToBase64(screenshotDataUrl); // Couldn't locate the exact element — fall back to the full visible tab rather than failing outright.

  await chrome.storage.local.set({
    [PENDING_IMAGE_STORAGE_KEY]: { base64: croppedBase64, mediaType: "image/png", createdAt: Date.now() },
  });

  const url = new URL(SITE_URL);
  url.searchParams.set("fromExtensionImage", "1");
  chrome.tabs.create({ url: url.toString() });
}

function dataUrlToBase64(dataUrl) {
  return dataUrl.slice(dataUrl.indexOf(",") + 1);
}

async function cropScreenshot(screenshotDataUrl, rect) {
  const response = await fetch(screenshotDataUrl);
  const blob = await response.blob();
  const bitmap = await createImageBitmap(blob);

  // captureVisibleTab returns the screenshot at device-pixel resolution, while the
  // injected script measured the element in CSS pixels — scale to match, and clamp to
  // the actual bitmap bounds since a fractional zoom level could otherwise push the crop
  // rectangle a pixel or two past the edge.
  const scale = rect.devicePixelRatio;
  const cropX = Math.max(0, Math.round(rect.left * scale));
  const cropY = Math.max(0, Math.round(rect.top * scale));
  const cropWidth = Math.min(Math.round(rect.width * scale), bitmap.width - cropX);
  const cropHeight = Math.min(Math.round(rect.height * scale), bitmap.height - cropY);

  const canvas = new OffscreenCanvas(Math.max(1, cropWidth), Math.max(1, cropHeight));
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bitmap, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
  const croppedBlob = await canvas.convertToBlob({ type: "image/png" });

  const buffer = await croppedBlob.arrayBuffer();
  return arrayBufferToBase64(buffer);
}

function arrayBufferToBase64(buffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}
