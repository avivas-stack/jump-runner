// Facto browser extension — content script, runs only on the Facto site itself (see
// manifest.json's content_scripts.matches — never on any other page).
//
// Hands an image captured by the extension (background.js) to the site's own existing
// upload flow: builds a File from the stored base64 PNG, assigns it to the real
// <input type="file"> the ClaimForm already renders, and dispatches a "change" event —
// exactly what happens when a person picks a file themselves. This reuses the site's own
// validation, compression, and OCR pipeline untouched; the extension's only job is
// getting a File onto that input.

(function () {
  const PENDING_IMAGE_STORAGE_KEY = "factoPendingImage";
  const MARKER_PARAM = "fromExtensionImage";
  const INPUT_SELECTOR = "#facto-claim-image-input";
  const MAX_WAIT_MS = 8000;
  const POLL_INTERVAL_MS = 150;

  function run() {
    const params = new URLSearchParams(window.location.search);
    if (params.get(MARKER_PARAM) !== "1") return;

    chrome.storage.local.get(PENDING_IMAGE_STORAGE_KEY, (result) => {
      const pending = result[PENDING_IMAGE_STORAGE_KEY];
      chrome.storage.local.remove(PENDING_IMAGE_STORAGE_KEY);
      cleanUrl();
      if (!pending?.base64) return;
      waitForInputAndInject(pending);
    });
  }

  function cleanUrl() {
    const url = new URL(window.location.href);
    url.searchParams.delete(MARKER_PARAM);
    window.history.replaceState(null, "", url.pathname + url.search);
  }

  function waitForInputAndInject(pending, elapsed = 0) {
    const input = document.querySelector(INPUT_SELECTOR);
    if (input) {
      injectFile(input, pending);
      return;
    }
    if (elapsed >= MAX_WAIT_MS) {
      console.error("Facto extension: claim-image input never appeared — page layout may have changed.");
      return;
    }
    // The input only exists once Next.js hydrates and React mounts ClaimForm — document_start
    // runs long before that, so this has to poll rather than assume the element is there.
    setTimeout(() => waitForInputAndInject(pending, elapsed + POLL_INTERVAL_MS), POLL_INTERVAL_MS);
  }

  function injectFile(input, pending) {
    try {
      const file = base64ToFile(pending.base64, pending.mediaType || "image/png", "facto-extension-capture.png");
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      input.files = dataTransfer.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    } catch (err) {
      console.error("Facto extension: failed to inject captured image:", err);
    }
  }

  function base64ToFile(base64, mediaType, filename) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new File([bytes], filename, { type: mediaType });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }
})();
