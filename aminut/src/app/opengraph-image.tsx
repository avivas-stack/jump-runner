import { ImageResponse } from "next/og";
import { getHeeboFont } from "@/lib/ogFont";
import { toVisualOrder, wrapVisualLines } from "@/lib/bidiVisualText";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const [regular, bold] = await Promise.all([getHeeboFont(400), getHeeboFont(700)]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#fafaf9",
          fontFamily: "Heebo",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 20,
            borderBottom: "4px solid #1c1917",
            paddingBottom: 28,
          }}
        >
          <div
            style={{
              width: 70,
              height: 70,
              borderRadius: "9999px",
              border: "5px solid #115e59",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: 28,
                height: 14,
                borderLeft: "6px solid #115e59",
                borderBottom: "6px solid #115e59",
                transform: "rotate(-45deg)",
                marginTop: -5,
              }}
            />
          </div>
          <div style={{ fontSize: 96, fontWeight: 700, color: "#1c1917" }}>{toVisualOrder("אמינות")}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 32 }}>
          {wrapVisualLines("בודקים טענות, כותרות ושמועות מול מקורות אמיתיים — לפני שמאמינים", 42).map((line, i) => (
            <div key={i} style={{ fontSize: 34, color: "#44403c" }}>
              {line}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size, fonts: [{ name: "Heebo", data: regular, weight: 400, style: "normal" }, { name: "Heebo", data: bold, weight: 700, style: "normal" }] }
  );
}
