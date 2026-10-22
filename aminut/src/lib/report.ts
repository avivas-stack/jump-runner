import { randomUUID } from "node:crypto";
import { z } from "zod";
import { callStructured } from "./anthropic";
import { config } from "./config";
import { ClaimEvaluation, ClassificationSchema, EvidenceItem, ExtractedClaim, Report } from "./types";

const SynthesisSchema = z.object({
  overallAssessment: z.string().describe("משפט אחד או שניים בעברית פשוטה, המסכם את מסקנת הבדיקה הכוללת."),
  overallClassification: ClassificationSchema.describe(
    "הסיווג הכולל של הבדיקה כולה — לא ממוצע מכני של סיווגי הטענות הבודדות, אלא הרושם הכולל שהטקסט הנבדק משאיר אצל קורא סביר הרואה אותו כמכלול. דוגמאות: אם טענה מרכזית אחת אומתה אך טענה נלווית דרמטית (תוצאה חמורה, ענישה, איסור, פיטורים) אינה ניתנת לאימות, הסיווג הכולל הוא בדרך כלל 'מטעה' — כי הטקסט כולו יוצר רושם שגוי גם אם חלק ממנו נכון, בדיוק כמו ההגדרה של 'מטעה' ברמת טענה בודדת. אם כל הטענות אומתו, הסיווג הכולל 'מאומת'. אם כל הטענות אינן ניתנות לאימות, הסיווג הכולל 'לא ניתן לאימות'. אם יש טענה שקרית מרכזית, הסיווג הכולל 'שקרי'. בחר תמיד את הסיווג שהכי נאמן לאופן שבו קורא יבין את הטקסט כולו."
  ),
  plainExplanation: z
    .array(z.string())
    .min(1)
    .describe(
      "ההסבר המלא, כרשימת נקודות קצרות וממוקדות בעברית פשוטה (לא פסקה אחת ארוכה) — כל נקודה עובדה או תובנה אחת: מה נכון, מה שגוי או מטעה, מה חסר. 2-6 נקודות, בלי להוסיף עובדות חדשות."
    ),
  limitations: z
    .array(z.string())
    .default([])
    .describe("מגבלות הבדיקה, למשל ראיות חלקיות או מקורות שלא ניתן היה לגשת אליהם."),
  openQuestions: z.array(z.string()).default([]).describe("שאלות פתוחות שנותרו ללא מענה."),
});

const SYSTEM_PROMPT = `אתה כותב את סיכום הדוח הסופי של כלי בדיקת מהימנות חדשות, בהתבסס אך ורק על הסיווגים וההנמקות שכבר נקבעו לכל טענה.

כללים קריטיים:
- אסור לך להוסיף עובדה, תאריך, שם, ציטוט או מקור כלשהו שאינו כלול כבר בטענות ובהערכות שסופקו לך.
- אל תשנה סיווג של אף טענה — overallClassification הוא סיווג נוסף, ברמת הבדיקה כולה, לא שינוי של סיווג טענה בודדת כלשהי.
- אם כל הטענות סווגו כ"לא ניתן לאימות", אמור זאת בבירור ואל תציג זאת כאילו הטענה נבדקה ונמצאה שגויה.
- נסח בעברית פשוטה, ניטרלית, ללא שפה סנסציונית.
- plainExplanation הוא תמיד **רשימת נקודות קצרות**, לא פסקה רציפה אחת — כל נקודה רעיון אחד בלבד, קריא במבט חטוף.`;

export interface BuildReportInput {
  claims: ExtractedClaim[];
  evaluations: ClaimEvaluation[];
  evidence: EvidenceItem[];
  searchesUsed: number;
  searchBudget: number;
  incomplete: boolean;
  incompleteReason: string | null;
}

export async function buildReport(input: BuildReportInput): Promise<Report> {
  const claimSummary = input.claims
    .map((c) => {
      const evalForClaim = input.evaluations.find((e) => e.claimId === c.id);
      return `טענה ${c.id} (${c.claimType}): "${c.originalText}"\nסיווג: ${evalForClaim?.classification ?? "לא הוערך"} (ביטחון: ${evalForClaim?.confidence ?? "—"})\nהנמקה: ${evalForClaim?.rationale ?? "—"}\nהקשר חסר: ${evalForClaim?.missingContext ?? "אין"}`;
    })
    .join("\n\n");

  const synthesis = await callStructured({
    model: config.evaluationModel,
    system: SYSTEM_PROMPT,
    toolName: "write_report_summary",
    maxTokens: 1200,
    schema: SynthesisSchema,
    prompt: `להלן סיכום הטענות וההערכות שכבר בוצעו (${input.evaluations.length} טענות הוערכו מתוך ${input.claims.length}):\n\n${claimSummary || "(לא זוהו טענות עובדתיות הניתנות לבדיקה בטקסט שסופק)"}\n\nמצב החיפוש: ${input.incomplete ? `הבדיקה חלקית — ${input.incompleteReason ?? "מידע לא זמין"}` : "הושלמה"}.\n\nכתוב את סיכום הדוח.`,
  });

  // A single-claim report's overall verdict is just that claim's own verdict — reuse it
  // directly rather than trust the model to echo it back identically, so the "one claim"
  // and "many claims" cases can never visually disagree with each other.
  const overallClassification =
    input.evaluations.length === 1 ? input.evaluations[0].classification : synthesis.overallClassification;

  return {
    id: randomUUID(),
    checkedAt: new Date().toISOString(),
    overallAssessment: synthesis.overallAssessment,
    overallClassification,
    plainExplanation: synthesis.plainExplanation,
    claims: input.claims,
    evaluations: input.evaluations,
    evidence: input.evidence,
    limitations: synthesis.limitations,
    openQuestions: synthesis.openQuestions,
    searchesUsed: input.searchesUsed,
    searchBudget: input.searchBudget,
    incomplete: input.incomplete,
    incompleteReason: input.incompleteReason,
  };
}
