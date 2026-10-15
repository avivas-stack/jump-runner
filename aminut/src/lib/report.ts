import { randomUUID } from "node:crypto";
import { z } from "zod";
import { callStructured } from "./anthropic";
import { config } from "./config";
import { ClaimEvaluation, EvidenceItem, ExtractedClaim, Report } from "./types";

const SynthesisSchema = z.object({
  overallAssessment: z.string().describe("משפט אחד או שניים בעברית פשוטה, המסכם את מסקנת הבדיקה הכוללת."),
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
- אל תשנה סיווג של אף טענה — רק סכם אותו.
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

  return {
    id: randomUUID(),
    checkedAt: new Date().toISOString(),
    overallAssessment: synthesis.overallAssessment,
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
