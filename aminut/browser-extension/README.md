# Facto browser extension (v0.2, unpublished)

Right-click selected text on any page (including Facebook, Instagram, and X/Twitter) and
choose "בדוק את הטענה הזו ב-Facto" to open Facto with that text pre-filled, ready to check.
Right-click a link or an empty area of the page to check that page's URL instead. Right-click
an image to check it too (see below). Clicking the toolbar icon opens a small popup to paste
a claim manually.

## How it works

Text, link, and page checks need no page access at all: the context menu and popup just
open `https://aminut-il.vercel.app/?text=...` or `?url=...` in a new tab — the site does the
actual checking, exactly as if you'd pasted the text in yourself.

Image checks work differently, since fetching an arbitrary image's bytes from a background
script is unreliable (CORS, expiring/signed CDN URLs, lazy-loaded elements — common on
Facebook/Instagram, and the reason this wasn't supported in v0.1). Instead: right-clicking
an image screenshots the visible tab (a screenshot has no CORS restriction, unlike a fetch)
and crops it to that image's on-screen position, found via a short on-demand script — not an
always-running one — triggered only by that click. The cropped image is handed to a small
script that runs *only on the Facto site itself* (never on any other page), which drops it
into the site's own upload field exactly as if you'd picked the file yourself — same
validation, same OCR pipeline, untouched.

This is why the extension now asks for two more permissions than v0.1: `activeTab` +
`scripting` (to capture and locate the image, only in the tab you just right-clicked in) and
a content script scoped to `aminut-il.vercel.app` alone (to receive it) — not blanket access
to read every page you visit.

**Known limitation:** this only finds actual `<img>` elements, not CSS background-images —
most feed images on Facebook/Instagram/X are `<img>` tags, but a page that renders an image
purely as a background won't be detected (saving and uploading it manually still works).

## Load it locally (Chrome / Edge / Brave)

1. Open `chrome://extensions` (or the equivalent for your browser).
2. Turn on "Developer mode" (top-right toggle).
3. Click "Load unpacked" and select this `browser-extension` folder.
4. Pin the Facto icon to your toolbar if you want quick access to the popup.

That's it — the context menu entries appear immediately on any page.

## Publishing to the Chrome Web Store (not done — needs you)

This is as far as an unpublished extension can go. To make it installable by anyone
without "Developer mode":

1. You need a Google Developer account for the Chrome Web Store (one-time $5 registration
   fee, your own Google account — not something that can be done on your behalf).
2. Zip this folder's contents and upload it at https://chrome.google.com/webstore/devconsole.
3. Google reviews new extensions before publishing (usually a few days, sometimes longer).
4. The same package (with a manifest tweak) can also be submitted to the Firefox Add-ons
   store and Edge Add-ons store if you want cross-browser reach later.

Worth doing once the core site is live and stable — not blocking for this week's launch.
