import { ImageResponse } from "next/og";
import { getReportById } from "@/lib/reportStore";
import { getHeeboFont } from "@/lib/ogFont";
import { toVisualOrder, wrapVisualLines } from "@/lib/bidiVisualText";
import type { Classification } from "@/lib/types";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const CLASSIFICATION_COLOR: Record<Classification, string> = {
  מאומת: "#047857",
  שקרי: "#be123c",
  מטעה: "#b45309",
  "חסר הקשר": "#c2410c",
  "לא ניתן לאימות": "#78716c",
  'ככה"נ שקרי': "#c2410c",
  "שנוי במחלוקת": "#6d28d9",
  מיושן: "#0369a1",
  "דעה, תחזית או סאטירה": "#78716c",
};

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [report, regular, bold] = await Promise.all([getReportById(id), getHeeboFont(400), getHeeboFont(700)]);

  const singleClaim = report && report.claims.length === 1 ? report.claims[0] : null;
  const singleEvaluation = singleClaim ? report!.evaluations.find((e) => e.claimId === singleClaim.id) : null;
  const headline = singleClaim ? truncate(singleClaim.originalText, 160) : truncate(report?.overallAssessment ?? "", 160);
  const accentColor = singleEvaluation ? CLASSIFICATION_COLOR[singleEvaluation.classification] : "#115e59";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#fafaf9",
          fontFamily: "Heebo",
          padding: 64,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: "9999px",
              border: "3px solid #115e59",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: 18,
                height: 9,
                borderLeft: "4px solid #115e59",
                borderBottom: "4px solid #115e59",
                transform: "rotate(-45deg)",
                marginTop: -3,
              }}
            />
          </div>
          <div style={{ fontSize: 40, fontWeight: 700, color: "#1c1917" }}>{toVisualOrder("אמינות")}</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          {singleEvaluation && (
            <div
              style={{
                display: "flex",
                alignSelf: "flex-start",
                borderRight: `8px solid ${accentColor}`,
                color: accentColor,
                fontSize: 32,
                fontWeight: 700,
                padding: "8px 20px",
                background: "rgba(0,0,0,0.02)",
              }}
            >
              {toVisualOrder(singleEvaluation.classification)}
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column" }}>
            {wrapVisualLines(headline || "דוח בדיקת מהימנות", 42).map((line, i) => (
              <div key={i} style={{ fontSize: 44, fontWeight: 700, color: "#1c1917", lineHeight: 1.35 }}>
                {line}
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", fontSize: 26, color: "#78716c" }}>
          {toVisualOrder("בדיקת מהימנות מבוססת מקורות — אמינות")}
        </div>
      </div>
    ),
    { ...size, fonts: [{ name: "Heebo", data: regular, weight: 400, style: "normal" }, { name: "Heebo", data: bold, weight: 700, style: "normal" }] }
  );
}
