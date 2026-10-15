import { describe, expect, it, vi } from "vitest";

const { callStructuredMock } = vi.hoisted(() => ({ callStructuredMock: vi.fn() }));
vi.mock("./anthropic", () => ({ callStructured: callStructuredMock }));

const { extractClaims } = await import("./claimExtraction");

describe("extractClaims", () => {
  it("splits a statement containing several claims into separate claim objects", async () => {
    callStructuredMock.mockResolvedValueOnce({
      claims: [
        {
          id: "c1",
          originalText: "האינפלציה ירדה ל-2% ברבעון האחרון",
          normalizedText: "האינפלציה ירדה ל-2% ברבעון האחרון",
          people: [],
          organizations: ["הלשכה המרכזית לסטטיסטיקה"],
          locations: [],
          dates: [],
          events: [],
          eventDate: null,
          publicationDate: null,
          claimType: "factual",
          missingForVerification: [],
          searchQueryEn: "Israel inflation dropped to 2% last quarter",
        },
        {
          id: "c2",
          originalText: "האבטלה הגיעה לשפל של כל הזמנים",
          normalizedText: "האבטלה הגיעה לשפל היסטורי",
          people: [],
          organizations: [],
          locations: [],
          dates: [],
          events: [],
          eventDate: null,
          publicationDate: null,
          claimType: "factual",
          missingForVerification: [],
          searchQueryEn: "Israel unemployment reached all-time low",
        },
      ],
    });

    const claims = await extractClaims(
      "האינפלציה ירדה ל-2% ברבעון האחרון, והאבטלה הגיעה לשפל של כל הזמנים",
      5
    );

    expect(claims).toHaveLength(2);
    expect(claims.map((c) => c.id)).toEqual(["c1", "c2"]);
    expect(claims[0].searchQueryEn).toContain("inflation");
  });

  it("caps results at maxClaims even if the model returns more", async () => {
    callStructuredMock.mockResolvedValueOnce({
      claims: Array.from({ length: 10 }, (_, i) => ({
        id: `c${i + 1}`,
        originalText: `טענה מספר ${i + 1}`,
        normalizedText: `טענה מספר ${i + 1}`,
        people: [],
        organizations: [],
        locations: [],
        dates: [],
        events: [],
        eventDate: null,
        publicationDate: null,
        claimType: "factual" as const,
        missingForVerification: [],
        searchQueryEn: null,
      })),
    });

    const claims = await extractClaims("טקסט עם הרבה טענות", 3);
    expect(claims).toHaveLength(3);
  });
});
