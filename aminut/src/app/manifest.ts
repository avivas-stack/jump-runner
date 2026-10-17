import type { MetadataRoute } from "next";
import { SITE_NAME } from "@/lib/siteConfig";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SITE_NAME} — בדיקת מהימנות חדשות`,
    short_name: SITE_NAME,
    description: "כלי לבדיקת טענות, כותרות ושמועות מול מקורות אמיתיים ברשת.",
    start_url: "/",
    display: "standalone",
    background_color: "#fafaf9",
    theme_color: "#0f766e",
    lang: "he",
    dir: "rtl",
    icons: [
      { src: "/icon.png", sizes: "32x32", type: "image/png" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
