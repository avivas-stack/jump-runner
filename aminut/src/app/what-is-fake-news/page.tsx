import type { Metadata } from "next";
import { SITE_NAME } from "@/lib/siteConfig";
import { WhatIsFakeNewsContent } from "./WhatIsFakeNewsContent";

export const metadata: Metadata = {
  title: `מה זה פייק ניוז? — ${SITE_NAME}`,
  description:
    "הגדרות, למה פייק ניוז מצליח להתפשט, ההשפעות שלו, ומדריך בשמונה שלבים לבדוק ידיעה לפני שמאמינים או משתפים.",
};

export default function WhatIsFakeNewsPage() {
  return <WhatIsFakeNewsContent />;
}
