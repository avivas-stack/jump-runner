"use client";

import { useEffect, useRef } from "react";
import type { Classification } from "@/lib/types";
import { ClassificationBadge } from "./ClassificationBadge";

const CLASSIFICATION_EXPLANATIONS: Array<{ classification: Classification; explanation: string }> = [
  { classification: "מאומת", explanation: "נמצאו מקורות אמינים שתומכים בטענה." },
  { classification: "שקרי", explanation: "נמצא מקור אמין שסותר את הטענה במפורש." },
  { classification: "מטעה", explanation: "יש גרעין אמת, אבל ההצגה יוצרת רושם שגוי." },
  { classification: "חסר הקשר", explanation: "הטענה נכונה, אך משמיטה מידע שמשנה את המשמעות." },
  { classification: "לא ניתן לאימות", explanation: "לא נמצאו מספיק מקורות אמינים כדי להכריע — לא בהכרח שקרי, פשוט לא נבדק." },
  {
    classification: 'ככה"נ שקרי',
    explanation: "חיפוש יסודי לא מצא שום תימוכין, וגם לא נמצא מקור מקורי לטענה — סימן לשמועה. לא הפרכה ישירה כמו \"שקרי\".",
  },
  { classification: "שנוי במחלוקת", explanation: "מקורות אמינים חלוקים בדעתם, או שהתשובה תלויה בפרשנות." },
  { classification: "מיושן", explanation: "היה נכון בעבר, אך כבר אינו מדויק כיום." },
  { classification: "דעה, תחזית או סאטירה", explanation: "לא עובדה שניתנת לאימות — זו דעה, ניחוש על העתיד, או הומור." },
];

export function HowItWorksModal() {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleClick = (e: MouseEvent) => {
      if (e.target === dialog) dialog.close();
    };
    dialog.addEventListener("click", handleClick);
    return () => dialog.removeEventListener("click", handleClick);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className="text-xs font-medium text-teal-700 underline-offset-2 hover:underline"
      >
        איך זה עובד ומה הסיווגים אומרים?
      </button>
      <dialog
        ref={dialogRef}
        className="w-full max-w-lg rounded-lg border border-stone-200 p-0 backdrop:bg-stone-900/40"
      >
        <div className="max-h-[80vh] overflow-y-auto p-6" dir="rtl">
          <div className="flex items-start justify-between gap-4">
            <h2 className="font-serif text-lg font-bold text-stone-900">איך אמינות עובדת</h2>
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              aria-label="סגור"
              className="shrink-0 rounded-full p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-600"
            >
              ✕
            </button>
          </div>

          <ol className="mt-3 space-y-2 text-sm text-stone-600">
            <li>1. מדביקים טענה, כותרת, קישור או צילום מסך.</li>
            <li>2. אמינות מחלצת את הטענות העובדתיות ומחפשת עליהן מקורות אמיתיים ברשת.</li>
            <li>3. כל טענה מקבלת סיווג, הסבר, ורמת ביטחון — עם קישור לכל מקור.</li>
          </ol>

          <h3 className="mt-5 text-sm font-semibold text-stone-900">מה הסיווגים אומרים</h3>
          <ul className="mt-3 space-y-3">
            {CLASSIFICATION_EXPLANATIONS.map(({ classification, explanation }) => (
              <li key={classification} className="flex items-start gap-3">
                <div className="shrink-0 pt-0.5">
                  <ClassificationBadge classification={classification} />
                </div>
                <p className="text-sm text-stone-600">{explanation}</p>
              </li>
            ))}
          </ul>

          <p className="mt-5 text-xs text-stone-400">
            אמינות היא כלי עזר לחשיבה ביקורתית ומתבססת על מקורות שנמצאו במועד הבדיקה. ייתכנו טעויות, ולכן יש להפעיל
            ביקורת ושיקול דעת משלכם.
          </p>
        </div>
      </dialog>
    </>
  );
}
