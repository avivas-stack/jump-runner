import { z } from "zod";

export const ClaimTypeSchema = z.enum([
  "factual",
  "interpretive",
  "predictive",
  "satirical",
  "opinion",
]);
export type ClaimType = z.infer<typeof ClaimTypeSchema>;

export const ExtractedClaimSchema = z.object({
  id: z.string().describe("Stable short id for this claim, e.g. 'c1'."),
  originalText: z
    .string()
    .describe("The exact claim text, in its original language, verbatim from the input."),
  normalizedText: z
    .string()
    .describe("A normalized, search-friendly paraphrase of the claim."),
  people: z.array(z.string()).default([]),
  organizations: z.array(z.string()).default([]),
  locations: z.array(z.string()).default([]),
  dates: z.array(z.string()).default([]),
  events: z.array(z.string()).default([]),
  eventDate: z
    .string()
    .nullable()
    .default(null)
    .describe("ISO date of the event described, if determinable, else null."),
  publicationDate: z
    .string()
    .nullable()
    .default(null)
    .describe("ISO date the claim was published/stated, if known, else null."),
  claimType: ClaimTypeSchema,
  missingForVerification: z
    .array(z.string())
    .default([])
    .describe("Information missing that would be needed to verify this claim."),
  searchQueryEn: z
    .string()
    .nullable()
    .default(null)
    .describe(
      "An English translation of the claim's key searchable facts (names, event, numbers), only when the claim is in Hebrew; null if the claim is already in English."
    ),
});
export type ExtractedClaim = z.infer<typeof ExtractedClaimSchema>;

export const ClaimExtractionResultSchema = z.object({
  claims: z.array(ExtractedClaimSchema),
});
export type ClaimExtractionResult = z.infer<typeof ClaimExtractionResultSchema>;

export const EvidenceSourceTypeSchema = z.enum([
  "primary",
  "official",
  "news",
  "fact-checker",
  "opinion",
  "other",
]);
export type EvidenceSourceType = z.infer<typeof EvidenceSourceTypeSchema>;

export const EvidenceItemSchema = z.object({
  id: z.string().describe("Stable registry id, e.g. 'e1'."),
  claimId: z.string(),
  url: z.string(),
  title: z.string(),
  publisher: z.string().nullable().default(null),
  publicationDate: z.string().nullable().default(null),
  retrievedAt: z.string(),
  sourceType: EvidenceSourceTypeSchema,
  excerpt: z.string(),
  accessible: z.boolean(),
  inaccessibleReason: z.string().nullable().default(null),
});
export type EvidenceItem = z.infer<typeof EvidenceItemSchema>;

export const ClassificationSchema = z.enum([
  "מאומת",
  "שקרי",
  "מטעה",
  "חסר הקשר",
  "לא ניתן לאימות",
  "ככה\"נ שקרי",
  "שנוי במחלוקת",
  "מיושן",
  "דעה, תחזית או סאטירה",
]);
export type Classification = z.infer<typeof ClassificationSchema>;

export const ConfidenceSchema = z.enum(["low", "medium", "high"]);
export type Confidence = z.infer<typeof ConfidenceSchema>;

export const ClaimEvaluationSchema = z.object({
  claimId: z.string(),
  classification: ClassificationSchema,
  confidence: ConfidenceSchema,
  rationale: z.string().describe("Written in Hebrew, tied to specific evidence ids."),
  supportingEvidenceIds: z.array(z.string()).default([]),
  contradictingEvidenceIds: z.array(z.string()).default([]),
  missingContext: z.string().nullable().default(null),
  whatWouldChangeConclusion: z.string().nullable().default(null),
  likelyOrigin: z
    .string()
    .nullable()
    .default(null)
    .describe(
      "Hebrew explanation (1-3 sentences) of where this claim likely originated and how it may have been distorted along the way — e.g. a quote taken out of context, an old story recirculated as if new, satire mistaken for real news, a mistranslation, a real event with altered details. Only fill this when there's an actual evidence-based signal for it (e.g. a much older publication date, a mismatch between the claim and its cited source, a known satire outlet); null when there's nothing but speculation."
    ),
});
export type ClaimEvaluation = z.infer<typeof ClaimEvaluationSchema>;

export const EvaluationResultSchema = z.object({
  evaluations: z.array(ClaimEvaluationSchema),
});
export type EvaluationResult = z.infer<typeof EvaluationResultSchema>;

export const ReportSchema = z.object({
  id: z.string(),
  checkedAt: z.string(),
  overallAssessment: z.string(),
  plainExplanation: z.array(z.string()),
  claims: z.array(ExtractedClaimSchema),
  evaluations: z.array(ClaimEvaluationSchema),
  evidence: z.array(EvidenceItemSchema),
  limitations: z.array(z.string()),
  openQuestions: z.array(z.string()),
  searchesUsed: z.number(),
  searchBudget: z.number(),
  incomplete: z.boolean(),
  incompleteReason: z.string().nullable().default(null),
});
export type Report = z.infer<typeof ReportSchema>;

export const VerifyRequestSchema = z
  .object({
    text: z.string().trim().max(8000).optional(),
    url: z.string().trim().max(2000).optional(),
  })
  .refine((data) => (data.text && data.text.length > 0) || (data.url && data.url.length > 0), {
    message: "יש לספק טקסט או קישור לבדיקה",
  });
export type VerifyRequest = z.infer<typeof VerifyRequestSchema>;

export const ExtractImageRequestSchema = z.object({
  imageBase64: z.string().min(1).max(10_000_000),
  mediaType: z.enum(["image/jpeg", "image/png", "image/gif", "image/webp"]),
});
export type ExtractImageRequest = z.infer<typeof ExtractImageRequestSchema>;

export const DetectAiImageRequestSchema = z.object({
  imageBase64: z.string().min(1).max(10_000_000),
  mediaType: z.enum(["image/jpeg", "image/png", "image/gif", "image/webp"]),
});
export type DetectAiImageRequest = z.infer<typeof DetectAiImageRequestSchema>;

export const VisualAiOpinionSchema = z.object({
  likelyAiGenerated: z
    .enum(["yes", "no", "unsure"])
    .describe("A cautious stylistic impression only — never a forensic conclusion."),
  rationale: z.string().describe("1-3 sentences in Hebrew explaining the impression."),
  visualSigns: z
    .array(z.string())
    .default([])
    .describe(
      "Specific visual AI-generation tells actually observed in this image (e.g. unnaturally smooth/symmetric faces, malformed hands, impossible physics, inconsistent lighting/shadows, garbled text), each a short Hebrew phrase. Empty if none were observed."
    ),
});
export type VisualAiOpinion = z.infer<typeof VisualAiOpinionSchema>;

export const DetectAiImageResultSchema = z.object({
  credentialsMarkers: z
    .array(z.string())
    .describe("Known AI-provenance markers (e.g. C2PA, SynthID, IPTC DigitalSourceType) found in the file's own metadata, if any."),
  visualOpinion: VisualAiOpinionSchema.nullable(),
});
export type DetectAiImageResult = z.infer<typeof DetectAiImageResultSchema>;

export type StageEvent =
  | { type: "stage"; stage: "fetching_url" }
  | { type: "stage"; stage: "extracting_claims" }
  | { type: "stage"; stage: "searching"; claimIndex: number; totalClaims: number; claimText: string }
  | { type: "stage"; stage: "comparing_sources" }
  | { type: "stage"; stage: "preparing_report" }
  | { type: "done"; report: Report; shareUrl: string | null }
  | { type: "error"; message: string; code: string };
