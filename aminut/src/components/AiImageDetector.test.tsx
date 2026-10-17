import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { AiImageDetector } from "./AiImageDetector";

function mockFetchOnce(body: unknown, ok = true) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok,
      json: () => Promise.resolve(body),
    })
  );
}

async function uploadImage() {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  const file = new File(["fake-image-bytes"], "test.png", { type: "image/png" });
  Object.defineProperty(input, "files", { value: [file] });
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AiImageDetector", () => {
  it("shows a distinct 'temporarily failed, try again' message when the visual-opinion call errored, instead of the generic 'unsure' message", async () => {
    mockFetchOnce({ credentialsMarkers: [], visualOpinion: null, visualOpinionFailed: true });
    render(<AiImageDetector />);

    await uploadImage();

    await waitFor(() => expect(screen.getByText("הבדיקה החזותית נכשלה זמנית — נסו שוב")).toBeInTheDocument());
    expect(screen.queryByText("לא ניתן לקבוע באופן ברור")).not.toBeInTheDocument();
    expect(screen.getByText(/עקב תקלה זמנית/)).toBeInTheDocument();
  });

  it("shows the model's genuine 'unsure' verdict as such, not as a failure, when the call actually succeeded", async () => {
    mockFetchOnce({
      credentialsMarkers: [],
      visualOpinion: { likelyAiGenerated: "unsure", rationale: "אין סימן ברור.", visualSigns: [] },
      visualOpinionFailed: false,
    });
    render(<AiImageDetector />);

    await uploadImage();

    await waitFor(() => expect(screen.getByText("לא ניתן לקבוע באופן ברור")).toBeInTheDocument());
    expect(screen.queryByText("הבדיקה החזותית נכשלה זמנית — נסו שוב")).not.toBeInTheDocument();
  });

  it("shows the AI-detected verdict when the model confidently finds AI signs", async () => {
    mockFetchOnce({
      credentialsMarkers: [],
      visualOpinion: { likelyAiGenerated: "yes", rationale: "עור חלק מדי.", visualSigns: ["עור חלק מדי"] },
      visualOpinionFailed: false,
    });
    render(<AiImageDetector />);

    await uploadImage();

    await waitFor(() => expect(screen.getByText("ככל הנראה נוצרה או עובדה על ידי AI")).toBeInTheDocument());
  });

  it("shows the server's own Hebrew error message as-is when the API call fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, json: () => Promise.resolve({ error: "חרגת ממכסת הבדיקות השעתית. נסה שוב מאוחר יותר." }) })
    );
    render(<AiImageDetector />);

    await uploadImage();

    await waitFor(() => expect(screen.getByText("חרגת ממכסת הבדיקות השעתית. נסה שוב מאוחר יותר.")).toBeInTheDocument());
  });

  it("never shows a raw browser/runtime exception message to the user — only a clear Hebrew fallback", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("The string did not match the expected pattern."))
    );
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<AiImageDetector />);

    await uploadImage();

    await waitFor(() => expect(screen.getByText(/אירעה שגיאה בבדיקת התמונה/)).toBeInTheDocument());
    expect(screen.queryByText(/did not match the expected pattern/)).not.toBeInTheDocument();
    consoleErrorSpy.mockRestore();
  });
});
