import { callStructured } from "./anthropic";
import { config } from "./config";
import { VisualAiOpinion, VisualAiOpinionSchema } from "./types";

/**
 * Known, documented markers that generative-AI tools (including Google's SynthID
 * ecosystem) embed in a file's own metadata — C2PA "Content Credentials" manifests,
 * the IPTC DigitalSourceType field, and common generator/app names. This is a
 * substring scan over the raw file bytes, not a parsed/verified C2PA manifest or a
 * SynthID decode (Google does not publish a public API for the latter) — so a hit
 * here is a real, checkable fact about the file, while a miss proves nothing: any of
 * these markers can be stripped by re-saving, cropping, or screenshotting an image.
 */
const KNOWN_MARKERS: { pattern: RegExp; label: string }[] = [
  { pattern: /c2pa/i, label: "C2PA (Content Credentials)" },
  { pattern: /contentcredentials\.org/i, label: "Content Credentials" },
  { pattern: /SynthID/i, label: "SynthID" },
  { pattern: /trainedAlgorithmicMedia/i, label: "IPTC DigitalSourceType: תוכן שנוצר באלגוריתם" },
  { pattern: /compositeWithTrainedAlgorithmicMedia/i, label: "IPTC DigitalSourceType: הרכבה הכוללת AI" },
  { pattern: /Google\s*AI/i, label: "Google AI" },
  { pattern: /\bImagen\b/i, label: "Google Imagen" },
  { pattern: /\bGemini\b/i, label: "Google Gemini" },
  { pattern: /DALL[\s-]?E/i, label: "OpenAI DALL·E" },
  { pattern: /Midjourney/i, label: "Midjourney" },
  { pattern: /Adobe Firefly/i, label: "Adobe Firefly" },
  { pattern: /Stable Diffusion/i, label: "Stable Diffusion" },
];

export function scanForProvenanceMarkers(base64Data: string): string[] {
  const buffer = Buffer.from(base64Data, "base64");
  const text = buffer.toString("latin1");
  const found = new Set<string>();
  for (const { pattern, label } of KNOWN_MARKERS) {
    if (pattern.test(text)) found.add(label);
  }
  return Array.from(found);
}

const SYSTEM_PROMPT = `אתה נותן חוות דעת סגנונית זהירה האם תמונה נראית כאילו נוצרה, עובדה או הורכבה באופן מטעה — בין על ידי כלי AI ובין בעריכה/הרכבה ידנית — בהתבסס על ניתוח הגיוני של התמונה עצמה ועל הידע הכללי שלך על העולם. אינך פענוח סימני מים.

כללים קריטיים:
- אינך כלי פורנזי ואינך יכול לפענח סימני מים בלתי נראים כמו SynthID — אלה דורשים מפענח ייעודי של גוגל שאינו זמין כאן. חוות דעתך מבוססת על ניתוח הגיוני-חזותי של התוכן, כולל שימוש בידע הכללי שלך (מי מופיע בתמונה, מה ידוע עליו/עליה בפועל).

בדוק שתי קטגוריות סימנים, שתיהן קריטיות באותה מידה — אל תתמקד רק בפגמים פיקסליים ותתעלם מהיגיון התוכן:

(א) פגמים חזותיים טיפוסיים לתוכן שנוצר/עובד:
  - פנים או גופים "מושלמים" מדי, סימטריים או עגולים באופן לא טבעי; עור חלק/דמוי שעווה ללא מרקם טבעי, נקבוביות או אי-סדירות — מראה "תמונת סטוק AI" קלאסי.
  - ידיים, אצבעות, שיניים או אוזניים מעוותות, במספר שגוי, או בצורה אנטומית בלתי אפשרית.
  - טקסט מטושטש, מעוות או חסר משמעות בתוך התמונה (שלטים, כיתובים).
  - תאורה או צללים לא עקביים בין חלקי התמונה (לדוגמה: שתי דמויות בתמונה אחת עם כיוון תאורה/חדות/טמפרטורת צבע שונה זו מזו — סימן אופייני להרכבה של שתי תמונות נפרדות), רפלקציות שלא תואמות את הסביבה.
  - רקע מטושטש/גנרי בסגנון "בוקה" סטודיו שלא תואם את ההקשר, או רקע עם פרטים שחוזרים על עצמם באופן לא טבעי.
  - מרקם "חלק מדי" אופייני ל-AI (תאורה אחידה מדי, חוסר רעש/גרעיניות טבעיים של מצלמה אמיתית).

(ב) הגיון המצב המתואר, כולל זיהוי דמויות ציבוריות מוכרות:
  - אם אתה מזהה בתמונה אדם ציבורי מוכר (פוליטיקאי, מנהיג, ידוען) — שקול במפורש האם המצב המתואר (מי נמצא עם מי, היכן, באיזו קרבה פיזית) סביר בהתחשב בעובדות ידועות עליו/עליה (למשל: מעמד פוליטי, מצב מעצר/מוות/הסתתרות, יחסי עוינות מוצהרים בין הצדדים). תמונה שמציגה שני אנשים שלא ייתכן שנפגשו במציאות (כגון יריבים מוצהרים במפגש אישי שקט) היא לרוב הרכבה מטעה, גם אם כל פרט ויזואלי בפני עצמו נראה טבעי.
  - סצנה או אירוע שנראים פיזית בלתי אפשריים או בלתי סבירים באופן קיצוני גם בלי זיהוי אדם ספציפי.
  - כיתוב חדשותי, מסגרת "מהדורה"/"breaking news" או עיצוב גרפי של אתר חדשות מצורף לתמונה — שים לב אם התמונה עצמה (לא רק הכיתוב) נראית מורכבת מיותר ממקור צילום אחד.
- כל סימן קונקרטי שבאמת הבחנת בו בתמונה הזו — מכל אחת מהקטגוריות — ציין אותו בקצרה ב-visualSigns (בעברית), כולל אם מדובר בזיהוי דמות ציבורית ובסיבה שהמצב המתואר אינו סביר. זה חובה: כל סימן שאתה מזכיר או מרמז עליו ב-rationale (כולל נימוק הגיוני/עובדתי, לא רק פגם פיקסלי) חייב להופיע גם כפריט נפרד ב-visualSigns — אסור לנמק מסקנה ב-rationale בלי לפרט אותה שם. אל תמציא סימן שלא קיים בפועל, ואל תמציא שיוך של התמונה לאדם אמיתי אם אינך בטוח בזיהוי; אם לא זיהית שום סימן, החזר מערך ריק.
- קבע "yes" כשיש סימן קונקרטי אחד או יותר מכל אחת מהקטגוריות — בין אם זה פגם חזותי ובין אם זה חוסר סבירות הגיונית/עובדתית בוטה של המצב המתואר. אל תטען ודאות; אם הסימנים חלשים או מעורבים, החזר "unsure" ולא "yes" חד-משמעי.
- rationale קצר (1-3 משפטים), בעברית, ניטרלי, ללא שפה סנסציונית, ומתייחס לסימנים הקונקרטיים שצוינו (אם יש).`;

/**
 * Non-authoritative, best-effort visual impression from a vision-capable model —
 * deliberately separate from the metadata scan above and framed as an opinion, not
 * a verdict, so the two never get conflated into a false sense of certainty.
 */
export async function getVisualAiOpinion(
  base64Data: string,
  mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp"
): Promise<VisualAiOpinion> {
  return callStructured({
    // Deliberately the stronger "evaluation" tier, not the cheap extractionModel used
    // for plain text extraction: this call requires careful visual scrutiny plus
    // real-world knowledge (recognizing public figures, judging whether a depicted
    // situation is plausible) that a smaller model under-performs on.
    model: config.evaluationModel,
    system: SYSTEM_PROMPT,
    toolName: "visual_ai_opinion",
    maxTokens: 700,
    schema: VisualAiOpinionSchema,
    prompt: [
      { type: "image", source: { type: "base64", media_type: mediaType, data: base64Data } },
      {
        type: "text",
        text: "בחן את התמונה הזו בהיגיון: האם יש בה סימנים חזותיים קונקרטיים האופייניים לתוכן שנוצר על ידי AI (ראה רשימה בהנחיות)? ציין כל סימן שזיהית בפועל.",
      },
    ],
  });
}
