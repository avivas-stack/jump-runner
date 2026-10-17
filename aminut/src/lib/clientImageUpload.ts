"use client";

export const MAX_CLIENT_IMAGE_BYTES = 5_000_000;

/** An error whose message is our own clear Hebrew text, safe to show the user as-is. */
export class KnownError extends Error {}

export function fileToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.onerror = () => reject(reader.error ?? new Error("קריאת הקובץ נכשלה"));
    reader.readAsDataURL(blob);
  });
}

function loadImageElement(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new KnownError("לא ניתן היה לפתוח את התמונה בדפדפן. נסו תמונה אחרת."));
    };
    img.src = objectUrl;
  });
}

function downscaleToJpeg(img: HTMLImageElement, maxDimension: number, quality: number): Promise<Blob> {
  const scale = Math.min(1, maxDimension / Math.max(img.naturalWidth, img.naturalHeight));
  const width = Math.max(1, Math.round(img.naturalWidth * scale));
  const height = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return Promise.reject(new KnownError("לא ניתן היה לעבד את התמונה בדפדפן זה. נסו תמונה קטנה יותר."));
  }
  ctx.drawImage(img, 0, 0, width, height);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new KnownError("לא ניתן היה לדחוס את התמונה. נסו תמונה אחרת."))),
      "image/jpeg",
      quality
    );
  });
}

/**
 * Shrinks an over-the-limit image until it fits, instead of just refusing it — phones
 * routinely produce photos/screenshots over 5MB, especially when shared in from another
 * app. Tries progressively smaller dimensions/quality; gives up with a clear message
 * only if even the smallest attempt still doesn't fit.
 *
 * Trade-off: re-encoding through canvas strips any original file metadata.
 */
export async function compressImageUntilUnderLimit(file: File, maxBytes: number = MAX_CLIENT_IMAGE_BYTES): Promise<Blob> {
  const img = await loadImageElement(file);
  const attempts: [number, number][] = [
    [1600, 0.85],
    [1200, 0.75],
    [900, 0.65],
  ];
  let lastBlob: Blob | null = null;
  for (const [maxDimension, quality] of attempts) {
    lastBlob = await downscaleToJpeg(img, maxDimension, quality);
    if (lastBlob.size <= maxBytes) return lastBlob;
  }
  throw new KnownError(
    `התמונה גדולה מדי גם אחרי דחיסה (מגבלה: ${Math.floor(maxBytes / 1_000_000)}MB). נסו תמונה קטנה יותר או צילום מסך ממוקד יותר.`
  );
}
