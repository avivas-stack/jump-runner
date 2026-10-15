import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { config } from "./config";

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!config.anthropicApiKey) {
    throw new Error("ANTHROPIC_API_KEY אינו מוגדר");
  }
  if (!client) {
    client = new Anthropic({
      apiKey: config.anthropicApiKey,
      defaultHeaders: config.anthropicWorkspaceId
        ? { "anthropic-workspace-id": config.anthropicWorkspaceId }
        : undefined,
    });
  }
  return client;
}

/**
 * Calls Claude with a single forced tool-use call whose input_schema is derived from `schema`,
 * so the model's only way to respond is to produce arguments matching that schema. The result
 * is still re-validated with zod (a tool call is not a guarantee), and retried once on failure.
 */
export async function callStructured<T extends z.ZodTypeAny>(opts: {
  model: string;
  system: string;
  prompt: string | Anthropic.Messages.ContentBlockParam[];
  schema: T;
  toolName: string;
  maxTokens?: number;
}): Promise<z.infer<T>> {
  const jsonSchema = z.toJSONSchema(opts.schema, { target: "draft-7" }) as Record<string, unknown>;
  delete jsonSchema.$schema;
  stripUnsupportedStrictKeywords(jsonSchema);

  const anthropic = getClient();
  let lastError: unknown = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    const message = await anthropic.messages.create({
      model: opts.model,
      max_tokens: opts.maxTokens ?? 2048,
      system: `${opts.system}\n\nYou must respond by calling the "${opts.toolName}" tool exactly once with your complete answer. Do not respond with plain text.`,
      tools: [
        {
          name: opts.toolName,
          description: "Return the result as structured arguments matching the schema exactly.",
          input_schema: jsonSchema as Anthropic.Messages.Tool.InputSchema,
          strict: true,
        },
      ],
      // Forced tool_choice ("tool"/"any") is rejected (400) on current models
      // (e.g. claude-sonnet-5-5) — use "auto" + strict:true + an explicit
      // system instruction instead, per the Anthropic API's current behavior.
      tool_choice: { type: "auto" },
      messages: [
        {
          role: "user",
          content: attempt === 0 ? opts.prompt : appendRetryNote(opts.prompt),
        },
      ],
    });

    const toolUse = message.content.find((b) => b.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      lastError = new Error("המודל לא החזיר תשובה מובנית");
      continue;
    }
    const parsed = opts.schema.safeParse(toolUse.input);
    if (parsed.success) {
      return parsed.data;
    }
    lastError = parsed.error;
  }

  throw new Error(
    `תשובת המודל לא עמדה בסכימה הנדרשת לאחר מספר ניסיונות: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`
  );
}

// Anthropic's strict tool-use mode only accepts a limited JSON Schema subset and
// returns a 400 for numeric/array bounding keywords — Zod emits several of these
// automatically (e.g. z.number().int() adds minimum/maximum; z.array().max() adds
// maxItems). Strip them recursively rather than hand-tuning every schema to avoid them.
const UNSUPPORTED_STRICT_KEYWORDS = [
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "exclusiveMaximum",
  "minItems",
  "maxItems",
  "minLength",
  "maxLength",
  "multipleOf",
];

function stripUnsupportedStrictKeywords(node: unknown): void {
  if (Array.isArray(node)) {
    for (const item of node) stripUnsupportedStrictKeywords(item);
    return;
  }
  if (node && typeof node === "object") {
    const obj = node as Record<string, unknown>;
    for (const key of UNSUPPORTED_STRICT_KEYWORDS) delete obj[key];
    for (const value of Object.values(obj)) stripUnsupportedStrictKeywords(value);
  }
}

const RETRY_NOTE = "הקריאה הקודמת לא תאמה את הסכימה הנדרשת. החזר ארגומנטים תקינים בלבד.";

function appendRetryNote(
  prompt: string | Anthropic.Messages.ContentBlockParam[]
): string | Anthropic.Messages.ContentBlockParam[] {
  if (typeof prompt === "string") {
    return `${prompt}\n\n${RETRY_NOTE}`;
  }
  return [...prompt, { type: "text", text: RETRY_NOTE }];
}
