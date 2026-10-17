// next/og's ImageResponse (Satori) has no built-in Hebrew glyph support — without an
// explicit font, Hebrew text renders as empty boxes. Google Fonts' CSS2 endpoint
// normally serves WOFF2 (which Satori can't parse); spoofing an old Chrome User-Agent
// makes it serve a legacy TTF instead, a well-known, widely used trick for this exact
// next/og limitation. Broad static charset (not the exact rendered text) so every OG
// image reuses the same cached font bytes instead of re-fetching a new subset per claim.
const HEBREW_LATIN_CHARSET =
  "אבגדהוזחטיכלמנסעפצקרשתךםןףץ" + "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz" + "0123456789 .,:;!?%\"'()-–—״׳";

const OLD_CHROME_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/42.0.2311.135 Safari/537.36";

const fontCache = new Map<string, Promise<ArrayBuffer>>();

async function fetchGoogleFontTtf(family: string, weight: number): Promise<ArrayBuffer> {
  const cssUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}&text=${encodeURIComponent(HEBREW_LATIN_CHARSET)}`;
  const cssRes = await fetch(cssUrl, { headers: { "User-Agent": OLD_CHROME_USER_AGENT } });
  if (!cssRes.ok) throw new Error(`Google Fonts CSS request failed (${cssRes.status})`);
  const css = await cssRes.text();
  const match = css.match(/src: url\(([^)]+)\)/);
  if (!match) throw new Error("Could not find a font file URL in the Google Fonts CSS response");
  const fontRes = await fetch(match[1]);
  if (!fontRes.ok) throw new Error(`Font file request failed (${fontRes.status})`);
  return fontRes.arrayBuffer();
}

/** Fetches (and caches for the lifetime of this server instance) a Heebo weight as TTF bytes. */
export function getHeeboFont(weight: 400 | 700 | 900): Promise<ArrayBuffer> {
  const key = `Heebo-${weight}`;
  let cached = fontCache.get(key);
  if (!cached) {
    cached = fetchGoogleFontTtf("Heebo", weight);
    fontCache.set(key, cached);
  }
  return cached;
}
