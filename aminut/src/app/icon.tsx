import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

// Drawn with CSS borders, not a "✓" glyph — Satori's default font has no guaranteed
// checkmark glyph, so a text-based check mark can silently render as an empty box.
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#fafaf9",
          borderRadius: "9999px",
          border: "2px solid #115e59",
        }}
      >
        <div
          style={{
            width: 12,
            height: 6,
            borderLeft: "3px solid #115e59",
            borderBottom: "3px solid #115e59",
            transform: "rotate(-45deg)",
            marginTop: -2,
          }}
        />
      </div>
    ),
    { ...size }
  );
}
