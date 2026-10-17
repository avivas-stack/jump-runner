import { ImageResponse } from "next/og";
import { join } from "node:path";
import { readFile } from "node:fs/promises";
import { getHeeboFont } from "@/lib/ogFont";
import { wrapVisualLines } from "@/lib/bidiVisualText";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const logoData = await readFile(join(process.cwd(), "public/logo.png"), "base64");
const logoSrc = `data:image/png;base64,${logoData}`;

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
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoSrc} width={80} height={80} />
          <div style={{ fontSize: 96, fontWeight: 700, color: "#1c1917" }}>Facto</div>
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
