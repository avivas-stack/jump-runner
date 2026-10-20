# Facto browser extension (v0.1, unpublished)

Right-click selected text on any page (including Facebook, Instagram, and X/Twitter) and
choose "בדוק את הטענה הזו ב-Facto" to open Facto with that text pre-filled, ready to check.
Right-click a link or an empty area of the page to check that page's URL instead. Clicking
the toolbar icon opens a small popup to paste a claim manually.

## How it works

No content scripts, no page access, no data collection. The entire extension is a context
menu + a popup, both of which just open `https://aminut-il.vercel.app/?text=...` or
`?url=...` in a new tab — the site itself does all the actual checking, exactly as if you'd
pasted the text in yourself. See `background.js` and `popup.js` for the full (short) code.

## Known limitation: images

Right-clicking an image isn't supported yet. Fetching an arbitrary image's bytes from a
background script runs into real obstacles (CORS, expiring/signed CDN URLs, lazy-loaded
elements common on Facebook/Instagram) that don't have a reliable fix without a lot more
engineering — so rather than ship something that silently fails half the time, this was cut
from v0.1. For now, saving the image and uploading it on the site directly still works.

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
