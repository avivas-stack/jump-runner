import type { Metadata } from "next";
import Link from "next/link";
import { SITE_NAME } from "@/lib/siteConfig";

export const metadata: Metadata = {
  title: `מדיניות פרטיות ותנאי שימוש — ${SITE_NAME}`,
  description: `כיצד ${SITE_NAME} אוסף ומעבד מידע, אילו שירותי צד שלישי מעורבים, ומהם תנאי השימוש בכלי.`,
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="font-serif text-lg font-bold text-stone-900">{title}</h2>
      <div className="space-y-2 text-sm leading-relaxed text-stone-700">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:py-12">
      <header className="mb-8 border-b-2 border-stone-900 pb-6 text-center">
        <Link href="/" className="inline-flex items-center gap-2 font-serif text-3xl font-bold text-stone-900 sm:text-4xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" aria-hidden className="h-7 w-7 sm:h-8 sm:w-8" />
          {SITE_NAME}
        </Link>
        <h1 className="mt-2 text-lg font-semibold text-stone-700">מדיניות פרטיות ותנאי שימוש</h1>
        <p className="mt-1 text-xs text-stone-400">עדכון אחרון: אוקטובר 2026</p>
      </header>

      <div className="space-y-8 rounded-lg border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
        <Section title="מה הכלי הזה">
          <p>
            {SITE_NAME} הוא כלי לבדיקת מהימנות של טענות, כותרות, שמועות ותמונות, המיועד לסייע לחשיבה
            ביקורתית. הוא אינו גוף עיתונאי, משפטי או רשמי, ואינו תחליף לבדיקה מקצועית, משפטית, רפואית
            או עיתונאית. התוצאות מופקות באמצעות מודלים של בינה מלאכותית וחיפוש אוטומטי במקורות ברשת,
            ועלולות לכלול טעויות.
          </p>
        </Section>

        <Section title="אילו נתונים נאספים">
          <ul className="list-inside list-disc space-y-1">
            <li>טקסט, כותרת, ציטוט או קישור שאתם מדביקים לבדיקה.</li>
            <li>
              תמונה שאתם מעלים (לזיהוי טקסט מתוכה, או לבדיקת סימני יצירה על ידי AI) — התמונה נשלחת
              לעיבוד חד-פעמי ואינה נשמרת באתר או במסד הנתונים שלנו.
            </li>
            <li>
              כתובת IP, לצורך הגבלת קצב שימוש בלבד (מניעת עומס/ניצול לרעה של הכלי) — אינה נשמרת
              לטווח ארוך ואינה משויכת לדוחות שנשמרים.
            </li>
          </ul>
          <p>
            הכלי אינו דורש הרשמה, חשבון משתמש או סיסמה, ואינו אוסף שם, אימייל או פרטי תשלום. היסטוריית
            הבדיקות שמוצגת לכם באתר נשמרת אך ורק בדפדפן שלכם (localStorage) ואינה נשלחת אלינו.
          </p>
        </Section>

        <Section title="שיתוף עם שירותי צד שלישי">
          <p>כדי להפיק דוח, הטקסט/קישור/תמונה שסופקו מעובדים על ידי השירותים הבאים:</p>
          <ul className="list-inside list-disc space-y-1">
            <li>
              <span dir="ltr" className="font-medium">
                Anthropic (Claude)
              </span>{" "}
              — לניתוח הטענה, חילוץ טקסט מתמונה, והערכת מהימנות.
            </li>
            <li>
              <span dir="ltr" className="font-medium">
                Tavily
              </span>{" "}
              — לחיפוש מקורות רלוונטיים ברשת.
            </li>
            <li>
              <span dir="ltr" className="font-medium">
                Supabase
              </span>{" "}
              — לשמירת דוחות שנבחרו לשיתוף, לצורך הפקת קישור קבוע (ראו בהמשך).
            </li>
          </ul>
          <p>
            לכל אחד מהשירותים הללו מדיניות פרטיות ותנאי שימוש משלו, החלים על האופן שבו הם מעבדים את
            המידע שמועבר אליהם.
          </p>
        </Section>

        <Section title="דוחות משותפים">
          <p>
            כאשר בדיקה מושלמת, נוצר דוח שניתן לשתף בקישור ייחודי. כל מי שמחזיק בקישור יכול לצפות בדוח —
            הוא אינו דורש הזדהות. אין כרגע באתר מנגנון עצמאי למחיקת דוח שנשמר; אם ברצונכם להסיר דוח
            ששיתפתם, פנו אלינו דרך{" "}
            <Link href="/contact" className="font-medium text-teal-700 underline">
              טופס יצירת הקשר
            </Link>{" "}
            ונטפל בבקשה.
          </p>
        </Section>

        <Section title="אין אחריות ואין ייעוץ מקצועי">
          <p>
            המידע והסיווגים המוצגים בכלי (כגון "מאומת", "שקרי", "מטעה" וכדומה) הם תוצר של ניתוח
            אוטומטי, ואינם קביעה משפטית, עיתונאית או מדעית סופית. השימוש בכלי ובתוצאותיו הוא באחריות
            המשתמש/ת בלבד. איננו אחראים לנזק שעלול להיגרם כתוצאה מהסתמכות על תוצאות הכלי, לרבות טעות
            בסיווג, פספוס הקשר, או אי-זמינות זמנית של השירות.
          </p>
        </Section>

        <Section title="שימוש הוגן בכלי">
          <p>
            אין להשתמש בכלי כדי להעלות תוכן בלתי חוקי, להטריד, לפגוע בפרטיות צד שלישי, או לנסות
            לעקוף את מגבלות השימוש (כגון שליחת בקשות אוטומטיות בהיקף חריג). אנו שומרים את הזכות
            להגביל או לחסום גישה לכלי במקרה של שימוש לרעה.
          </p>
        </Section>

        <Section title="שינויים במדיניות">
          <p>
            מדיניות זו עשויה להתעדכן מעת לעת, בהתאם לשינויים בכלי או בשירותים שבהם הוא משתמש. המשך
            השימוש בכלי לאחר עדכון מהווה הסכמה למדיניות המעודכנת.
          </p>
        </Section>

        <Section title="יצירת קשר">
          <p>
            לשאלות, דיווח על באגים, בקשות הסרה של דוח, או פניות בנושא פרטיות, אפשר לפנות אלינו דרך{" "}
            <Link href="/contact" className="font-medium text-teal-700 underline">
              טופס יצירת הקשר
            </Link>
            .
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
