import { describe, expect, it, vi, beforeEach } from "vitest";
import { z } from "zod";

const configMock = vi.hoisted(() => ({
  config: { anthropicApiKey: "test-key" as string | undefined, anthropicWorkspaceId: undefined as string | undefined },
}));
vi.mock("./config", () => configMock);

const createMock = vi.hoisted(() => vi.fn());
vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create: createMock };
  },
}));

const { callStructured } = await import("./anthropic");

beforeEach(() => {
  createMock.mockReset();
});

describe("callStructured", () => {
  it("strips JSON Schema keywords Anthropic's strict tool mode rejects (minimum/maximum/maxItems/...), while keeping Zod's own response validation intact", async () => {
    createMock.mockResolvedValueOnce({
      content: [{ type: "tool_use", input: { index: 2, tags: ["a", "b"] } }],
    });

    const schema = z.object({
      index: z.number().int(),
      tags: z.array(z.string()).max(3),
    });

    const result = await callStructured({
      model: "claude-haiku-5-5",
      system: "sys",
      prompt: "prompt",
      schema,
      toolName: "test_tool",
    });

    expect(result).toEqual({ index: 2, tags: ["a", "b"] });

    const sentSchema = createMock.mock.calls[0][0].tools[0].input_schema;
    const serialized = JSON.stringify(sentSchema);
    for (const keyword of ["minimum", "maximum", "maxItems", "minItems", "maxLength", "minLength", "multipleOf"]) {
      expect(serialized.includes(`"${keyword}"`)).toBe(false);
    }
    // Keywords Anthropic does support must survive the strip.
    expect(sentSchema.properties.index.type).toBe("integer");
    expect(sentSchema.required).toEqual(["index", "tags"]);
  });

  it("still enforces the original Zod constraints on the response even though they were stripped from the sent schema", async () => {
    createMock.mockResolvedValue({
      content: [{ type: "tool_use", input: { tags: ["a", "b", "c", "d"] } }],
    });

    const schema = z.object({ tags: z.array(z.string()).max(2) });

    await expect(
      callStructured({ model: "claude-haiku-5-5", system: "sys", prompt: "prompt", schema, toolName: "test_tool" })
    ).rejects.toThrow(/לא עמדה בסכימה/);
  });
});
