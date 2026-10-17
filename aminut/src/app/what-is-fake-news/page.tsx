import type { Metadata } from "next";
import Link from "next/link";
import { SITE_NAME } from "@/lib/siteConfig";

export const metadata: Metadata = {
  title: `מה זה פייק ניוז? — ${SITE_NAME}`,
  description:
    "הגדרות, למה פייק ניוז מצליח להתפשט, ההשפעות שלו, ומדריך בשמונה שלבים לבדוק ידיעה לפני שמאמינים או משתפים.",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="font-serif text-lg font-bold text-stone-900">{title}</h2>
      <div className="space-y-2 text-sm leading-relaxed text-stone-700">{children}</div>
    </section>
  );
}

const TERMS = [
  { term: "פייק ניוז", def: "תוכן מפוברק המוצג כידיעה חדשותית." },
  { term: "מידע שגוי (Misinformation)", def: "מידע לא נכון שמופץ לעיתים בלי כוונת הטעיה." },
  { term: "דיסאינפורמציה (Disinformation)", def: "מידע שגוי המופץ במכוון כדי להטעות." },
  { term: "מלאינפורמציה (Malinformation)", def: "מידע אמיתי המוצג מחוץ להקשר או במטרה לפגוע." },
  { term: "תעמולה", def: "תוכן המיועד לעצב עמדות או התנהגות, גם אם חלק מהעובדות בו נכון." },
  { term: "סאטירה", def: "תוכן הומוריסטי שאינו מיועד להיקרא כחדשות אמיתיות, אך עלול להיות מועבר בלי ההקשר." },
  { term: "Clickbait", def: "כותרת מוגזמת שמטרתה למשוך קליקים, גם אם התוכן עצמו אינו שקרי." },
];

const WHY_IT_WORKS = [
  "רשתות חברתיות מאפשרות הפצה מהירה של תוכן דרך שיתופים, קבוצות וואטסאפ ואלגוריתמים שמעדיפים מעורבות.",
  "כותרות רגשיות, פחד, זעם, זיהוי קבוצתי ואישור דעות קיימות מגדילים את הסיכוי לשיתוף.",
  "לעיתים המפיצים פועלים ממניע כספי: תנועה לאתרים, פרסום ומכירות.",
  "במקרים אחרים המטרה היא השפעה פוליטית, פגיעה ביריבים, הסתה, פגיעה במוניטין או יצירת בלבול.",
  "מחקרים מצביעים גם על פער בין הביטחון העצמי של אנשים ביכולתם לזהות מידע כוזב לבין יכולתם האמיתית.",
];

const EFFECTS = [
  "פגיעה באמון הציבור בתקשורת, במדע, במוסדות ובמערכת הפוליטית.",
  "השפעה על דעת קהל ועל התנהגות בוחרים, במיוחד בתקופות בחירות ומשבר.",
  "הפצת מידע רפואי שגוי, שעלול לגרום לאנשים להימנע מטיפול או לנקוט באמצעים מסוכנים.",
  "פגיעה באנשים פרטיים, בעסקים ובקהילות באמצעות האשמות כוזבות.",
  "תרומה לקיטוב, לשנאה ולתיאוריות קונספירציה.",
  "במקרים קיצוניים — מעבר מהפצת שקר לפעולה אלימה בעולם הממשי.",
];

const CHECK_STEPS = [
  "עצרו לפני שיתוף. רגש חזק הוא סימן לבדיקה נוספת, לא להכרעה.",
  "קראו את כל הכתבה, לא רק את הכותרת.",
  "זהו את המקור: מי פרסם, מה הסמכות שלו, מה האינטרס שלו והאם יש פרטי קשר.",
  "חפשו את המקור הראשוני: הודעה רשמית, מחקר, מסמך, ראיון מלא או תיעוד מקורי.",
  "הצליבו לפחות בשני מקורות עצמאיים ואמינים.",
  "בדקו תאריך, מקום, תמונות וסרטונים. תוכן ישן עשוי להיות מוצג כאירוע חדש.",
  "בדקו אם יש הקשר חסר: נתון נכון יכול להטעות כשהוא מוצג בלי הסבר.",
  "הגיעו למסקנה מדודה: נכון, שגוי, מטעה, מחוץ להקשר, סאטירה או טרם אומת.",
];

const WARNING_SIGNS = [
  "כותרת דרמטית במיוחד או \"חשיפה מטלטלת\" בלי ראיות.",
  "אין שם כותב, תאריך או גוף מזוהה.",
  "המקור הוא \"חבר ותיק\", \"מקור בכיר\" או \"אנשים אומרים\" בלבד.",
  "אין קישור למסמך, למחקר או להודעה המקורית.",
  "התמונה או הסרטון אינם מתוארכים או אינם ממוקמים.",
  "הטענה מיוחסת לאדם או לגוף, אך אין אישור בעמוד הרשמי שלו.",
  "הטקסט מבקש לשתף מיד לפני ש\"ימחקו\" אותו.",
  "הפרסום מבקש פרטים אישיים, תשלום או לחיצה על קישור חשוד.",
];

export default function WhatIsFakeNewsPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:py-12">
      <header className="mb-8 border-b-2 border-stone-900 pb-6 text-center">
        <Link href="/" className="inline-flex items-center gap-2 font-serif text-3xl font-bold text-stone-900 sm:text-4xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" aria-hidden className="h-7 w-7 sm:h-8 sm:w-8" />
          {SITE_NAME}
        </Link>
        <h1 className="mt-2 text-lg font-semibold text-stone-700">מה זה פייק ניוז?</h1>
      </header>

      <div className="space-y-8 rounded-lg border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
        <Section title="הגדרות ומושגי יסוד">
          <ul className="list-inside list-disc space-y-1.5">
            {TERMS.map(({ term, def }) => (
              <li key={term}>
                <span className="font-medium text-stone-900">{term}:</span> {def}
              </li>
            ))}
          </ul>
        </Section>

        <Section title="מדוע פייק ניוז מצליח?">
          <ul className="list-inside list-disc space-y-1.5">
            {WHY_IT_WORKS.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </Section>

        <Section title="השפעות התופעה">
          <ul className="list-inside list-disc space-y-1.5">
            {EFFECTS.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </Section>

        <Section title="כיצד לבדוק ידיעה? מדריך בשמונה שלבים">
          <ol className="list-inside list-decimal space-y-1.5">
            {CHECK_STEPS.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </Section>

        <Section title="רשימת סימני אזהרה">
          <ul className="list-inside list-disc space-y-1.5">
            {WARNING_SIGNS.map((sign) => (
              <li key={sign}>{sign}</li>
            ))}
          </ul>
        </Section>

        <Section title="לסיכום">
          <p>
            פייק ניוז אינו רק בעיה טכנולוגית, אלא בעיה חברתית, פסיכולוגית, תקשורתית ופוליטית. הכלי החשוב
            ביותר הוא לא ״לזהות פייק״ במבט ראשון, אלא לפתח הרגל של בדיקה, הצלבה ושמירה על ספקנות בריאה.
            הגנה טובה מורכבת מחשיבה ביקורתית, מקורות אמינים, כלי אימות ואחריות אישית לפני שיתוף.
          </p>
          <p>
            זו בדיוק הסיבה ש-{SITE_NAME} קיים —{" "}
            <Link href="/" className="font-medium text-teal-700 underline">
              אפשר להדביק טענה או קישור ולבדוק אותה תוך דקה
            </Link>
            , במקום לנחש.
          </p>
        </Section>
      </div>

      <p className="mt-6 text-center text-sm">
        <Link href="/" className="font-medium text-teal-700 underline">
          חזרה לדף הבית
        </Link>
      </p>
    </main>
  );
}
