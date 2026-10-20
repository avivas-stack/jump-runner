import type { Metadata } from "next";
import { SITE_NAME } from "@/lib/siteConfig";
import { PrivacyContent } from "./PrivacyContent";

export const metadata: Metadata = {
  title: `מדיניות פרטיות ותנאי שימוש — ${SITE_NAME}`,
  description: `כיצד ${SITE_NAME} אוסף ומעבד מידע, אילו שירותי צד שלישי מעורבים, ומהם תנאי השימוש בכלי.`,
};

export default function PrivacyPage() {
  return <PrivacyContent />;
}
