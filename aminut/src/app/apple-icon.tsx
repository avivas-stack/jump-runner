import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
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
        }}
      >
        <div
          style={{
            width: 130,
            height: 130,
            borderRadius: "9999px",
            border: "8px solid #115e59",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: 56,
              height: 28,
              borderLeft: "14px solid #115e59",
              borderBottom: "14px solid #115e59",
              transform: "rotate(-45deg)",
              marginTop: -10,
            }}
          />
        </div>
      </div>
    ),
    { ...size }
  );
}
